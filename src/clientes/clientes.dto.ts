import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class MoradaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsUUID()
  bairroId?: string;

  @IsString()
  @MinLength(2)
  descricao: string;

  /** Ponto de referência ("portão azul ao lado da cantina"). Em Luanda conta mais que a rua. */
  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}

export class ActualizarMoradaDto extends PartialType(MoradaDto) {
  @IsOptional()
  @IsBoolean()
  gpsConfirmado?: boolean;
}

export class CriarClienteDto {
  @IsString()
  telefone: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
