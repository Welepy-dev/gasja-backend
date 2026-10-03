import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Conta } from '../comum/conta';
import { ContaActual, Publico } from '../comum/decoradores';
import { LoginCentralDto, LoginCondutorDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('central/login')
  @HttpCode(200)
  loginCentral(@Body() dto: LoginCentralDto) {
    return this.auth.loginCentral(dto.email, dto.password);
  }

  @Publico()
  @Post('condutor/login')
  @HttpCode(200)
  loginCondutor(@Body() dto: LoginCondutorDto) {
    return this.auth.loginCondutor(dto.telefone, dto.pin);
  }

  @ApiBearerAuth()
  @Get('eu')
  eu(@ContaActual() conta: Conta) {
    return conta;
  }
}
