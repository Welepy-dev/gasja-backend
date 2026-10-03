import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Publico } from '../comum/decoradores';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('saude')
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async verificar() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { estado: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ estado: 'sem base de dados' });
    }
  }
}
