import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PerfilUtilizador } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Conta } from '../comum/conta';
import { PrismaService } from '../prisma/prisma.service';

export interface PayloadJwt {
  sub: string;
  tipo: 'utilizador' | 'condutor';
  perfil?: PerfilUtilizador;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Confirma que a conta continua activa: desactivar uma conta corta o acesso de imediato. */
  async validate(payload: PayloadJwt): Promise<Conta> {
    if (payload.tipo === 'condutor') {
      const condutor = await this.prisma.condutor.findUnique({
        where: { id: payload.sub },
        select: { activo: true },
      });
      if (!condutor?.activo) throw new UnauthorizedException();
      return { tipo: 'condutor', id: payload.sub };
    }
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: payload.sub },
      select: { activo: true, perfil: true },
    });
    if (!utilizador?.activo) throw new UnauthorizedException();
    return { tipo: 'utilizador', id: payload.sub, perfil: utilizador.perfil };
  }
}
