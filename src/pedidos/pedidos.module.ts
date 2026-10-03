import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { PagamentosModule } from '../pagamentos/pagamentos.module';
import { PrecosModule } from '../precos/precos.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [PrecosModule, ClientesModule, PagamentosModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
