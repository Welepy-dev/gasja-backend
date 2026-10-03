import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { normalizarTelefone } from '../comum/telefone';
import { PrismaService } from '../prisma/prisma.service';
import { PayloadJwt } from './jwt.strategy';

const CREDENCIAIS_INVALIDAS = 'Credenciais inválidas.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginCentral(email: string, password: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (
      !utilizador?.activo ||
      !(await bcrypt.compare(password, utilizador.passwordHash))
    ) {
      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }
    const payload: PayloadJwt = {
      sub: utilizador.id,
      tipo: 'utilizador',
      perfil: utilizador.perfil,
    };
    return {
      token: await this.jwt.signAsync(payload),
      utilizador: {
        id: utilizador.id,
        nome: utilizador.nome,
        email: utilizador.email,
        perfil: utilizador.perfil,
      },
    };
  }

  async loginCondutor(telefone: string, pin: string) {
    const numero = normalizarTelefone(telefone);
    const condutor = numero
      ? await this.prisma.condutor.findUnique({ where: { telefone: numero } })
      : null;
    if (!condutor?.activo || !(await bcrypt.compare(pin, condutor.pinHash))) {
      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }
    const payload: PayloadJwt = { sub: condutor.id, tipo: 'condutor' };
    return {
      // O condutor trabalha offline durante o turno; o token dura mais.
      token: await this.jwt.signAsync(payload, { expiresIn: '7d' }),
      condutor: {
        id: condutor.id,
        nome: condutor.nome,
        telefone: condutor.telefone,
        veiculo: condutor.veiculo,
        matricula: condutor.matricula,
      },
    };
  }
}
