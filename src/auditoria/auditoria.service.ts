import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Conta } from '../comum/conta';
import { PrismaService } from '../prisma/prisma.service';

type Cliente = Prisma.TransactionClient | PrismaService;

/** Regista quem mudou o quê. Pedidos e preços são sempre auditados. */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registar(
    actor: Conta | null,
    accao: string,
    entidade: string,
    entidadeId: string | null,
    dados?: Prisma.InputJsonValue,
    tx: Cliente = this.prisma,
  ) {
    await tx.registoAuditoria.create({
      data: {
        actorTipo: actor?.tipo ?? 'sistema',
        actorId: actor?.id,
        accao,
        entidade,
        entidadeId,
        dados,
      },
    });
  }
}
