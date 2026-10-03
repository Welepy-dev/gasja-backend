import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PedidoPagamento {
  /** Número do pedido GásJá, mostrado ao cliente. */
  referencia: string;
  telefone: string;
  valor: number;
}

/**
 * Pedido de pagamento Multicaixa Express (o cliente aceita no telemóvel).
 * A integração real é com a EMIS (GPO) via banco comercial ou um agregador angolano;
 * o fornecedor ainda não foi escolhido.
 */
export abstract class GatewayMulticaixa {
  abstract pedirPagamento(
    pedido: PedidoPagamento,
  ): Promise<{ referenciaExterna: string }>;
}

/** Gateway de desenvolvimento: não cobra nada; o callback simula-se com POST /pagamentos/multicaixa/callback. */
@Injectable()
export class GatewayMulticaixaSimulado extends GatewayMulticaixa {
  private readonly logger = new Logger('MulticaixaSimulado');

  pedirPagamento(pedido: PedidoPagamento) {
    const referenciaExterna = `SIM-${randomUUID()}`;
    this.logger.log(
      `Pedido de pagamento ${referenciaExterna}: ${pedido.valor} Kz para ${pedido.telefone} (pedido ${pedido.referencia})`,
    );
    return Promise.resolve({ referenciaExterna });
  }
}
