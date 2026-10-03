import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoMensagem,
  EstadoPagamento,
  EstadoPedido,
  MetodoPagamento,
  Prisma,
  TipoEntrega,
  TipoEvento,
} from '@prisma/client';
import { randomInt } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CANAIS } from '../canais/canal';
import { ClientesService } from '../clientes/clientes.service';
import { Conta, ContaCondutor } from '../comum/conta';
import { distanciaKm } from '../comum/distancia';
import { inicioDoDiaEmLuanda } from '../comum/datas';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Textos } from '../notificacoes/textos';
import { PagamentosService } from '../pagamentos/pagamentos.service';
import { PrecosService } from '../precos/precos.service';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealGateway } from '../tempo-real/tempo-real.gateway';
import {
  Autor,
  ESTADOS_EM_CURSO,
  ESTADOS_FINAIS,
  podeTransitar,
} from './estados';
import {
  AccaoCondutorDto,
  CriarPedidoDto,
  EntregarDto,
  FalharDto,
  FiltroPedidosDto,
  MudarEstadoCondutorDto,
  ProblemaDto,
} from './pedidos.dto';

export const INCLUIR_PEDIDO = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  morada: { include: { bairro: true } },
  itens: {
    include: {
      produto: { select: { codigo: true, nome: true, pesoKg: true } },
    },
  },
  condutor: {
    select: {
      id: true,
      nome: true,
      telefone: true,
      veiculo: true,
      matricula: true,
    },
  },
  zona: { select: { numero: true, nome: true } },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{
  include: typeof INCLUIR_PEDIDO;
}>;

interface OpcoesTransicao extends AccaoCondutorDto {
  motivo?: string;
  dados?: Prisma.InputJsonValue;
  /** Alterações extra ao pedido na mesma transacção. */
  alteracoes?: Prisma.PedidoUpdateManyMutationInput;
  /** Trabalho extra dentro da transacção (ex.: registar o pagamento). */
  naTransaccao?: (
    tx: Prisma.TransactionClient,
    pedido: PedidoCompleto,
  ) => Promise<void>;
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precos: PrecosService,
    private readonly clientes: ClientesService,
    private readonly pagamentos: PagamentosService,
    private readonly notificacoes: NotificacoesService,
    private readonly tempoReal: TempoRealGateway,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ---------- Criação ----------

