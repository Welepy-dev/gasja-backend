import { EstadoPedido as E } from '@prisma/client';
import { podeTransitar } from './estados';

describe('podeTransitar', () => {
  it('condutor segue o fluxo aceitar → recolhi → a caminho → cheguei → entregue', () => {
    expect(podeTransitar('condutor', E.ATRIBUIDO, E.ACEITE)).toBe(true);
    expect(podeTransitar('condutor', E.ACEITE, E.RECOLHIDO)).toBe(true);
    expect(podeTransitar('condutor', E.RECOLHIDO, E.A_CAMINHO)).toBe(true);
    expect(podeTransitar('condutor', E.A_CAMINHO, E.NO_LOCAL)).toBe(true);
    expect(podeTransitar('condutor', E.NO_LOCAL, E.ENTREGUE)).toBe(true);
  });

  it('condutor não salta a atribuição nem cancela', () => {
    expect(podeTransitar('condutor', E.CONFIRMADO, E.ACEITE)).toBe(false);
    expect(podeTransitar('condutor', E.ATRIBUIDO, E.ENTREGUE)).toBe(false);
    expect(podeTransitar('condutor', E.A_CAMINHO, E.CANCELADO)).toBe(false);
  });

  it('cliente confirma ou cancela antes da saída, nunca depois', () => {
    expect(podeTransitar('cliente', E.RECEBIDO, E.CONFIRMADO)).toBe(true);
    expect(podeTransitar('cliente', E.CONFIRMADO, E.CANCELADO)).toBe(true);
    expect(podeTransitar('cliente', E.A_CAMINHO, E.CANCELADO)).toBe(false);
  });

  it('estados finais não mudam', () => {
    for (const autor of [
      'utilizador',
      'condutor',
      'cliente',
      'sistema',
    ] as const) {
      for (const para of Object.values(E)) {
        expect(podeTransitar(autor, E.ENTREGUE, para)).toBe(false);
        expect(podeTransitar(autor, E.CANCELADO, para)).toBe(false);
      }
    }
  });
});
