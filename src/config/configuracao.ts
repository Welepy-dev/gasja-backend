/** Lê e valida as variáveis de ambiente no arranque. */
export function validarAmbiente(env: Record<string, unknown>) {
  const obrigatorias = ['DATABASE_URL', 'JWT_SECRET', 'CANAIS_SEGREDO_WEBHOOK'];
  const emFalta = obrigatorias.filter((k) => !env[k]);
  if (emFalta.length) {
    throw new Error(`Variáveis de ambiente em falta: ${emFalta.join(', ')}`);
  }
  return env;
}
