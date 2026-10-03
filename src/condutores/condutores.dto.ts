import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CriarCondutorDto {
  @IsString()
  nome: string;

  @IsString()
  telefone: string;

  /** PIN de 4 a 6 dígitos para entrar na app. */
  @Matches(/^\d{4,6}$/, { message: 'O PIN tem de ter 4 a 6 dígitos.' })
  pin: string;

  @IsOptional()
  @IsString()
  veiculo?: string;

  @IsOptional()
  @IsString()
  matricula?: string;
}

export class ActualizarCondutorDto extends PartialType(CriarCondutorDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class TurnoDto {
  @IsBoolean()
  disponivel: boolean;
}

export class PosicaoDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
