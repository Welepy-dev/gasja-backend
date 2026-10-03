import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PerfilUtilizador } from '@prisma/client';
import { Conta } from '../comum/conta';
import { PERFIS, PUBLICO, TIPO_CONTA } from '../comum/decoradores';

/** Exige JWT em todas as rotas, excepto as marcadas com @Publico(). */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return publico ? true : super.canActivate(ctx);
  }
}

/** Aplica @ApenasCentral(), @ApenasCondutor() e @Perfis(). */
@Injectable()
export class ContasGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const conta = ctx.switchToHttp().getRequest<{ user?: Conta }>().user;
    if (!conta) return false;

    const tipo = this.reflector.getAllAndOverride<string>(TIPO_CONTA, alvos);
    if (tipo && conta.tipo !== tipo) {
      throw new ForbiddenException(
        'Esta área não está disponível para esta conta.',
      );
    }

    const perfis = this.reflector.getAllAndOverride<PerfilUtilizador[]>(
      PERFIS,
      alvos,
    );
    if (perfis?.length) {
      if (conta.tipo !== 'utilizador' || !perfis.includes(conta.perfil)) {
        throw new ForbiddenException(
          'O seu perfil não tem acesso a esta acção.',
        );
      }
    }
    return true;
  }
}
