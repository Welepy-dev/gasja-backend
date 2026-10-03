import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdaptadorSaida, ADAPTADORES_SAIDA, CANAIS } from '../canais/canal';

/**
 * Envia mensagens ao cliente pelo canal de origem do pedido, com SMS como reserva.
 * Tudo o que sai fica registado em MensagemSaida.
 */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ADAPTADORES_SAIDA) private readonly adaptadores: AdaptadorSaida[],
  ) {}

  async notificarCliente(params: {
    clienteId: string;
    canal: string;
    texto: string;
    pedidoId?: string;
  }) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: params.clienteId },
      include: { identidades: true },
    });
    if (!cliente) return;

    const tentativas: { canal: string; destino: string }[] = [];
    const identidade = cliente.identidades.find(
      (i) => i.canal === params.canal,
    );
    if (identidade && params.canal !== CANAIS.SMS) {
      tentativas.push({
        canal: params.canal,
        destino: identidade.identificador,
      });
    }
    tentativas.push({ canal: CANAIS.SMS, destino: cliente.telefone });

    for (const { canal, destino } of tentativas) {
      const adaptador = this.adaptadores.find((a) => a.canal === canal);
      if (!adaptador) continue;
      const registo = await this.prisma.mensagemSaida.create({
        data: {
          canal,
          destino,
          texto: params.texto,
          pedidoId: params.pedidoId,
        },
      });
      try {
        const { idExterno } = await adaptador.enviar(destino, params.texto);
        await this.prisma.mensagemSaida.update({
          where: { id: registo.id },
          data: { estado: 'ENVIADA', enviadaEm: new Date(), idExterno },
        });
        return;
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        this.logger.warn(
          `Falhou envio por ${canal} para ${destino}: ${mensagem}`,
        );
        await this.prisma.mensagemSaida.update({
          where: { id: registo.id },
          data: { estado: 'FALHOU', erro: mensagem },
        });
      }
    }
  }
}
