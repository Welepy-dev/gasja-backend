import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { Publico } from '../../comum/decoradores';
import { SegredoWebhook } from '../../comum/segredo-webhook';
import { CANAIS } from '../canal';
import { CanaisService } from '../canais.service';

/**
 * Formato provisório do webhook do agregador de SMS (A2P).
 * Quando o agregador for escolhido, este adaptador traduz o formato dele para este.
 */
class SmsRecebidoDto {
  @IsString()
  de: string;

  @IsString()
  @MaxLength(1600)
  texto: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsDateString()
  recebidaEm?: string;
}

@ApiTags('canais')
@Controller('canais/sms')
export class SmsController {
  constructor(
    private readonly canais: CanaisService,
    private readonly segredo: SegredoWebhook,
  ) {}

  @Publico()
  @Post('webhook')
  @HttpCode(200)
  async receber(
    @Headers('x-gasja-segredo') segredo: string | undefined,
    @Body() dto: SmsRecebidoDto,
  ) {
    this.segredo.validar(segredo);
    const mensagem = await this.canais.receber({
      canal: CANAIS.SMS,
      remetente: dto.de,
      texto: dto.texto,
      idExterno: dto.id,
      recebidaEm: dto.recebidaEm ? new Date(dto.recebidaEm) : undefined,
    });
    return { id: mensagem.id, estado: mensagem.estado };
  }
}
