import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ContaCondutor } from '../comum/conta';
import { ApenasCondutor, ContaActual } from '../comum/decoradores';
import {
  EntregarDto,
  FalharDto,
  MudarEstadoCondutorDto,
  ProblemaDto,
} from '../pedidos/pedidos.dto';
import { PedidosService } from '../pedidos/pedidos.service';
import { PosicaoDto, TurnoDto } from './condutores.dto';
import { CondutoresService } from './condutores.service';

/**
 * API da app do condutor. A app guarda as acções offline e reenvia-as quando há rede;
 * cada acção leva um `idLocal` para que o reenvio não a repita.
 */
@ApiTags('app do condutor')
@ApiBearerAuth()
@ApenasCondutor()
@Controller('condutor')
export class AppCondutorController {
  constructor(
    private readonly condutores: CondutoresService,
    private readonly pedidos: PedidosService,
  ) {}

  @Get('eu')
  eu(@ContaActual() conta: ContaCondutor) {
    return this.condutores.obter(conta.id);
  }

  @Put('turno')
  turno(@ContaActual() conta: ContaCondutor, @Body() dto: TurnoDto) {
    return this.condutores.definirTurno(conta.id, dto.disponivel);
  }

  @Post('posicao')
  @HttpCode(200)
  posicao(@ContaActual() conta: ContaCondutor, @Body() dto: PosicaoDto) {
    return this.condutores.actualizarPosicao(conta.id, dto);
  }

  @Get('entregas')
  entregas(@ContaActual() conta: ContaCondutor) {
    return this.pedidos.entregasDoCondutor(conta.id);
  }

  /** aceitar → recolhi → a caminho → cheguei */
  @Post('entregas/:id/estado')
  @HttpCode(200)
  estado(
    @Param('id', ParseUUIDPipe) id: string,
    @ContaActual() conta: ContaCondutor,
    @Body() dto: MudarEstadoCondutorDto,
  ) {
    return this.pedidos.mudarEstadoCondutor(id, conta, dto);
  }

  @Post('entregas/:id/entregar')
  @HttpCode(200)
  entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @ContaActual() conta: ContaCondutor,
    @Body() dto: EntregarDto,
  ) {
    return this.pedidos.entregar(id, conta, dto);
  }

  @Post('entregas/:id/falhar')
  @HttpCode(200)
  falhar(
    @Param('id', ParseUUIDPipe) id: string,
    @ContaActual() conta: ContaCondutor,
    @Body() dto: FalharDto,
  ) {
    return this.pedidos.falhar(id, conta, dto);
  }

  @Post('entregas/:id/problemas')
  @HttpCode(200)
  problema(
    @Param('id', ParseUUIDPipe) id: string,
    @ContaActual() conta: ContaCondutor,
    @Body() dto: ProblemaDto,
  ) {
    return this.pedidos.reportarProblema(id, conta, dto);
  }

  @Get('resumo')
  resumo(@ContaActual() conta: ContaCondutor) {
    return this.condutores.resumoDoDia(conta.id);
  }
}
