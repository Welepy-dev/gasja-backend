import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PerfilUtilizador } from '@prisma/client';
import type { Conta } from '../comum/conta';
import { ApenasCentral, ContaActual, Perfis } from '../comum/decoradores';
import { ActualizarCondutorDto, CriarCondutorDto } from './condutores.dto';
import { CondutoresService } from './condutores.service';

/** Gestão de condutores pela central. */
@ApiTags('condutores')
@ApiBearerAuth()
@ApenasCentral()
@Controller('condutores')
export class CondutoresController {
  constructor(private readonly condutores: CondutoresService) {}

  @Get()
  listar() {
    return this.condutores.listar();
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.condutores.obter(id);
  }

  @Get(':id/resumo')
  resumo(@Param('id', ParseUUIDPipe) id: string) {
    return this.condutores.resumoDoDia(id);
  }

  @Perfis(PerfilUtilizador.SUPERVISOR, PerfilUtilizador.ADMIN)
  @Post()
  criar(@Body() dto: CriarCondutorDto, @ContaActual() conta: Conta) {
    return this.condutores.criar(dto, conta);
  }

  @Perfis(PerfilUtilizador.SUPERVISOR, PerfilUtilizador.ADMIN)
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCondutorDto,
    @ContaActual() conta: Conta,
  ) {
    return this.condutores.actualizar(id, dto, conta);
  }
}
