import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { PerfilUtilizador } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Conta } from '../comum/conta';
import { ApenasCentral, ContaActual, Perfis } from '../comum/decoradores';
import { PrismaService } from '../prisma/prisma.service';

class CriarUtilizadorDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(PerfilUtilizador)
  perfil: PerfilUtilizador;
}

class ActualizarUtilizadorDto extends PartialType(CriarUtilizadorDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

const PUBLICO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  activo: true,
  criadoEm: true,
} as const;

/** Contas pessoais da central (operador, supervisor, admin). Só o admin gere. */
@ApiTags('utilizadores')
@ApiBearerAuth()
@ApenasCentral()
@Perfis(PerfilUtilizador.ADMIN)
@Controller('utilizadores')
export class UtilizadoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  listar() {
    return this.prisma.utilizador.findMany({
      select: PUBLICO,
      orderBy: { nome: 'asc' },
    });
  }

  @Post()
  async criar(@Body() dto: CriarUtilizadorDto, @ContaActual() conta: Conta) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.utilizador.findUnique({ where: { email } })) {
      throw new ConflictException('Já existe uma conta com este email.');
    }
    const utilizador = await this.prisma.utilizador.create({
      data: {
        nome: dto.nome,
        email,
        perfil: dto.perfil,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select: PUBLICO,
    });
    await this.auditoria.registar(
      conta,
      'utilizador.criar',
      'Utilizador',
      utilizador.id,
      {
        email,
        perfil: dto.perfil,
      },
    );
    return utilizador;
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUtilizadorDto,
    @ContaActual() conta: Conta,
  ) {
    const { password, email, ...dados } = dto;
    const utilizador = await this.prisma.utilizador.update({
      where: { id },
      data: {
        ...dados,
        email: email?.toLowerCase(),
        passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
      },
      select: PUBLICO,
    });
    await this.auditoria.registar(
      conta,
      'utilizador.actualizar',
      'Utilizador',
      id,
      {
        ...dados,
        passwordAlterada: Boolean(password),
      },
    );
    return utilizador;
  }
}
