import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApenasCentral } from '../comum/decoradores';
import {
  ActualizarClienteDto,
  ActualizarMoradaDto,
  CriarClienteDto,
  MoradaDto,
} from './clientes.dto';
import { ClientesService } from './clientes.service';

@ApiTags('clientes')
@ApiBearerAuth()
@ApenasCentral()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** Pesquisa por nome ou telefone. */
  @Get()
  listar(@Query('q') q?: string) {
    return this.clientes.listar(q);
  }

  /** Usado pelo pop-up de chamada: devolve a ficha ou null se o número é novo. */
  @Get('telefone/:telefone')
  porTelefone(@Param('telefone') telefone: string) {
    return this.clientes.porTelefone(telefone);
  }

  @Get(':id')
  ficha(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.ficha(id);
  }

  @Post()
  criar(@Body() dto: CriarClienteDto) {
    return this.clientes.criar(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.clientes.actualizar(id, dto);
  }

  @Post(':id/moradas')
  adicionarMorada(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoradaDto,
  ) {
    return this.clientes.adicionarMorada(id, dto);
  }

  @Patch(':id/moradas/:moradaId')
  actualizarMorada(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moradaId', ParseUUIDPipe) moradaId: string,
    @Body() dto: ActualizarMoradaDto,
  ) {
    return this.clientes.actualizarMorada(id, moradaId, dto);
  }
}
