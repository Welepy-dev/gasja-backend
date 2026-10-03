import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma } from '@prisma/client';
import { ApenasCentral, Publico } from '../comum/decoradores';
import { SegredoWebhook } from '../comum/segredo-webhook';
import { PagamentosService } from './pagamentos.service';

class CallbackMulticaixaDto {
  @IsString()
  referenciaExterna: string;

  @IsBoolean()
  pago: boolean;

  @IsOptional()
  @IsObject()
  dados?: Record<string, unknown>;
}

@ApiTags('pagamentos')
@Controller()
export class PagamentosController {
  constructor(
    private readonly pagamentos: PagamentosService,
    private readonly segredo: SegredoWebhook,
  ) {}

  /** Reenvia o pedido de pagamento Multicaixa Express ao cliente. */
  @ApiBearerAuth()
  @ApenasCentral()
  @Post('pedidos/:id/pagamentos/multicaixa')
  pedirMulticaixa(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagamentos.pedirMulticaixa(id);
  }

  @ApiBearerAuth()
  @ApenasCentral()
  @Get('pagamentos/numerario-por-conciliar')
  numerarioPorConciliar() {
    return this.pagamentos.numerarioPorConciliar();
  }

  /**
   * Callback do gateway. Formato provisório: quando o fornecedor for escolhido,
   * este endpoint passa a validar a assinatura dele e a traduzir o corpo.
   */
  @Publico()
  @Post('pagamentos/multicaixa/callback')
  @HttpCode(200)
  callback(
    @Headers('x-gasja-segredo') segredo: string | undefined,
    @Body() dto: CallbackMulticaixaDto,
  ) {
    this.segredo.validar(segredo);
    return this.pagamentos.confirmarMulticaixa(
      dto.referenciaExterna,
      dto.pago,
      dto.dados as Prisma.InputJsonValue,
    );
  }
}
