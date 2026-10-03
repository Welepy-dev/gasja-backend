import { Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.module';
import { AppCondutorController } from './app-condutor.controller';
import { CondutoresController } from './condutores.controller';
import { CondutoresService } from './condutores.service';

@Module({
  imports: [PedidosModule],
  controllers: [CondutoresController, AppCondutorController],
  providers: [CondutoresService],
})
export class CondutoresModule {}
