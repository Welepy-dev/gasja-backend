import { PerfilUtilizador } from '@prisma/client';

/** Quem está autenticado: alguém da central ou um condutor. */
export type Conta =
  | { tipo: 'utilizador'; id: string; perfil: PerfilUtilizador }
  | { tipo: 'condutor'; id: string };

export type ContaUtilizador = Extract<Conta, { tipo: 'utilizador' }>;
export type ContaCondutor = Extract<Conta, { tipo: 'condutor' }>;
