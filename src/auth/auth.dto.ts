import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class LoginCentralDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginCondutorDto {
  @IsString()
  telefone: string;

  @IsString()
  @Length(4, 6)
  pin: string;
}
