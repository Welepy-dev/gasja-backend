import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Conta } from '../comum/conta';
import { Coordenadas, distanciaKm } from '../comum/distancia';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularOrcamento,
  ErroPreco,
  Orcamento,
  zonaPorDistancia,
} from './motor-preco';
import {
  ActualizarProdutoDto,
  ActualizarZonaDto,
  BairroDto,
  DepositoDto,
  ItemDto,
  OrcamentoDto,
} from './precos.dto';

export const CHAVE_PERCENTAGEM_ADICIONAL = 'preco.percentagemBotijaAdicional';
const PERCENTAGEM_ADICIONAL_OMISSAO = 50;

export type OrcamentoComDeposito = Orcamento & { depositoId: string | null };

@Injectable()
export class PrecosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Calcula o preço de um pedido.
   * Zona: a do bairro (classificado pela central) quando existe; senão, pela distância
   * em linha recta ao depósito activo mais próximo.
   */
  async orcamentar(dto: OrcamentoDto): Promise<OrcamentoComDeposito> {
    const produtos = await this.prisma.produto.findMany({
      where: { activo: true },
    });
    const itens = dto.itens.map((item) => ({
      produto: this.encontrarProduto(produtos, item),
      quantidade: item.quantidade,
    }));

    let bairroId = dto.bairroId;
    let coords: Coordenadas | null =
      dto.lat !== undefined && dto.lng !== undefined
        ? { lat: dto.lat, lng: dto.lng }
        : null;
    if (dto.moradaId) {
      const morada = await this.prisma.morada.findUnique({
        where: { id: dto.moradaId },
      });
      if (!morada) throw new NotFoundException('Morada não encontrada.');
      bairroId ??= morada.bairroId ?? undefined;
      if (!coords && morada.lat !== null && morada.lng !== null) {
        coords = { lat: morada.lat, lng: morada.lng };
      }
    }
    const bairro = bairroId
      ? await this.prisma.bairro.findUnique({ where: { id: bairroId } })
      : null;
    if (!coords && bairro?.lat != null && bairro?.lng != null) {
      coords = { lat: bairro.lat, lng: bairro.lng };
    }

    let depositoId: string | null = null;
    let km: number | null = null;
    if (coords) {
      const depositos = await this.prisma.deposito.findMany({
        where: { activo: true },
      });
      for (const d of depositos) {
        const dist = distanciaKm(coords, d);
        if (km === null || dist < km) {
          km = dist;
          depositoId = d.id;
        }
      }
    }

    const zonas = await this.prisma.zonaEntrega.findMany({
      where: { activo: true },
    });
    const zona =
      (bairro?.zonaId && zonas.find((z) => z.id === bairro.zonaId)) ||
      (km !== null ? zonaPorDistancia(zonas, km) : null);
    const tarifas = await this.prisma.tarifaEntrega.findMany({
      where: { zonaId: { in: zonas.map((z) => z.id) } },
    });

    try {
      const orcamento = calcularOrcamento({
        itens,
        levantamento: dto.levantamento ?? false,
        zona,
        zonas,
        tarifas,
        distanciaKm: km,
        percentagemAdicional: await this.percentagemAdicional(),
      });
      return { ...orcamento, depositoId };
    } catch (erro) {
      if (erro instanceof ErroPreco)
        throw new BadRequestException(erro.message);
      throw erro;
    }
  }

  private encontrarProduto<
    T extends { id: string; codigo: string; pesoKg: number },
  >(produtos: T[], item: ItemDto): T {
    const produto = produtos.find(
      (p) =>
        (item.produtoId && p.id === item.produtoId) ||
        (item.codigo && p.codigo === item.codigo.toUpperCase()) ||
        (item.pesoKg && p.pesoKg === item.pesoKg),
    );
    if (!produto)
      throw new BadRequestException('Tipo de botija desconhecido ou inactivo.');
    return produto;
  }

  async percentagemAdicional(): Promise<number> {
    const c = await this.prisma.configuracao.findUnique({
      where: { chave: CHAVE_PERCENTAGEM_ADICIONAL },
    });
    return c ? Number(c.valor) : PERCENTAGEM_ADICIONAL_OMISSAO;
  }

  // ---------- Tabela de preços (pública dentro da central) ----------

  async tabela() {
    const [produtos, zonas] = await Promise.all([
      this.prisma.produto.findMany({ orderBy: { pesoKg: 'asc' } }),
      this.prisma.zonaEntrega.findMany({
        orderBy: { numero: 'asc' },
        include: { tarifas: true },
      }),
    ]);
    return {
      produtos,
      zonas,
      percentagemBotijaAdicional: await this.percentagemAdicional(),
    };
  }

  async actualizarProduto(id: string, dto: ActualizarProdutoDto, conta: Conta) {
    const antes = await this.prisma.produto.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Produto não encontrado.');
    const depois = await this.prisma.produto.update({
      where: { id },
      data: dto,
    });
    await this.auditoria.registar(
      conta,
      'preco.produto.actualizar',
      'Produto',
      id,
      {
        antes: {
          precoRecarga: antes.precoRecarga,
          activo: antes.activo,
          nome: antes.nome,
        },
        depois: { ...dto },
      },
    );
    return depois;
  }

  async actualizarZona(id: string, dto: ActualizarZonaDto, conta: Conta) {
    const antes = await this.prisma.zonaEntrega.findUnique({
      where: { id },
      include: { tarifas: true },
    });
    if (!antes) throw new NotFoundException('Zona não encontrada.');
    const { tarifas, ...campos } = dto;
    const depois = await this.prisma.$transaction(async (tx) => {
      await tx.zonaEntrega.update({ where: { id }, data: campos });
      for (const t of tarifas ?? []) {
        await tx.tarifaEntrega.upsert({
          where: { zonaId_produtoId: { zonaId: id, produtoId: t.produtoId } },
          create: {
            zonaId: id,
            produtoId: t.produtoId,
            valor: t.valor,
            valorPorKm: t.valorPorKm ?? 0,
          },
          update: { valor: t.valor, valorPorKm: t.valorPorKm ?? 0 },
        });
      }
      await this.auditoria.registar(
        conta,
        'preco.zona.actualizar',
        'ZonaEntrega',
        id,
        { antes, alteracoes: dto } as unknown as Prisma.InputJsonValue,
        tx,
      );
      return tx.zonaEntrega.findUnique({
        where: { id },
        include: { tarifas: true },
      });
    });
    return depois;
  }

  async definirPercentagemAdicional(valor: number, conta: Conta) {
    const anterior = await this.percentagemAdicional();
    await this.prisma.configuracao.upsert({
      where: { chave: CHAVE_PERCENTAGEM_ADICIONAL },
      create: { chave: CHAVE_PERCENTAGEM_ADICIONAL, valor: String(valor) },
      update: { valor: String(valor) },
    });
    await this.auditoria.registar(
      conta,
      'preco.configuracao',
      'Configuracao',
      CHAVE_PERCENTAGEM_ADICIONAL,
      {
        antes: anterior,
        depois: valor,
      },
    );
    return { percentagemBotijaAdicional: valor };
  }

  // ---------- Bairros e depósitos ----------

  bairros(municipio?: string) {
    return this.prisma.bairro.findMany({
      where: municipio ? { municipio } : undefined,
      orderBy: [{ municipio: 'asc' }, { nome: 'asc' }],
      include: { zona: { select: { numero: true, nome: true } } },
    });
  }

  async criarBairro(dto: BairroDto, conta: Conta) {
    const bairro = await this.prisma.bairro.create({ data: dto });
    await this.auditoria.registar(conta, 'bairro.criar', 'Bairro', bairro.id, {
      ...dto,
    });
    return bairro;
  }

  async actualizarBairro(id: string, dto: Partial<BairroDto>, conta: Conta) {
    const bairro = await this.prisma.bairro.update({
      where: { id },
      data: dto,
    });
    await this.auditoria.registar(conta, 'bairro.actualizar', 'Bairro', id, {
      ...dto,
    });
    return bairro;
  }

  depositos() {
    return this.prisma.deposito.findMany({ orderBy: { nome: 'asc' } });
  }

  async criarDeposito(dto: DepositoDto, conta: Conta) {
    const deposito = await this.prisma.deposito.create({ data: dto });
    await this.auditoria.registar(
      conta,
      'deposito.criar',
      'Deposito',
      deposito.id,
      { ...dto },
    );
    return deposito;
  }

  async actualizarDeposito(
    id: string,
    dto: Partial<DepositoDto>,
    conta: Conta,
  ) {
    const deposito = await this.prisma.deposito.update({
      where: { id },
      data: dto,
    });
    await this.auditoria.registar(
      conta,
      'deposito.actualizar',
      'Deposito',
      id,
      { ...dto },
    );
    return deposito;
  }
}