  /** Cria um pedido. `conta` é null quando o pedido vem de um canal automático (SMS). */
  async criar(
    dto: CriarPedidoDto,
    conta: Conta | null,
  ): Promise<PedidoCompleto> {
    const levantamento = dto.tipoEntrega === TipoEntrega.LEVANTAMENTO;
    const canal = dto.canal ?? CANAIS.CHAMADA;

    let clienteId = dto.clienteId;
    if (!clienteId) {
      if (!dto.telefone)
        throw new BadRequestException('Indique o cliente ou o telefone.');
      clienteId = (
        await this.clientes.obterOuCriarPorTelefone(
          dto.telefone,
          dto.nomeCliente,
        )
      ).id;
    } else if (
      !(await this.prisma.cliente.findUnique({ where: { id: clienteId } }))
    ) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    const moradaId = levantamento ? undefined : dto.moradaId;
    const novaMorada = levantamento || moradaId ? undefined : dto.novaMorada;
    if (moradaId) {
      const morada = await this.prisma.morada.findFirst({
        where: { id: moradaId, clienteId },
      });
      if (!morada)
        throw new BadRequestException('A morada não pertence a este cliente.');
    } else if (!novaMorada && !levantamento) {
      throw new BadRequestException('Indique a morada de entrega.');
    }

    if (dto.mensagemOrigemId) {
      const mensagem = await this.prisma.mensagemEntrada.findUnique({
        where: { id: dto.mensagemOrigemId },
        include: { pedido: { select: { id: true } } },
      });
      if (!mensagem) throw new NotFoundException('Mensagem não encontrada.');
      if (mensagem.pedido)
        throw new ConflictException('Esta mensagem já deu origem a um pedido.');
    }

    // O preço calcula-se antes de gravar a morada nova, para não deixar moradas soltas se falhar.
    const orcamento = await this.precos.orcamentar({
      itens: dto.itens,
      levantamento,
      moradaId,
      bairroId: novaMorada?.bairroId,
      lat: novaMorada?.lat,
      lng: novaMorada?.lng,
    });

    const confirmado = dto.confirmadoPeloCliente ?? false;
    const estado = confirmado ? EstadoPedido.CONFIRMADO : EstadoPedido.RECEBIDO;
    const autor = conta ? autorDe(conta) : 'sistema';

    const pedido = await this.prisma.$transaction(async (tx) => {
      const moradaFinal = novaMorada
        ? (await this.clientes.adicionarMorada(clienteId, novaMorada, tx)).id
        : moradaId;
      const criado = await tx.pedido.create({
        data: {
          clienteId,
          moradaId: moradaFinal,
          canal,
          estado,
          tipoEntrega: levantamento
            ? TipoEntrega.LEVANTAMENTO
            : TipoEntrega.ENTREGA,
          metodoPagamento: dto.metodoPagamento,
          trocaVazia: dto.trocaVazia ?? true,
          nota: dto.nota,
          depositoId: orcamento.depositoId,
          zonaId: orcamento.zona.id,
          zonaNumero: orcamento.zona.numero,
          distanciaKm: orcamento.distanciaKm,
          subtotalRecarga: orcamento.subtotalRecarga,
          taxaEntrega: orcamento.taxaEntrega,
          total: orcamento.total,
          codigoEntrega: String(randomInt(0, 10000)).padStart(4, '0'),
          criadoPorId: conta?.tipo === 'utilizador' ? conta.id : null,
          mensagemOrigemId: dto.mensagemOrigemId,
          confirmadoEm: confirmado ? new Date() : null,
          itens: {
            create: orcamento.linhas.map((l) => ({
              produtoId: l.produtoId,
              quantidade: l.quantidade,
              precoUnitario: l.precoUnitario,
              subtotal: l.subtotal,
            })),
          },
          eventos: {
            create: {
              paraEstado: estado,
              autorTipo: autor,
              autorId: conta?.id,
              motivo: confirmado
                ? 'Cliente confirmou o preço na chamada'
                : undefined,
              dados: { orcamento } as unknown as Prisma.InputJsonValue,
            },
          },
        },
        include: INCLUIR_PEDIDO,
      });
      if (dto.mensagemOrigemId) {
        await tx.mensagemEntrada.update({
          where: { id: dto.mensagemOrigemId },
          data: {
            estado: EstadoMensagem.CONVERTIDA,
            clienteId,
            tratadaPorId: conta?.tipo === 'utilizador' ? conta.id : undefined,
          },
        });
      }
      await this.auditoria.registar(
        conta,
        'pedido.criar',
        'Pedido',
        criado.id,
        { canal, estado },
        tx,
      );
      return criado;
    });

    this.tempoReal.paraCentral('pedido.criado', pedido);

    if (confirmado) {
      await this.aposConfirmacao(pedido);
    } else {
      await this.notificacoes.notificarCliente({
        clienteId,
        canal,
        pedidoId: pedido.id,
        texto: Textos.pedirConfirmacao(resumo(pedido)),
      });
    }

    if (dto.condutorId) return this.atribuir(pedido.id, dto.condutorId, conta);
    return pedido;
  }

  /** Depois do "sim" do cliente: SMS com o código de entrega e, se for o caso, pedido de pagamento. */
  private async aposConfirmacao(pedido: PedidoCompleto) {
    await this.notificacoes.notificarCliente({
      clienteId: pedido.clienteId,
      canal: pedido.canal,
      pedidoId: pedido.id,
      texto: Textos.confirmado(resumo(pedido)),
    });
    if (pedido.metodoPagamento === MetodoPagamento.MULTICAIXA_EXPRESS) {
      await this.pagamentos.pedirMulticaixa(pedido.id);
    }
  }

  // ---------- Leitura ----------

