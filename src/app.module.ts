import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { CanaisModule } from './canais/canais.module';
import { ClientesModule } from './clientes/clientes.module';
import { ComumModule } from './comum/comum.module';
import { CondutoresModule } from './condutores/condutores.module';
import { validarAmbiente } from './config/configuracao';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { PagamentosModule } from './pagamentos/pagamentos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PrecosModule } from './precos/precos.module';
import { PrismaModule } from './prisma/prisma.module';
import { SaudeController } from './saude/saude.controller';
import { TempoRealModule } from './tempo-real/tempo-real.module';
import { UtilizadoresModule } from './utilizadores/utilizadores.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarAmbiente }),
    PrismaModule,
    ComumModule,
    AuditoriaModule,
    TempoRealModule,
    NotificacoesModule,
    AuthModule,
    UtilizadoresModule,
    ClientesModule,
    PrecosModule,
    PagamentosModule,
    PedidosModule,
    CondutoresModule,
    CanaisModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
