/** Luanda está em WAT (UTC+1) todo o ano, sem hora de Verão. */
const DESVIO_LUANDA_MS = 60 * 60 * 1000;

/** Meia-noite de hoje em Luanda, como instante UTC. */
export function inicioDoDiaEmLuanda(agora = new Date()): Date {
  const local = new Date(agora.getTime() + DESVIO_LUANDA_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DESVIO_LUANDA_MS);
}