  listar(filtro: FiltroPedidosDto) {
    const estados = filtro.estado ? [filtro.estado].flat() : undefined;
    return this.prisma.pedido.findMany({
      where: {
        estado: estados ? { in: estados } : undefined,
        canal: filtro.canal,
        condutorId: filtro.condutorId,
        clienteId: filtro.clienteId,
        criadoEm: filtro.desde ? { gte: new Date(filtro.desde) } : undefined,
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
      include: INCLUIR_PEDIDO,
    });
  }

  async obter(id: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        ...INCLUIR_PEDIDO,
        eventos: { orderBy: { ocorridoEm: 'asc' } },
        pagamentos: { orderBy: { criadoEm: 'asc' } },
        mensagemOrigem: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return pedido;
  }

  /** Condutores disponíveis ordenados pela distância ao cliente, com o número de entregas em curso. */
  async condutoresSugeridos(pedidoId: string) {
    const pedido = await this.obter(pedidoId);
    const destino =
      pedido.morada?.lat != null && pedido.morada?.lng != null
        ? { lat: pedido.morada.lat, lng: pedido.morada.lng }
        : pedido.morada?.bairro?.lat != null &&
            pedido.morada?.bairro?.lng != null
          ? { lat: pedido.morada.bairro.lat, lng: pedido.morada.bairro.lng }
          : null;

    const condutores = await this.prisma.condutor.findMany({
      where: { activo: true, disponivel: true },
      select: {
        id: true,
        nome: true,
        telefone: true,
        veiculo: true,
        matricula: true,
        ultimaLat: true,
        ultimaLng: true,
        ultimaPosicaoEm: true,
        _count: {
          select: { pedidos: { where: { estado: { in: ESTADOS_EM_CURSO } } } },
        },
      },
    });
    return condutores
      .map(({ _count, ...c }) => ({
        ...c,
        entregasEmCurso: _count.pedidos,
        distanciaKm:
          destino && c.ultimaLat !== null && c.ultimaLng !== null
            ? distanciaKm(destino, { lat: c.ultimaLat, lng: c.ultimaLng })
            : null,
      }))
      .sort(
        (a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
      );
  }

  /** Entregas do condutor: em curso e as terminadas hoje. */
  entregasDoCondutor(condutorId: string) {
    return this.prisma.pedido.findMany({
      where: {
        condutorId,
        OR: [
          { estado: { in: ESTADOS_EM_CURSO } },
          {
            estado: { in: ESTADOS_FINAIS },
            actualizadoEm: { gte: inicioDoDiaEmLuanda() },
          },
        ],
      },
      orderBy: { atribuidoEm: 'asc' },
      include: INCLUIR_PEDIDO,
    });
  }

  // ---------- Acções da central ----------

  async confirmar(id: string, conta: Conta) {
    const pedido = await this.transitar(id, EstadoPedido.CONFIRMADO, conta, {
      alteracoes: { confirmadoEm: new Date() },
      motivo: 'Confirmado pela central',
    });
    await this.aposConfirmacao(pedido);
    return pedido;
  }

  async cancelar(
    id: string,
    conta: Conta | null,
    motivo?: string,
    autor?: Autor,
  ) {
    const antes = await this.prisma.pedido.findUnique({
      where: { id },
      select: { condutorId: true },
    });
    const pedido = await this.transitar(
      id,
      EstadoPedido.CANCELADO,
      conta,
      {
        motivo,
        alteracoes: { canceladoEm: new Date(), motivoFim: motivo },
      },
      autor,
    );
    if (antes?.condutorId)
      this.tempoReal.paraCondutor(antes.condutorId, 'entrega.retirada', { id });
    await this.notificacoes.notificarCliente({
      clienteId: pedido.clienteId,
      canal: pedido.canal,
      pedidoId: pedido.id,
      texto: Textos.cancelado(pedido.numero),
    });
    return pedido;
  }

  /** Atribui ou reatribui o pedido a um condutor. */
  async atribuir(id: string, condutorId: string, conta: Conta | null) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.tipoEntrega === TipoEntrega.LEVANTAMENTO) {
      throw new BadRequestException(
        'Pedidos de levantamento no ponto não têm condutor.',
      );
    }
    const permitidos: EstadoPedido[] = [
      EstadoPedido.CONFIRMADO,
      EstadoPedido.ATRIBUIDO,
      EstadoPedido.ACEITE,
    ];
    if (!permitidos.includes(pedido.estado)) {
      throw new ConflictException(
        pedido.estado === EstadoPedido.RECEBIDO
          ? 'O cliente ainda não confirmou o preço.'
          : `Não é possível atribuir um pedido no estado ${pedido.estado}.`,
      );
    }
    if (pedido.condutorId === condutorId) return this.obterCompleto(id);
    const condutor = await this.prisma.condutor.findUnique({
      where: { id: condutorId },
    });
    if (!condutor?.activo)
      throw new BadRequestException('Condutor inexistente ou inactivo.');

    const anterior = pedido.condutorId;
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({
        where: { id, estado: pedido.estado, condutorId: anterior },
        data: {
          estado: EstadoPedido.ATRIBUIDO,
          condutorId,
          atribuidoEm: new Date(),
        },
      });
      if (!count)
        throw new ConflictException(
          'O pedido mudou entretanto. Actualize e tente de novo.',
        );
      await tx.eventoPedido.create({
        data: {
          pedidoId: id,
          deEstado: pedido.estado,
          paraEstado: EstadoPedido.ATRIBUIDO,
          autorTipo: conta ? autorDe(conta) : 'sistema',
          autorId: conta?.id,
          motivo: anterior ? 'Reatribuído' : undefined,
          dados: { condutorId, condutorAnteriorId: anterior },
        },
      });
      await this.auditoria.registar(
        conta,
        'pedido.atribuir',
        'Pedido',
        id,
        { condutorId, anterior },
        tx,
      );
      return tx.pedido.findUniqueOrThrow({
        where: { id },
        include: INCLUIR_PEDIDO,
      });
    });

    if (anterior)
      this.tempoReal.paraCondutor(anterior, 'entrega.retirada', { id });
    this.tempoReal.paraCondutor(condutorId, 'entrega.atribuida', actualizado);
    this.tempoReal.paraCentral('pedido.actualizado', actualizado);
    return actualizado;
  }

  /** Levantamento no ponto: a central entrega a botija e regista o pagamento. */
  async concluirLevantamento(id: string, conta: Conta, valorRecebido?: number) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.tipoEntrega !== TipoEntrega.LEVANTAMENTO) {
      throw new BadRequestException(
        'Este pedido não é de levantamento no ponto.',
      );
    }
    if (pedido.estado !== EstadoPedido.CONFIRMADO) {
      throw new ConflictException('O pedido tem de estar confirmado.');
    }
    return this.transitar(
      id,
      EstadoPedido.ENTREGUE,
      conta,
      {
        alteracoes: { entregueEm: new Date() },
        naTransaccao: async (tx, p) => {
          if (p.metodoPagamento === MetodoPagamento.NUMERARIO) {
            await this.pagamentos.registarNumerario(
              tx,
              p,
              null,
              valorRecebido ?? -1,
            );
          } else if (p.estadoPagamento !== EstadoPagamento.PAGO) {
            throw new ConflictException(
              'O pagamento Multicaixa Express ainda não foi confirmado.',
            );
          }
        },
      },
      'utilizador',
      true,
    );
  }

  // ---------- Acções do condutor (app, possivelmente offline) ----------

  async mudarEstadoCondutor(
    id: string,
    conta: ContaCondutor,
    dto: MudarEstadoCondutorDto,
  ) {
    const pedido = await this.transitar(id, dto.estado, conta, dto);
    if (dto.estado === EstadoPedido.A_CAMINHO && pedido.condutor) {
      await this.notificacoes.notificarCliente({
        clienteId: pedido.clienteId,
        canal: pedido.canal,
        pedidoId: pedido.id,
        texto: Textos.aCaminho(pedido.numero, pedido.condutor.nome),
      });
    }
    return pedido;
  }

  async entregar(id: string, conta: ContaCondutor, dto: EntregarDto) {
    if (dto.idLocal && (await this.eventoJaRegistado(dto.idLocal)))
      return this.obterCompleto(id);

    const pedido = await this.transitar(id, EstadoPedido.ENTREGUE, conta, {
      ...dto,
      alteracoes: {
        entregueEm: dto.ocorridoEm ? new Date(dto.ocorridoEm) : new Date(),
      },
      dados: {
        vaziasRecolhidas: dto.vaziasRecolhidas ?? null,
        confirmadoComCodigo: Boolean(dto.codigoEntrega),
      },
      naTransaccao: async (tx, p) => {
        if (dto.codigoEntrega && dto.codigoEntrega !== p.codigoEntrega) {
          throw new BadRequestException('Código de entrega errado.');
        }
        if (p.metodoPagamento === MetodoPagamento.NUMERARIO) {
          await this.pagamentos.registarNumerario(
            tx,
            p,
            conta.id,
            dto.valorRecebido ?? -1,
          );
        }
        // 1.ª entrega: o ponto GPS do condutor passa a ser o ponto exacto da morada.
        if (
          p.morada &&
          !p.morada.gpsConfirmado &&
          dto.lat !== undefined &&
          dto.lng !== undefined
        ) {
          await tx.morada.update({
            where: { id: p.morada.id },
            data: { lat: dto.lat, lng: dto.lng, gpsConfirmado: true },
          });
        }
      },
    });
    await this.notificacoes.notificarCliente({
      clienteId: pedido.clienteId,
      canal: pedido.canal,
      pedidoId: pedido.id,
      texto: Textos.entregue(pedido.numero),
    });
    return pedido;
  }

  falhar(id: string, conta: ContaCondutor, dto: FalharDto) {
    return this.transitar(id, EstadoPedido.FALHADO, conta, {
      ...dto,
      alteracoes: { motivoFim: dto.motivo },
    });
  }

  /** Problema no terreno: não muda o estado, avisa a central de imediato. */
  async reportarProblema(id: string, conta: ContaCondutor, dto: ProblemaDto) {
    if (dto.idLocal && (await this.eventoJaRegistado(dto.idLocal)))
      return { registado: true };
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.condutorId !== conta.id)
      throw new ForbiddenException('Esta entrega não é sua.');

    const evento = await this.prisma.eventoPedido.create({
      data: {
        pedidoId: id,
        tipo: TipoEvento.PROBLEMA,
        autorTipo: 'condutor',
        autorId: conta.id,
        motivo: dto.tipo,
        dados: { nota: dto.nota ?? null },
        lat: dto.lat,
        lng: dto.lng,
        idLocal: dto.idLocal,
        ocorridoEm: dto.ocorridoEm ? new Date(dto.ocorridoEm) : undefined,
      },
    });
    this.tempoReal.paraCentral('pedido.problema', {
      pedidoId: id,
      numero: pedido.numero,
      tipo: dto.tipo,
      nota: dto.nota,
      condutorId: conta.id,
      eventoId: evento.id,
    });
    return { registado: true };
  }

  // ---------- Cliente (respostas SIM / NAO por SMS) ----------

  /** Aplica a resposta do cliente ao pedido mais recente que a espera. Devolve null se não houver. */
  async respostaCliente(clienteId: string, resposta: 'SIM' | 'NAO') {
    const estados =
      resposta === 'SIM'
        ? [EstadoPedido.RECEBIDO]
        : [EstadoPedido.RECEBIDO, EstadoPedido.CONFIRMADO];
    const pedido = await this.prisma.pedido.findFirst({
      where: { clienteId, estado: { in: estados } },
      orderBy: { criadoEm: 'desc' },
    });
    if (!pedido) return null;

    if (resposta === 'NAO') {
      return this.cancelar(pedido.id, null, 'Cliente respondeu NAO', 'cliente');
    }
    const confirmado = await this.transitar(
      pedido.id,
      EstadoPedido.CONFIRMADO,
      null,
      {
        motivo: 'Cliente respondeu SIM',
        alteracoes: { confirmadoEm: new Date() },
      },
      'cliente',
    );
    await this.aposConfirmacao(confirmado);
    return confirmado;
  }

  // ---------- Núcleo das transições ----------

  private async transitar(
    id: string,
    para: EstadoPedido,
    conta: Conta | null,
    opcoes: OpcoesTransicao = {},
    autorForcado?: Autor,
    /** Excepção explícita à máquina de estados (levantamento no ponto). */
    ignorarMaquina = false,
  ): Promise<PedidoCompleto> {
    if (opcoes.idLocal && (await this.eventoJaRegistado(opcoes.idLocal))) {
      return this.obterCompleto(id);
    }
    const autor = autorForcado ?? (conta ? autorDe(conta) : 'sistema');
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: INCLUIR_PEDIDO,
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');

    if (autor === 'condutor' && pedido.condutorId !== conta?.id) {
      throw new ForbiddenException('Esta entrega não é sua.');
    }
    if (!ignorarMaquina && !podeTransitar(autor, pedido.estado, para)) {
      throw new ConflictException(
        `Não é possível passar de ${pedido.estado} para ${para}.`,
      );
    }
    // Multicaixa Express é cobrado antes da saída do condutor.
    if (
      para === EstadoPedido.A_CAMINHO &&
      pedido.metodoPagamento === MetodoPagamento.MULTICAIXA_EXPRESS &&
      pedido.estadoPagamento !== EstadoPagamento.PAGO
    ) {
      throw new ConflictException(
        'O pagamento Multicaixa Express ainda não foi confirmado.',
      );
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({
        where: { id, estado: pedido.estado },
        data: { ...opcoes.alteracoes, estado: para },
      });
      if (!count)
        throw new ConflictException(
          'O pedido mudou entretanto. Actualize e tente de novo.',
        );
      await opcoes.naTransaccao?.(tx, pedido);
      await tx.eventoPedido.create({
        data: {
          pedidoId: id,
          deEstado: pedido.estado,
          paraEstado: para,
          autorTipo: autor,
          autorId: conta?.id,
          motivo: opcoes.motivo,
          dados: opcoes.dados,
          lat: opcoes.lat,
          lng: opcoes.lng,
          idLocal: opcoes.idLocal,
          ocorridoEm: opcoes.ocorridoEm
            ? new Date(opcoes.ocorridoEm)
            : undefined,
        },
      });
      await this.auditoria.registar(
        conta,
        'pedido.estado',
        'Pedido',
        id,
        { de: pedido.estado, para, motivo: opcoes.motivo ?? null },
        tx,
      );
      return tx.pedido.findUniqueOrThrow({
        where: { id },
        include: INCLUIR_PEDIDO,
      });
    });

    this.tempoReal.paraCentral('pedido.actualizado', actualizado);
    if (actualizado.condutorId && autor !== 'condutor') {
      this.tempoReal.paraCondutor(
        actualizado.condutorId,
        'entrega.actualizada',
        actualizado,
      );
    }
    return actualizado;
  }

  private async eventoJaRegistado(idLocal: string) {
    return Boolean(
      await this.prisma.eventoPedido.findUnique({ where: { idLocal } }),
    );
  }

  private obterCompleto(id: string) {
    return this.prisma.pedido.findUniqueOrThrow({
      where: { id },
      include: INCLUIR_PEDIDO,
    });
  }
}

function autorDe(conta: Conta): Autor {
  return conta.tipo === 'condutor' ? 'condutor' : 'utilizador';
}

export function resumo(pedido: PedidoCompleto) {
  return {
    numero: pedido.numero,
    itens: pedido.itens.map((i) => ({
      quantidade: i.quantidade,
      pesoKg: i.produto.pesoKg,
    })),
    subtotalRecarga: pedido.subtotalRecarga,
    taxaEntrega: pedido.taxaEntrega,
    zonaNumero: pedido.zonaNumero,
    total: pedido.total,
    metodoPagamento: pedido.metodoPagamento,
    codigoEntrega: pedido.codigoEntrega,
  };
}
