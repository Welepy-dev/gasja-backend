/**
 * Motor de preço do GásJá (puro, sem base de dados).
 *
 * Regras (documento "preço do transporte por distância e enquadramento legal"):
 * - a recarga é sempre cobrada ao preço oficial, numa linha própria;
 * - a taxa de entrega depende da zona de distância e do tipo de botija;
 * - cada botija adicional na mesma entrega paga uma percentagem da taxa (50% por omissão);
 * - fora de zona: taxa base + valor por km acima do início da zona, e exige orçamento confirmado;
 * - levantamento no ponto (zona 0) não paga taxa;
 * - não há preço dinâmico: nada aqui depende da hora, procura ou escassez.
 */

export interface ZonaPreco {
  id: string;
  numero: number;
  nome: string;
  /** Limite superior em km; null = sem limite (fora de zona). */
  kmMax: number | null;
  exigeOrcamento: boolean;
}

export interface TarifaPreco {
  zonaId: string;
  produtoId: string;
  valor: number;
  valorPorKm: number;
}

export interface ProdutoPreco {
  id: string;
  codigo: string;
  nome: string;
  precoRecarga: number;
}

export interface ItemEntrada {
  produto: ProdutoPreco;
  quantidade: number;
}

export interface LinhaRecarga {
  produtoId: string;
  codigo: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Orcamento {
  linhas: LinhaRecarga[];
  subtotalRecarga: number;
  zona: { id: string | null; numero: number; nome: string };
  distanciaKm: number | null;
  taxaEntrega: number;
  total: number;
  exigeOrcamento: boolean;
}

export class ErroPreco extends Error {}

/** Escolhe a zona pela distância. As zonas são ordenadas por kmMax (null no fim). */
export function zonaPorDistancia(
  zonas: ZonaPreco[],
  km: number,
): ZonaPreco | null {
  const ordenadas = [...zonas].sort(
    (a, b) => (a.kmMax ?? Infinity) - (b.kmMax ?? Infinity),
  );
  return ordenadas.find((z) => z.kmMax === null || km <= z.kmMax) ?? null;
}

/** Início da zona em km (o limite da zona anterior), usado no preço por km. */
export function inicioDaZona(zonas: ZonaPreco[], zona: ZonaPreco): number {
  const anteriores = zonas
    .filter((z) => z.kmMax !== null && z.numero < zona.numero)
    .map((z) => z.kmMax as number);
  return anteriores.length ? Math.max(...anteriores) : 0;
}

export function calcularOrcamento(params: {
  itens: ItemEntrada[];
  levantamento: boolean;
  zona: ZonaPreco | null;
  zonas: ZonaPreco[];
  tarifas: TarifaPreco[];
  distanciaKm: number | null;
  /** Percentagem da taxa paga por cada botija adicional (0–100). */
  percentagemAdicional: number;
}): Orcamento {
  const { itens, levantamento, zona, zonas, tarifas, distanciaKm } = params;

  if (!itens.length) throw new ErroPreco('O pedido não tem botijas.');
  for (const item of itens) {
    if (!Number.isInteger(item.quantidade) || item.quantidade < 1) {
      throw new ErroPreco(
        'A quantidade tem de ser um número inteiro positivo.',
      );
    }
  }

  const linhas: LinhaRecarga[] = itens.map(({ produto, quantidade }) => ({
    produtoId: produto.id,
    codigo: produto.codigo,
    nome: produto.nome,
    quantidade,
    precoUnitario: produto.precoRecarga,
    subtotal: produto.precoRecarga * quantidade,
  }));
  const subtotalRecarga = linhas.reduce((s, l) => s + l.subtotal, 0);

  if (levantamento) {
    return {
      linhas,
      subtotalRecarga,
      zona: { id: null, numero: 0, nome: 'Levantamento no ponto' },
      distanciaKm,
      taxaEntrega: 0,
      total: subtotalRecarga,
      exigeOrcamento: false,
    };
  }

  if (!zona) {
    throw new ErroPreco(
      'Não foi possível determinar a zona de entrega. Indique o bairro ou a localização.',
    );
  }

  // Uma taxa base por botija; a mais cara paga a 100%, as restantes a percentagem adicional.
  const taxasPorBotija: number[] = [];
  for (const { produto, quantidade } of itens) {
    const tarifa = tarifas.find(
      (t) => t.zonaId === zona.id && t.produtoId === produto.id,
    );
    if (!tarifa) {
      throw new ErroPreco(
        `Não há taxa de entrega configurada para ${produto.nome} na ${zona.nome}.`,
      );
    }
    for (let i = 0; i < quantidade; i++) taxasPorBotija.push(tarifa.valor);
  }
  taxasPorBotija.sort((a, b) => b - a);
  const fraccao = params.percentagemAdicional / 100;
  let taxaEntrega =
    taxasPorBotija[0] +
    taxasPorBotija.slice(1).reduce((s, v) => s + Math.round(v * fraccao), 0);

  // Fora de zona: acresce valor por km (uma vez, é a mesma viagem), pela tarifa mais cara.
  if (zona.kmMax === null && distanciaKm !== null) {
    const kmExtra = Math.max(0, distanciaKm - inicioDaZona(zonas, zona));
    const porKm = Math.max(
      ...itens.map(
        ({ produto }) =>
          tarifas.find(
            (t) => t.zonaId === zona.id && t.produtoId === produto.id,
          )?.valorPorKm ?? 0,
      ),
    );
    taxaEntrega += Math.round(kmExtra * porKm);
  }

  return {
    linhas,
    subtotalRecarga,
    zona: { id: zona.id, numero: zona.numero, nome: zona.nome },
    distanciaKm,
    taxaEntrega,
    total: subtotalRecarga + taxaEntrega,
    exigeOrcamento: zona.exigeOrcamento,
  };
}

/** "1 200 Kz", como nos designs (espaço como separador de milhar). */
export function formatarKz(valor: number): string {
  return `${valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Kz`;
}
