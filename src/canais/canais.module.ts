import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ChamadaController } from './adaptadores/chamada.controller';
import { SmsController } from './adaptadores/sms.controller';
import { CanaisService } from './canais.service';
import { MensagensController } from './mensagens.controller';

/**
 * Camada de canais. Para juntar um canal novo (ex.: WhatsApp):
 * 1. um controller em adaptadores/ que recebe o webhook e chama CanaisService.receber();
 * 2. um AdaptadorSaida registado em NotificacoesModule.
 * Nada no núcleo muda.
 */
@Module({
  imports: [ClientesModule, PedidosModule],
  controllers: [SmsController, ChamadaController, MensagensController],
  providers: [CanaisService],
})
export class CanaisModule {}
