import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadoMensagem } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { Conta } from '../comum/conta';
import { ApenasCentral, ContaActual } from '../comum/decoradores';
import { CanaisService } from './canais.service';

class FiltroMensagensDto {
  @IsOptional()
  @IsEnum(EstadoMensagem)
  estado?: EstadoMensagem;

  @IsOptional()
  @IsString()
  canal?: string;
}

/**
 * Caixa de mensagens da central, com filtro por canal.
 * Para converter uma mensagem em pedido: POST /pedidos com `mensagemOrigemId`.
 */
@ApiTags('mensagens')
@ApiBearerAuth()
@ApenasCentral()
@Controller('mensagens')
export class MensagensController {
  constructor(private readonly canais: CanaisService) {}

  @Get()
  listar(@Query() filtro: FiltroMensagensDto) {
    return this.canais.listar(filtro);
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.canais.obter(id);
  }

  @Post(':id/ignorar')
  @HttpCode(200)
  ignorar(@Param('id', ParseUUIDPipe) id: string, @ContaActual() conta: Conta) {
    return this.canais.ignorar(id, conta);
  }
}
