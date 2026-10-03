import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Protege os webhooks dos fornecedores (agregador de SMS, PBX, gateway de pagamento)
 * com um segredo partilhado no cabeçalho `x-gasja-segredo`.
 * Quando cada fornecedor for escolhido, acrescenta-se a validação de assinatura própria dele.
 */
@Injectable()
export class SegredoWebhook {
  constructor(private readonly config: ConfigService) {}

  validar(recebido: string | undefined) {
    const esperado = Buffer.from(
      this.config.getOrThrow<string>('CANAIS_SEGREDO_WEBHOOK'),
    );
    const dado = Buffer.from(recebido ?? '');
    if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) {
      throw new UnauthorizedException('Segredo do webhook inválido.');
    }
  }
}
