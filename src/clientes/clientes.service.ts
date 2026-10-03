import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CANAIS_POR_TELEFONE } from '../canais/canal';
import { normalizarTelefone } from '../comum/telefone';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarClienteDto,
  ActualizarMoradaDto,
  CriarClienteDto,
  MoradaDto,
} from './clientes.dto';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  telefoneValidoOuNull(telefone: string): string | null {
    return normalizarTelefone(telefone);
  }

  telefoneValido(telefone: string): string {
    const numero = normalizarTelefone(telefone);
    if (!numero) throw new BadRequestException('Número de telefone inválido.');
    return numero;
  }

  /** O cliente fica registado pelo número na primeira vez que contacta, seja qual for o canal. */
  async obterOuCriarPorTelefone(
    telefone: string,
    nome?: string,
    tx: Tx = this.prisma,
  ) {
    const numero = this.telefoneValido(telefone);
    return tx.cliente.upsert({
      where: { telefone: numero },
      create: { telefone: numero, nome },
      update: nome ? { nome } : {},
    });
  }

  /**
   * Encontra o cliente de uma mensagem: primeiro pela identidade ligada ao canal,
   * depois pelo telefone (canais em que o remetente é um número).
   * Cria o cliente e a ligação quando o remetente é um telefone válido.
   */
  async identificar(canal: string, remetente: string, tx: Tx = this.prisma) {
    const identidade = await tx.identidadeCanal.findUnique({
      where: { canal_identificador: { canal, identificador: remetente } },
      include: { cliente: true },
    });
    if (identidade) return identidade.cliente;

    const numero = CANAIS_POR_TELEFONE.includes(canal)
      ? normalizarTelefone(remetente)
      : null;
    if (!numero) return null;
    const cliente = await this.obterOuCriarPorTelefone(numero, undefined, tx);
    await tx.identidadeCanal.upsert({
      where: { canal_identificador: { canal, identificador: remetente } },
      create: { canal, identificador: remetente, clienteId: cliente.id },
      update: {},
    });
    return cliente;
  }

  listar(q?: string) {
    const termo = q?.trim();
    const numero = termo ? normalizarTelefone(termo) : null;
    return this.prisma.cliente.findMany({
      where: termo
        ? {
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { telefone: { contains: numero ?? termo.replace(/\s/g, '') } },
            ],
          }
        : undefined,
      orderBy: { actualizadoEm: 'desc' },
      take: 50,
      include: { _count: { select: { pedidos: true } } },
    });
  }

  async porTelefone(telefone: string) {
    const numero = this.telefoneValido(telefone);
    const cliente = await this.prisma.cliente.findUnique({
      where: { telefone: numero },
    });
    return cliente ? this.ficha(cliente.id) : null;
  }

  /** Ficha do cliente: moradas, histórico, botija habitual e canal preferido. */
  async ficha(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        moradas: { include: { bairro: true }, orderBy: { criadoEm: 'asc' } },
        identidades: true,
        pedidos: {
          orderBy: { criadoEm: 'desc' },
          take: 20,
          include: { itens: { include: { produto: true } } },
        },
        _count: { select: { pedidos: true } },
      },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');

    const contagem = <T extends string>(valores: T[]) =>
      valores.reduce<Record<string, number>>(
        (acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc),
        {},
      );
    const maisFrequente = (c: Record<string, number>) =>
      Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      ...cliente,
      canalPreferido: maisFrequente(
        contagem(cliente.pedidos.map((p) => p.canal)),
      ),
      botijaHabitual: maisFrequente(
        contagem(
          cliente.pedidos.flatMap((p) => p.itens.map((i) => i.produto.codigo)),
        ),
      ),
    };
  }

  async criar(dto: CriarClienteDto) {
    const cliente = await this.obterOuCriarPorTelefone(dto.telefone, dto.nome);
    if (dto.notas) {
      await this.prisma.cliente.update({
        where: { id: cliente.id },
        data: { notas: dto.notas },
      });
    }
    return this.ficha(cliente.id);
  }

  async actualizar(id: string, dto: ActualizarClienteDto) {
    await this.existe(id);
    await this.prisma.cliente.update({ where: { id }, data: dto });
    return this.ficha(id);
  }

  async adicionarMorada(
    clienteId: string,
    dto: MoradaDto,
    tx: Tx = this.prisma,
  ) {
    return tx.morada.create({ data: { ...dto, clienteId } });
  }

  async actualizarMorada(
    clienteId: string,
    moradaId: string,
    dto: ActualizarMoradaDto,
  ) {
    const morada = await this.prisma.morada.findFirst({
      where: { id: moradaId, clienteId },
    });
    if (!morada) throw new NotFoundException('Morada não encontrada.');
    return this.prisma.morada.update({ where: { id: moradaId }, data: dto });
  }

  private async existe(id: string) {
    const c = await this.prisma.cliente.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
  }
}
