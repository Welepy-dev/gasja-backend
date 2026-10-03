import { MetodoPagamento as M } from '@prisma/client';
import { interpretarPedido, lerResposta } from './interpretador';

describe('interpretarPedido', () => {
  it('formato do plano: GAS 2x12 CASH morada', () => {
    const r = interpretarPedido(
      'GAS 2x12 CASH Maianga, Rua da Missão, perto da cantina do Sr. João',
    );
    expect(r).toMatchObject({
      pesoKg: 12,
      quantidade: 2,
      metodoPagamento: M.NUMERARIO,
      moradaTexto: 'Maianga, Rua da Missão, perto da cantina do Sr. João',
      duvidas: [],
    });
  });

  it('formato do painel: GAS 12 2 MCX CASA', () => {
    const r = interpretarPedido('gas 12 2 mcx casa');
    expect(r).toMatchObject({
      pesoKg: 12,
      quantidade: 2,
      metodoPagamento: M.MULTICAIXA_EXPRESS,
      moradaGuardada: 'CASA',
      moradaTexto: null,
      duvidas: [],
    });
  });

  it('texto livre com acentos', () => {
    const r = interpretarPedido(
      'Quero 1 botija de 51kg, pago em numerário, Talatona rua 5',
    );
    expect(r.pesoKg).toBe(51);
    expect(r.quantidade).toBe(1);
    expect(r.metodoPagamento).toBe(M.NUMERARIO);
    expect(r.moradaTexto).toBe('Talatona rua 5');
    expect(r.duvidas).toEqual([]);
  });

  it('GAS 1x12 CASH sem morada fica com dúvida na morada', () => {
    const r = interpretarPedido('GAS 1x12 CASH');
    expect(r.duvidas).toEqual(['morada']);
  });

  it('marca dúvidas quando falta tamanho e pagamento', () => {
    const r = interpretarPedido('preciso de gás no Kilamba bloco B');
    expect(r.pesoKg).toBeNull();
    expect(r.duvidas).toContain('tamanho da botija (12 ou 51 kg)');
    expect(r.duvidas).toContain('método de pagamento (CASH ou MCX)');
  });

  it('tamanho inválido vira dúvida', () => {
    const r = interpretarPedido('GAS 1x20 CASH Viana');
    expect(r.pesoKg).toBeNull();
    expect(r.duvidas).toContain('tamanho da botija (12 ou 51 kg)');
  });

  it('levantamento no ponto não precisa de morada', () => {
    const r = interpretarPedido('GAS 12 CASH LEVANTAR');
    expect(r.levantamento).toBe(true);
    expect(r.duvidas).toEqual([]);
  });
});

describe('lerResposta', () => {
  it.each([
    ['SIM', 'SIM'],
    ['sim', 'SIM'],
    [' Sim. ', 'SIM'],
    ['NAO', 'NAO'],
    ['não', 'NAO'],
    ['GAS 1x12 CASH', null],
  ])('%s -> %s', (texto, esperado) => {
    expect(lerResposta(texto)).toBe(esperado);
  });
});
