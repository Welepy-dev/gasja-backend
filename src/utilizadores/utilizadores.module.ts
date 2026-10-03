import { Module } from '@nestjs/common';
import { UtilizadoresController } from './utilizadores.controller';

@Module({
  controllers: [UtilizadoresController],
})
export class UtilizadoresModule {}
