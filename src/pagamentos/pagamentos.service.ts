import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPagamento, MetodoPagamento, Prisma } from '@prisma/client';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Textos } from '../notificacoes/textos';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealGateway } from '../tempo-real/tempo-real.gateway';
import { GatewayMulticaixa } from './gateway-multicaixa';

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayMulticaixa,
    private readonly notificacoes: NotificacoesService,
    private readonly tempoReal: TempoRealGateway,
  ) {}

  /** Envia o pedido de pagamento Multicaixa Express ao telemóvel do cliente (antes da saída do condutor). */
  async pedirMulticaixa(pedidoId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { cliente: true, itens: { include: { produto: true } } },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.metodoPagamento !== MetodoPagamento.MULTICAIXA_EXPRESS) {
      throw new BadRequestException('Este pedido é pago em numerário.');
    }
    if (pedido.estadoPagamento === EstadoPagamento.PAGO) {
      throw new BadRequestException('Este pedido já está pago.');
    }

    const { referenciaExterna } = await this.gateway.pedirPagamento({
      referencia: String(pedido.numero),
      telefone: pedido.cliente.telefone,
      valor: pedido.total,
    });
    const pagamento = await this.prisma.$transaction(async (tx) => {
      // Um pedido novo substitui os pendentes anteriores.
      await tx.pagamento.updateMany({
        where: { pedidoId, estado: EstadoPagamento.PENDENTE },
        data: { estado: EstadoPagamento.FALHOU },
      });
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estadoPagamento: EstadoPagamento.PENDENTE },
      });
      return tx.pagamento.create({
        data: {
          pedidoId,
          metodo: MetodoPagamento.MULTICAIXA_EXPRESS,
          valor: pedido.total,
          referenciaExterna,
        },
      });
    });

    await this.notificacoes.notificarCliente({
      clienteId: pedido.clienteId,
      canal: pedido.canal,
      pedidoId,
      texto: Textos.pagamentoPedido({
        ...pedido,
        itens: pedido.itens.map((i) => ({
          quantidade: i.quantidade,
          pesoKg: i.produto.pesoKg,
        })),
      }),
    });
    return pagamento;
  }

  /** Resposta do gateway (callback). Idempotente: callbacks repetidos não mudam nada. */
  async confirmarMulticaixa(
    referenciaExterna: string,
    pago: boolean,
    dados?: Prisma.InputJsonValue,
  ) {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { referenciaExterna },
    });
    if (!pagamento) throw new NotFoundException('Pagamento desconhecido.');
    if (pagamento.estado !== EstadoPagamento.PENDENTE) return pagamento;

    const estado = pago ? EstadoPagamento.PAGO : EstadoPagamento.FALHOU;
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const p = await tx.pagamento.update({
        where: { id: pagamento.id },
        data: { estado, confirmadoEm: new Date(), dados },
      });
      await tx.pedido.update({
        where: { id: pagamento.pedidoId },
        data: { estadoPagamento: estado },
      });
      return p;
    });
    this.logger.log(`Pagamento ${referenciaExterna}: ${estado}`);
    this.tempoReal.paraCentral('pagamento.actualizado', {
      pedidoId: pagamento.pedidoId,
      estado,
    });
    return actualizado;
  }

  /** Numerário recebido pelo condutor na entrega. Nunca pode ser diferente do total confirmado. */
  async registarNumerario(
    tx: Prisma.TransactionClient,
    pedido: { id: string; total: number },
    condutorId: string | null,
    valorRecebido: number,
  ) {
    if (valorRecebido !== pedido.total) {
      throw new BadRequestException(
        `O valor cobrado tem de ser o total do pedido (${pedido.total} Kz).`,
      );
    }
    await tx.pagamento.create({
      data: {
        pedidoId: pedido.id,
        metodo: MetodoPagamento.NUMERARIO,
        valor: valorRecebido,
        estado: EstadoPagamento.PAGO,
        condutorId,
        confirmadoEm: new Date(),
      },
    });
    await tx.pedido.update({
      where: { id: pedido.id },
      data: { estadoPagamento: EstadoPagamento.PAGO },
    });
  }

  /** Numerário entregue pelo condutor e ainda não conciliado pelo supervisor. */
  async numerarioPorConciliar(condutorId?: string) {
    const grupos = await this.prisma.pagamento.groupBy({
      by: ['condutorId'],
      where: {
        metodo: MetodoPagamento.NUMERARIO,
        estado: EstadoPagamento.PAGO,
        conciliadoEm: null,
        condutorId: condutorId ?? { not: null },
      },
      _sum: { valor: true },
      _count: true,
    });
    return grupos.map((g) => ({
      condutorId: g.condutorId,
      entregas: g._count,
      valor: g._sum.valor ?? 0,
    }));
  }
}
