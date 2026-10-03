import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPagamento, EstadoPedido, MetodoPagamento } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Conta } from '../comum/conta';
import { inicioDoDiaEmLuanda } from '../comum/datas';
import { normalizarTelefone } from '../comum/telefone';
import { ESTADOS_EM_CURSO } from '../pedidos/estados';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealGateway } from '../tempo-real/tempo-real.gateway';
import {
  ActualizarCondutorDto,
  CriarCondutorDto,
  PosicaoDto,
} from './condutores.dto';

const PUBLICO = {
  id: true,
  nome: true,
  telefone: true,
  veiculo: true,
  matricula: true,
  activo: true,
  disponivel: true,
  ultimaLat: true,
  ultimaLng: true,
  ultimaPosicaoEm: true,
} as const;

@Injectable()
export class CondutoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly tempoReal: TempoRealGateway,
  ) {}

  async listar() {
    const condutores = await this.prisma.condutor.findMany({
      orderBy: { nome: 'asc' },
      select: {
        ...PUBLICO,
        _count: {
          select: { pedidos: { where: { estado: { in: ESTADOS_EM_CURSO } } } },
        },
      },
    });
    return condutores.map(({ _count, ...c }) => ({
      ...c,
      entregasEmCurso: _count.pedidos,
    }));
  }

  async obter(id: string) {
    const condutor = await this.prisma.condutor.findUnique({
      where: { id },
      select: PUBLICO,
    });
    if (!condutor) throw new NotFoundException('Condutor não encontrado.');
    return condutor;
  }

  async criar(dto: CriarCondutorDto, conta: Conta) {
    const telefone = normalizarTelefone(dto.telefone);
    if (!telefone)
      throw new BadRequestException('Número de telefone inválido.');
    if (await this.prisma.condutor.findUnique({ where: { telefone } })) {
      throw new ConflictException('Já existe um condutor com este telefone.');
    }
    const { pin, ...dados } = dto;
    const condutor = await this.prisma.condutor.create({
      data: { ...dados, telefone, pinHash: await bcrypt.hash(pin, 10) },
      select: PUBLICO,
    });
    await this.auditoria.registar(
      conta,
      'condutor.criar',
      'Condutor',
      condutor.id,
      { nome: dto.nome, telefone },
    );
    return condutor;
  }

  async actualizar(id: string, dto: ActualizarCondutorDto, conta: Conta) {
    await this.obter(id);
    const { pin, telefone, ...dados } = dto;
    const numero =
      telefone !== undefined ? normalizarTelefone(telefone) : undefined;
    if (numero === null)
      throw new BadRequestException('Número de telefone inválido.');
    const condutor = await this.prisma.condutor.update({
      where: { id },
      data: {
        ...dados,
        telefone: numero,
        pinHash: pin ? await bcrypt.hash(pin, 10) : undefined,
        // Desactivar um condutor tira-o também do turno.
        disponivel: dados.activo === false ? false : undefined,
      },
      select: PUBLICO,
    });
    await this.auditoria.registar(
      conta,
      'condutor.actualizar',
      'Condutor',
      id,
      {
        ...dados,
        telefone: numero ?? null,
        pinAlterado: Boolean(pin),
      },
    );
    return condutor;
  }

  async definirTurno(id: string, disponivel: boolean) {
    const condutor = await this.prisma.condutor.update({
      where: { id },
      data: { disponivel },
      select: PUBLICO,
    });
    this.tempoReal.paraCentral('condutor.actualizado', condutor);
    return condutor;
  }

  async actualizarPosicao(id: string, dto: PosicaoDto) {
    const condutor = await this.prisma.condutor.update({
      where: { id },
      data: {
        ultimaLat: dto.lat,
        ultimaLng: dto.lng,
        ultimaPosicaoEm: new Date(),
      },
      select: PUBLICO,
    });
    this.tempoReal.paraCentral('condutor.posicao', {
      id,
      lat: dto.lat,
      lng: dto.lng,
      em: condutor.ultimaPosicaoEm,
    });
    return { ok: true };
  }

  /** Resumo do dia para a app: entregas feitas, numerário em mão (recargas + taxas). */
  async resumoDoDia(id: string) {
    const desde = inicioDoDiaEmLuanda();
    const [pedidos, numerario] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { condutorId: id, atribuidoEm: { gte: desde } },
        select: { estado: true, distanciaKm: true },
      }),
      this.prisma.pagamento.findMany({
        where: {
          condutorId: id,
          metodo: MetodoPagamento.NUMERARIO,
          estado: EstadoPagamento.PAGO,
          conciliadoEm: null,
        },
        include: {
          pedido: { select: { subtotalRecarga: true, taxaEntrega: true } },
        },
      }),
    ]);
    const entregues = pedidos.filter((p) => p.estado === EstadoPedido.ENTREGUE);
    return {
      entregasFeitas: entregues.length,
      entregasTotal: pedidos.length,
      // Ida e volta desde o depósito, em linha recta: é uma estimativa.
      kmEstimados:
        Math.round(
          entregues.reduce((s, p) => s + (p.distanciaKm ?? 0) * 2, 0) * 10,
        ) / 10,
      numerarioEmMao: numerario.reduce((s, p) => s + p.valor, 0),
      numerarioRecargas: numerario.reduce(
        (s, p) => s + p.pedido.subtotalRecarga,
        0,
      ),
      numerarioTaxas: numerario.reduce((s, p) => s + p.pedido.taxaEntrega, 0),
    };
  }
}
