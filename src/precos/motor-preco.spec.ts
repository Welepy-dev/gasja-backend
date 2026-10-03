import {
  calcularOrcamento,
  ErroPreco,
  formatarKz,
  TarifaPreco,
  ZonaPreco,
  zonaPorDistancia,
} from './motor-preco';

const b12 = {
  id: 'p12',
  codigo: '12KG',
  nome: 'Botija 12 kg',
  precoRecarga: 1200,
};
const b51 = {
  id: 'p51',
  codigo: '51KG',
  nome: 'Botija 51 kg',
  precoRecarga: 5100,
};

const zonas: ZonaPreco[] = [
  { id: 'z1', numero: 1, nome: 'Zona 1', kmMax: 3, exigeOrcamento: false },
  { id: 'z2', numero: 2, nome: 'Zona 2', kmMax: 7, exigeOrcamento: false },
  { id: 'z3', numero: 3, nome: 'Zona 3', kmMax: 12, exigeOrcamento: false },
  { id: 'z4', numero: 4, nome: 'Zona 4', kmMax: 20, exigeOrcamento: false },
  {
    id: 'z5',
    numero: 5,
    nome: 'Fora de zona',
    kmMax: null,
    exigeOrcamento: true,
  },
];

const tabela: Record<string, [number, number, number?]> = {
  z1: [1000, 2000],
  z2: [1500, 2500],
  z3: [2000, 3500],
  z4: [3000, 5000],
  z5: [3000, 5000],
};
const tarifas: TarifaPreco[] = Object.entries(tabela).flatMap(
  ([zonaId, [v12, v51]]) => [
    {
      zonaId,
      produtoId: 'p12',
      valor: v12,
      valorPorKm: zonaId === 'z5' ? 150 : 0,
    },
    {
      zonaId,
      produtoId: 'p51',
      valor: v51,
      valorPorKm: zonaId === 'z5' ? 250 : 0,
    },
  ],
);

const base = { zonas, tarifas, percentagemAdicional: 50, levantamento: false };

describe('zonaPorDistancia', () => {
  it.each([
    [0.5, 1],
    [3, 1],
    [3.1, 2],
    [7, 2],
    [11.9, 3],
    [20, 4],
    [35, 5],
  ])('%s km -> zona %s', (km, numero) => {
    expect(zonaPorDistancia(zonas, km)?.numero).toBe(numero);
  });
});

describe('calcularOrcamento', () => {
  it('1 × 12 kg na zona 2: 1 200 + 1 500 = 2 700 Kz (exemplo do documento de preço)', () => {
    const o = calcularOrcamento({
      ...base,
      itens: [{ produto: b12, quantidade: 1 }],
      zona: zonas[1],
      distanciaKm: 5,
    });
    expect(o.subtotalRecarga).toBe(1200);
    expect(o.taxaEntrega).toBe(1500);
    expect(o.total).toBe(2700);
    expect(o.zona.numero).toBe(2);
  });

  it('botijas adicionais pagam 50% da taxa', () => {
    const o = calcularOrcamento({
      ...base,
      itens: [{ produto: b12, quantidade: 3 }],
      zona: zonas[0],
      distanciaKm: 2,
    });
    expect(o.subtotalRecarga).toBe(3600);
    expect(o.taxaEntrega).toBe(1000 + 500 + 500);
  });

  it('pedido misto: a botija com taxa mais alta paga a 100%', () => {
    const o = calcularOrcamento({
      ...base,
      itens: [
        { produto: b12, quantidade: 1 },
        { produto: b51, quantidade: 1 },
      ],
      zona: zonas[0],
      distanciaKm: 2,
    });
    expect(o.taxaEntrega).toBe(2000 + 500);
    expect(o.total).toBe(1200 + 5100 + 2500);
  });

  it('levantamento no ponto não paga taxa', () => {
    const o = calcularOrcamento({
      ...base,
      levantamento: true,
      itens: [{ produto: b12, quantidade: 1 }],
      zona: null,
      distanciaKm: null,
    });
    expect(o.taxaEntrega).toBe(0);
    expect(o.total).toBe(1200);
    expect(o.zona.numero).toBe(0);
  });

  it('fora de zona: taxa base + valor por km acima de 20 km, e exige orçamento', () => {
    const o = calcularOrcamento({
      ...base,
      itens: [{ produto: b12, quantidade: 1 }],
      zona: zonas[4],
      distanciaKm: 25,
    });
    expect(o.taxaEntrega).toBe(3000 + 5 * 150);
    expect(o.exigeOrcamento).toBe(true);
  });

  it('sem zona dá erro claro', () => {
    expect(() =>
      calcularOrcamento({
        ...base,
        itens: [{ produto: b12, quantidade: 1 }],
        zona: null,
        distanciaKm: null,
      }),
    ).toThrow(ErroPreco);
  });

  it('rejeita quantidades inválidas', () => {
    expect(() =>
      calcularOrcamento({
        ...base,
        itens: [{ produto: b12, quantidade: 0 }],
        zona: zonas[0],
        distanciaKm: 1,
      }),
    ).toThrow(ErroPreco);
  });
});

describe('formatarKz', () => {
  it('usa espaço como separador de milhar', () => {
    expect(formatarKz(1200)).toBe('1 200 Kz');
    expect(formatarKz(900)).toBe('900 Kz');
    expect(formatarKz(1234567)).toBe('1 234 567 Kz');
  });
});
