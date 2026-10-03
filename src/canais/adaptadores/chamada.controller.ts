import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Publico } from '../../comum/decoradores';
import { SegredoWebhook } from '../../comum/segredo-webhook';
import { CanaisService } from '../canais.service';

/** Evento enviado pelo PBX (Asterisk/FreePBX ou serviço cloud) quando há uma chamada para a central. */
class EventoChamadaDto {
  @IsString()
  numero: string;

  @IsIn(['a_tocar', 'atendida', 'terminada'])
  estado: 'a_tocar' | 'atendida' | 'terminada';

  @IsOptional()
  @IsString()
  chamadaId?: string;

  /** Extensão do operador que atendeu. */
  @IsOptional()
  @IsString()
  extensao?: string;
}

@ApiTags('canais')
@Controller('canais/chamada')
export class ChamadaController {
  constructor(
    private readonly canais: CanaisService,
    private readonly segredo: SegredoWebhook,
  ) {}

  /** Abre o pop-up no painel com a ficha do cliente. O pedido em si é criado pelo operador. */
  @Publico()
  @Post('eventos')
  @HttpCode(200)
  evento(
    @Headers('x-gasja-segredo') segredo: string | undefined,
    @Body() dto: EventoChamadaDto,
  ) {
    this.segredo.validar(segredo);
    return this.canais.chamadaRecebida(dto);
  }
}
