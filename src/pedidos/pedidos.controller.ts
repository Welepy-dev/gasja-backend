import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import type { Conta } from '../comum/conta';
import { ApenasCentral, ContaActual } from '../comum/decoradores';
import {
  AtribuirDto,
  CriarPedidoDto,
  FiltroPedidosDto,
  MotivoDto,
} from './pedidos.dto';
import { PedidosService } from './pedidos.service';

class LevantamentoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  valorRecebido?: number;
}

@ApiTags('pedidos')
@ApiBearerAuth()
@ApenasCentral()
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  /** Fila de pedidos. Filtros: estado (pode repetir), canal, condutorId, desde. */
  @Get()
  listar(@Query() filtro: FiltroPedidosDto) {
    return this.pedidos.listar(filtro);
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidos.obter(id);
  }

  @Get(':id/condutores-sugeridos')
  condutoresSugeridos(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidos.condutoresSugeridos(id);
  }

  @Post()
  criar(@Body() dto: CriarPedidoDto, @ContaActual() conta: Conta) {
    return this.pedidos.criar(dto, conta);
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  confirmar(
    @Param('id', ParseUUIDPipe) id: string,
    @ContaActual() conta: Conta,
  ) {
    return this.pedidos.confirmar(id, conta);
  }

  @Post(':id/atribuir')
  @HttpCode(200)
  atribuir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtribuirDto,
    @ContaActual() conta: Conta,
  ) {
    return this.pedidos.atribuir(id, dto.condutorId, conta);
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MotivoDto,
    @ContaActual() conta: Conta,
  ) {
    return this.pedidos.cancelar(id, conta, dto.motivo);
  }

  @Post(':id/levantamento')
  @HttpCode(200)
  levantamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LevantamentoDto,
    @ContaActual() conta: Conta,
  ) {
    return this.pedidos.concluirLevantamento(id, conta, dto.valorRecebido);
  }
}
