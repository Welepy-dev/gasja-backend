import { Global, Module } from '@nestjs/common';
import { ADAPTADORES_SAIDA } from '../canais/canal';
import { NotificacoesService } from './notificacoes.service';
import { AdaptadorSmsSaida } from './provedor-sms';

@Global()
@Module({
  providers: [
    AdaptadorSmsSaida,
    {
      // Para juntar WhatsApp ou Messenger: acrescentar o adaptador de saída a esta lista.
      provide: ADAPTADORES_SAIDA,
      inject: [AdaptadorSmsSaida],
      useFactory: (sms: AdaptadorSmsSaida) => [sms],
    },
    NotificacoesService,
  ],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
