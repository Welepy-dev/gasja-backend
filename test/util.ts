import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

export const SEGREDO = process.env.CANAIS_SEGREDO_WEBHOOK!;

export async function criarApp(): Promise<INestApplication<App>> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = configurarApp(modulo.createNestApplication());
  await app.init();
  return app;
}

export async function entrarCentral(app: INestApplication<App>) {
  const r = await request(app.getHttpServer())
    .post('/v1/auth/central/login')
    .send({ email: 'admin@gasja.ao', password: 'gasja-admin-dev' })
    .expect(200);
  return r.body.token as string;
}

export async function entrarCondutor(app: INestApplication<App>) {
  const r = await request(app.getHttpServer())
    .post('/v1/auth/condutor/login')
    .send({ telefone: '923 000 001', pin: '1234' })
    .expect(200);
  return { token: r.body.token as string, id: r.body.condutor.id as string };
}
