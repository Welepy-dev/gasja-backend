import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { PerfilUtilizador } from '@prisma/client';
import { Request } from 'express';
import { Conta } from './conta';

export const PUBLICO = 'publico';
/** Rota sem autenticação JWT (webhooks e login). */
export const Publico = () => SetMetadata(PUBLICO, true);

export const TIPO_CONTA = 'tipoConta';
/** Restringe a rota a contas da central ou a condutores. */
export const ApenasCentral = () => SetMetadata(TIPO_CONTA, 'utilizador');
export const ApenasCondutor = () => SetMetadata(TIPO_CONTA, 'condutor');

export const PERFIS = 'perfis';
/** Perfis da central autorizados (por omissão, todos). */
export const Perfis = (...perfis: PerfilUtilizador[]) =>
  SetMetadata(PERFIS, perfis);

export const ContaActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Conta =>
    ctx.switchToHttp().getRequest<Request & { user: Conta }>().user,
);
