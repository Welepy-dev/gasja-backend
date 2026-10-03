import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp, configurarDocumentacao } from './configurar-app';

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  configurarDocumentacao(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
