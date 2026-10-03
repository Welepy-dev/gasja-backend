import { Module } from '@nestjs/common';
import {
  GatewayMulticaixa,
  GatewayMulticaixaSimulado,
} from './gateway-multicaixa';
import { PagamentosController } from './pagamentos.controller';
import { PagamentosService } from './pagamentos.service';

@Module({
  controllers: [PagamentosController],
  providers: [
    PagamentosService,
    // Trocar pelo gateway real quando houver contrato com o banco ou agregador.
    { provide: GatewayMulticaixa, useClass: GatewayMulticaixaSimulado },
  ],
  exports: [PagamentosService],
})
export class PagamentosModule {}
