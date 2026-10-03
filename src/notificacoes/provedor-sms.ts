import { Injectable, Logger } from '@nestjs/common';
import { AdaptadorSaida, CANAIS } from '../canais/canal';

/**
 * SMS de saída. Enquanto não houver contrato com um agregador (A2P), as mensagens
 * ficam só no registo. Para ligar o agregador: implementar `enviar` com a API dele.
 */
@Injectable()
export class AdaptadorSmsSaida implements AdaptadorSaida {
  readonly canal = CANAIS.SMS;
  private readonly logger = new Logger('SMS');

  enviar(destino: string, texto: string): Promise<{ idExterno?: string }> {
    this.logger.log(`→ ${destino}: ${texto}`);
    return Promise.resolve({});
  }
}
