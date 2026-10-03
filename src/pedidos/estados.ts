import { EstadoPedido } from '@prisma/client';

/** Quem pede a mudança de estado. */
export type Autor = 'utilizador' | 'condutor' | 'cliente' | 'sistema';

const E = EstadoPedido;

export const ESTADOS_FINAIS: EstadoPedido[] = [
  E.ENTREGUE,
  E.CANCELADO,
  E.FALHADO,
];

/** Pedidos com condutor a trabalhar neles. */
export const ESTADOS_EM_CURSO: EstadoPedido[] = [
  E.ATRIBUIDO,
  E.ACEITE,
  E.RECOLHIDO,
  E.A_CAMINHO,
  E.NO_LOCAL,
];

/**
 * Transições permitidas por autor.
 * Fluxo da app do condutor: aceitar → recolhi → a caminho → cheguei → entregue.
 */
const TRANSICOES: Record<
  Autor,
  Partial<Record<EstadoPedido, EstadoPedido[]>>
> = {
  utilizador: {
    [E.RECEBIDO]: [E.CONFIRMADO, E.CANCELADO],
    [E.CONFIRMADO]: [E.ATRIBUIDO, E.CANCELADO],
    [E.ATRIBUIDO]: [E.CONFIRMADO, E.CANCELADO],
    [E.ACEITE]: [E.CONFIRMADO, E.CANCELADO],
    [E.RECOLHIDO]: [E.CANCELADO, E.FALHADO],
    [E.A_CAMINHO]: [E.CANCELADO, E.FALHADO],
    [E.NO_LOCAL]: [E.CANCELADO, E.FALHADO],
  },
  condutor: {
    [E.ATRIBUIDO]: [E.ACEITE],
    [E.ACEITE]: [E.RECOLHIDO, E.A_CAMINHO, E.FALHADO],
    [E.RECOLHIDO]: [E.A_CAMINHO, E.FALHADO],
    [E.A_CAMINHO]: [E.NO_LOCAL, E.ENTREGUE, E.FALHADO],
    [E.NO_LOCAL]: [E.ENTREGUE, E.FALHADO],
  },
  cliente: {
    [E.RECEBIDO]: [E.CONFIRMADO, E.CANCELADO],
    [E.CONFIRMADO]: [E.CANCELADO],
  },
  sistema: {
    [E.RECEBIDO]: [E.CONFIRMADO, E.CANCELADO],
  },
};

export function podeTransitar(
  autor: Autor,
  de: EstadoPedido,
  para: EstadoPedido,
): boolean {
  return TRANSICOES[autor][de]?.includes(para) ?? false;
}
