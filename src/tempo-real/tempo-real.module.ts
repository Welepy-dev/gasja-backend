import { Global, Module } from '@nestjs/common';
import { TempoRealGateway } from './tempo-real.gateway';

@Global()
@Module({
  providers: [TempoRealGateway],
  exports: [TempoRealGateway],
})
export class TempoRealModule {}
