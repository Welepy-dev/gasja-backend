import { normalizarTelefone } from './telefone';

describe('normalizarTelefone', () => {
  it.each([
    ['923456789', '+244923456789'],
    ['923 456 789', '+244923456789'],
    ['+244 923 456 789', '+244923456789'],
    ['244923456789', '+244923456789'],
    ['00244923456789', '+244923456789'],
    ['222123456', '+244222123456'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each(['', '12345', '823456789', '+351912345678', 'abc'])(
    'rejeita %s',
    (entrada) => {
      expect(normalizarTelefone(entrada)).toBeNull();
    },
  );
});
