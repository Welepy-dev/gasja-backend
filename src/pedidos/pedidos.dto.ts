import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoPedido, MetodoPagamento, TipoEntrega } from '@prisma/client';
import { MoradaDto } from '../clientes/clientes.dto';
import { ItemDto } from '../precos/precos.dto';

/** Pedido criado pela central (chamada, ou SMS validado pela central). */
export class CriarPedidoDto {
  /** Cliente existente, ou em alternativa o telefone (o cliente é criado se for novo). */
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  nomeCliente?: string;

  /** Morada guardada, ou uma nova morada. Não é preciso para levantamento no ponto. */
  @IsOptional()
  @IsUUID()
  moradaId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoradaDto)
  novaMorada?: MoradaDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  itens: ItemDto[];

  @IsEnum(MetodoPagamento)
  metodoPagamento: MetodoPagamento;

  @IsOptional()
  @IsEnum(TipoEntrega)
  tipoEntrega?: TipoEntrega;

  @IsOptional()
  @IsBoolean()
  trocaVazia?: boolean;

  @IsOptional()
  @IsString()
  nota?: string;

  /** Canal de origem. Por omissão "chamada". */
  @IsOptional()
  @IsString()
  canal?: string;

  /**
   * true quando o cliente já disse "sim" ao preço total (na chamada).
   * false: o sistema envia SMS com o preço e espera pelo SIM.
   */
  @IsOptional()
  @IsBoolean()
  confirmadoPeloCliente?: boolean;

  /** Mensagem da caixa de entrada que este pedido resolve. */
  @IsOptional()
  @IsUUID()
  mensagemOrigemId?: string;

  /** Atribuir logo a um condutor ("Criar pedido e atribuir"). */
  @IsOptional()
  @IsUUID()
  condutorId?: string;
}

export class FiltroPedidosDto {
  @IsOptional()
  @IsEnum(EstadoPedido, { each: true })
  estado?: EstadoPedido | EstadoPedido[];

  @IsOptional()
  @IsString()
  canal?: string;

  @IsOptional()
  @IsUUID()
  condutorId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;
}

export class AtribuirDto {
  @IsUUID()
  condutorId: string;
}

export class MotivoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

/** Campos comuns às acções feitas pela app do condutor, que pode estar offline. */
export class AccaoCondutorDto {
  /** Id gerado no telemóvel: a mesma acção enviada duas vezes só conta uma. */
  @IsOptional()
  @IsString()
  @Length(8, 64)
  idLocal?: string;

  /** Quando aconteceu no terreno. */
  @IsOptional()
  @IsDateString()
  ocorridoEm?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}

export class MudarEstadoCondutorDto extends AccaoCondutorDto {
  @IsEnum([
    EstadoPedido.ACEITE,
    EstadoPedido.RECOLHIDO,
    EstadoPedido.A_CAMINHO,
    EstadoPedido.NO_LOCAL,
  ])
  estado: EstadoPedido;
}

export class EntregarDto extends AccaoCondutorDto {
  /** Numerário: valor recebido (tem de ser o total). */
  @IsOptional()
  @IsInt()
  @Min(0)
  valorRecebido?: number;

  /** Código que o cliente recebeu por SMS. */
  @IsOptional()
  @IsString()
  codigoEntrega?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  vaziasRecolhidas?: number;
}

export class FalharDto extends AccaoCondutorDto {
  @IsString()
  motivo: string;
}

export const TIPOS_PROBLEMA = [
  'CLIENTE_AUSENTE',
  'MORADA_NAO_ENCONTRADA',
  'SEM_STOCK',
  'CLIENTE_RECUSOU',
  'BOTIJA_DANIFICADA',
  'OUTRO',
] as const;

export class ProblemaDto extends AccaoCondutorDto {
  @IsEnum(TIPOS_PROBLEMA)
  tipo: (typeof TIPOS_PROBLEMA)[number];

  @IsOptional()
  @IsString()
  nota?: string;
}
