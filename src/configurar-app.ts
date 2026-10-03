import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Configuração partilhada pelo arranque e pelos testes e2e. */
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('v1', { exclude: ['saude'] });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  return app;
}

export function configurarDocumentacao(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('GásJá API')
    .setDescription(
      'Backend do GásJá: pedidos, preço, despacho, canais e pagamentos.',
    )
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
