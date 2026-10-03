import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemDto {
  /** Id do produto, ou em alternativa o código ("12KG") ou o peso (12). */
  @IsOptional()
  @IsUUID()
  produtoId?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsInt()
  pesoKg?: number;

  @IsInt()
  @Min(1)
  @Max(20)
  quantidade: number;
}

export class OrcamentoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  itens: ItemDto[];

  @IsOptional()
  @IsBoolean()
  levantamento?: boolean;

  @IsOptional()
  @IsUUID()
  moradaId?: string;

  @IsOptional()
  @IsUUID()
  bairroId?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}

export class ActualizarProdutoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  precoRecarga?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class TarifaDto {
  @IsUUID()
  produtoId: string;

  @IsInt()
  @Min(0)
  valor: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorPorKm?: number;
}

export class ActualizarZonaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  kmMax?: number;

  @IsOptional()
  @IsBoolean()
  exigeOrcamento?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TarifaDto)
  tarifas?: TarifaDto[];
}

export class BairroDto {
  @IsString()
  nome: string;

  @IsString()
  municipio: string;

  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DepositoDto {
  @IsString()
  nome: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ConfiguracaoPrecoDto {
  @IsInt()
  @Min(0)
  @Max(100)
  percentagemBotijaAdicional: number;
}

export class ActualizarBairroDto extends PartialType(BairroDto) {}
export class ActualizarDepositoDto extends PartialType(DepositoDto) {}
