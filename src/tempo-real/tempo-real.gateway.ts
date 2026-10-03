import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PayloadJwt } from '../auth/jwt.strategy';

/**
 * Eventos em tempo real (Socket.IO, namespace /tempo-real).
 * O cliente liga-se com `auth: { token }`.
 * - Contas da central entram na sala "central": pedidos, mensagens, chamadas, problemas.
 * - Cada condutor entra na sua sala: entregas atribuídas ou retiradas.
 */
@WebSocketGateway({ namespace: '/tempo-real', cors: { origin: true } })
export class TempoRealGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TempoRealGateway.name);

  @WebSocketServer()
  private readonly servidor: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace(/^Bearer /, '');
      const payload = await this.jwt.verifyAsync<PayloadJwt>(token ?? '');
      await socket.join(
        payload.tipo === 'condutor' ? `condutor:${payload.sub}` : 'central',
      );
    } catch {
      this.logger.debug('Ligação recusada: token inválido');
      socket.disconnect(true);
    }
  }

  paraCentral(evento: string, dados: unknown) {
    this.servidor?.to('central').emit(evento, dados);
  }

  paraCondutor(condutorId: string, evento: string, dados: unknown) {
    this.servidor?.to(`condutor:${condutorId}`).emit(evento, dados);
  }
}
