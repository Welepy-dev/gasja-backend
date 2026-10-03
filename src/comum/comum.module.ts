import { Global, Module } from '@nestjs/common';
import { SegredoWebhook } from './segredo-webhook';

@Global()
@Module({
  providers: [SegredoWebhook],
  exports: [SegredoWebhook],
})
export class ComumModule {}
