import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PerfilUtilizador } from '@prisma/client';
import type { Conta } from '../comum/conta';
import { ApenasCentral, ContaActual, Perfis } from '../comum/decoradores';
import {
  ActualizarBairroDto,
  ActualizarDepositoDto,
  ActualizarProdutoDto,
  ActualizarZonaDto,
  BairroDto,
  ConfiguracaoPrecoDto,
  DepositoDto,
  OrcamentoDto,
} from './precos.dto';
import { PrecosService } from './precos.service';

const GESTAO = [PerfilUtilizador.SUPERVISOR, PerfilUtilizador.ADMIN];

@ApiTags('precos')
@ApiBearerAuth()
@ApenasCentral()
@Controller()
export class PrecosController {
  constructor(private readonly precos: PrecosService) {}

  /** Preço ao vivo enquanto o operador fala com o cliente. */
  @Post('precos/orcamento')
  @HttpCode(200)
  orcamento(@Body() dto: OrcamentoDto) {
    return this.precos.orcamentar(dto);
  }

  @Get('precos')
  tabela() {
    return this.precos.tabela();
  }

  @Perfis(...GESTAO)
  @Patch('precos/produtos/:id')
  actualizarProduto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProdutoDto,
    @ContaActual() conta: Conta,
  ) {
    return this.precos.actualizarProduto(id, dto, conta);
  }

  @Perfis(...GESTAO)
  @Patch('precos/zonas/:id')
  actualizarZona(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarZonaDto,
    @ContaActual() conta: Conta,
  ) {
    return this.precos.actualizarZona(id, dto, conta);
  }

  @Perfis(...GESTAO)
  @Put('precos/configuracao')
  configuracao(@Body() dto: ConfiguracaoPrecoDto, @ContaActual() conta: Conta) {
    return this.precos.definirPercentagemAdicional(
      dto.percentagemBotijaAdicional,
      conta,
    );
  }

  @Get('bairros')
  bairros(@Query('municipio') municipio?: string) {
    return this.precos.bairros(municipio);
  }

  @Perfis(...GESTAO)
  @Post('bairros')
  criarBairro(@Body() dto: BairroDto, @ContaActual() conta: Conta) {
    return this.precos.criarBairro(dto, conta);
  }

  @Perfis(...GESTAO)
  @Patch('bairros/:id')
  actualizarBairro(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarBairroDto,
    @ContaActual() conta: Conta,
  ) {
    return this.precos.actualizarBairro(id, dto, conta);
  }

  @Get('depositos')
  depositos() {
    return this.precos.depositos();
  }

  @Perfis(...GESTAO)
  @Post('depositos')
  criarDeposito(@Body() dto: DepositoDto, @ContaActual() conta: Conta) {
    return this.precos.criarDeposito(dto, conta);
  }

  @Perfis(...GESTAO)
  @Patch('depositos/:id')
  actualizarDeposito(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarDepositoDto,
    @ContaActual() conta: Conta,
  ) {
    return this.precos.actualizarDeposito(id, dto, conta);
  }
}
