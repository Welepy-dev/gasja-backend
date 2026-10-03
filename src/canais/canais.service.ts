import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EstadoMensagem } from '@prisma/client';
import { ClientesService } from '../clientes/clientes.service';
import { Conta } from '../comum/conta';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Textos } from '../notificacoes/textos';
import { PedidosService } from '../pedidos/pedidos.service';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealGateway } from '../tempo-real/tempo-real.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { MensagemNormalizada } from './canal';
import {
  interpretarPedido,
  lerResposta,
  PedidoInterpretado,
} from './interpretador';

function semAcentos(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Entrada única de todas as mensagens de texto (SMS hoje; WhatsApp e Messenger depois).
 * 1. identifica o cliente; 2. guarda a mensagem na caixa de entrada;
 * 3. se for SIM/NAO, aplica-a ao pedido pendente; 4. senão tenta interpretar um pedido.
 * O que não se consegue resolver fica como DUVIDA para a central.
 */
@Injectable()
export class CanaisService {
  private readonly logger = new Logger(CanaisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
    private readonly pedidos: PedidosService,
    private readonly notificacoes: NotificacoesService,
    private readonly tempoReal: TempoRealGateway,
    private readonly auditoria: AuditoriaService,
  ) {}

  async receber(msg: MensagemNormalizada) {
    if (msg.idExterno) {
      const repetida = await this.prisma.mensagemEntrada.findUnique({
        where: {
          canal_idExterno: { canal: msg.canal, idExterno: msg.idExterno },
        },
      });
      if (repetida) return repetida;
    }

    const cliente = await this.clientes.identificar(msg.canal, msg.remetente);
    const mensagem = await this.prisma.mensagemEntrada.create({
      data: {
        canal: msg.canal,
        remetente: msg.remetente,
        clienteId: cliente?.id,
        texto: msg.texto,
        lat: msg.localizacao?.lat,
        lng: msg.localizacao?.lng,
        conversaId: msg.conversaId,
        idExterno: msg.idExterno,
        recebidaEm: msg.recebidaEm,
      },
    });

    const final = await this.processar(
      mensagem.id,
      msg,
      cliente?.id ?? null,
    ).catch(async (erro: unknown) => {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      this.logger.warn(
        `Mensagem ${mensagem.id} ficou para a central: ${motivo}`,
      );
      return this.marcar(mensagem.id, EstadoMensagem.DUVIDA, { erro: motivo });
    });
    this.tempoReal.paraCentral('mensagem.recebida', final);
    return final;
  }

  private async processar(
    id: string,
    msg: MensagemNormalizada,
    clienteId: string | null,
  ) {
    if (!clienteId) {
      return this.marcar(id, EstadoMensagem.DUVIDA, {
        erro: 'Cliente não identificado',
      });
    }

    const resposta = lerResposta(msg.texto);
    if (resposta) {
      const pedido = await this.pedidos.respostaCliente(clienteId, resposta);
      if (!pedido) {
        await this.notificacoes.notificarCliente({
          clienteId,
          canal: msg.canal,
          texto: Textos.semPedidoPendente(),
        });
        return this.marcar(id, EstadoMensagem.DUVIDA, {
          resposta,
          erro: 'Sem pedido pendente',
        });
      }
      return this.marcar(id, EstadoMensagem.RESPOSTA, {
        resposta,
        pedidoId: pedido.id,
      });
    }

    const interpretado = interpretarPedido(msg.texto);
    if (interpretado.duvidas.length) {
      return this.marcar(id, EstadoMensagem.DUVIDA, interpretado);
    }

    const morada = await this.resolverMorada(clienteId, interpretado, msg);
    if (!interpretado.levantamento && !morada) {
      return this.marcar(id, EstadoMensagem.DUVIDA, {
        ...interpretado,
        duvidas: ['morada guardada não encontrada'],
      });
    }

    // O pedido fica RECEBIDO e o cliente recebe o preço por SMS; só avança depois do SIM.
    await this.pedidos.criar(
      {
        clienteId,
        moradaId: morada?.moradaId,
        novaMorada: morada?.novaMorada,
        itens: [
          { pesoKg: interpretado.pesoKg!, quantidade: interpretado.quantidade },
        ],
        metodoPagamento: interpretado.metodoPagamento!,
        tipoEntrega: interpretado.levantamento ? 'LEVANTAMENTO' : 'ENTREGA',
        canal: msg.canal,
        confirmadoPeloCliente: false,
        mensagemOrigemId: id,
      },
      null,
    );
    return this.marcar(id, EstadoMensagem.CONVERTIDA, interpretado);
  }

  /** Morada guardada pelo nome (CASA, TRABALHO) ou nova morada a partir do texto, com o bairro reconhecido. */
  private async resolverMorada(
    clienteId: string,
    interpretado: PedidoInterpretado,
    msg: MensagemNormalizada,
  ) {
    if (interpretado.levantamento) return null;
    if (interpretado.moradaGuardada) {
      const guardada = await this.prisma.morada.findFirst({
        where: {
          clienteId,
          nome: { equals: interpretado.moradaGuardada, mode: 'insensitive' },
        },
      });
      return guardada ? { moradaId: guardada.id } : null;
    }
    const texto = interpretado.moradaTexto!;
    const bairros = await this.prisma.bairro.findMany({
      where: { activo: true },
    });
    const alvo = semAcentos(texto);
    const bairro = bairros
      .filter((b) => alvo.includes(semAcentos(b.nome)))
      .sort((a, b) => b.nome.length - a.nome.length)[0];
    return {
      novaMorada: {
        nome: 'Casa',
        descricao: texto,
        bairroId: bairro?.id,
        lat: msg.localizacao?.lat,
        lng: msg.localizacao?.lng,
      },
    };
  }

  private marcar(id: string, estado: EstadoMensagem, interpretacao: object) {
    return this.prisma.mensagemEntrada.update({
      where: { id },
      data: { estado, interpretacao: interpretacao },
    });
  }

  // ---------- Caixa de entrada da central ----------

  listar(filtro: { estado?: EstadoMensagem; canal?: string }) {
    return this.prisma.mensagemEntrada.findMany({
      where: { estado: filtro.estado, canal: filtro.canal },
      orderBy: { recebidaEm: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        pedido: { select: { id: true, numero: true, estado: true } },
      },
    });
  }

  async obter(id: string) {
    const mensagem = await this.prisma.mensagemEntrada.findUnique({
      where: { id },
      include: {
        cliente: { include: { moradas: true } },
        pedido: { select: { id: true, numero: true, estado: true } },
      },
    });
    if (!mensagem) throw new NotFoundException('Mensagem não encontrada.');
    return mensagem;
  }

  async ignorar(id: string, conta: Conta) {
    await this.obter(id);
    const mensagem = await this.prisma.mensagemEntrada.update({
      where: { id },
      data: { estado: EstadoMensagem.IGNORADA, tratadaPorId: conta.id },
    });
    await this.auditoria.registar(
      conta,
      'mensagem.ignorar',
      'MensagemEntrada',
      id,
    );
    return mensagem;
  }

  /** Pop-up de chamada: avisa a central de quem está a ligar, com a ficha se o número for conhecido. */
  async chamadaRecebida(evento: {
    numero: string;
    chamadaId?: string;
    estado: string;
    extensao?: string;
  }) {
    const telefone = this.clientes.telefoneValidoOuNull(evento.numero);
    const cliente = telefone
      ? await this.prisma.cliente.findUnique({
          where: { telefone },
          select: { id: true },
        })
      : null;
    const ficha = cliente ? await this.clientes.ficha(cliente.id) : null;
    const dados = { ...evento, telefone, cliente: ficha };
    this.tempoReal.paraCentral('chamada.' + evento.estado, dados);
    return { clienteConhecido: Boolean(ficha) };
  }
}
