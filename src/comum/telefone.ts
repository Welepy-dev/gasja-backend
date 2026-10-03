/**
 * Normaliza números angolanos para o formato +244XXXXXXXXX.
 * Aceita "923456789", "923 456 789", "244923456789", "+244 923 456 789", "00244923456789".
 * Devolve null se o número não for válido.
 */
export function normalizarTelefone(entrada: string): string | null {
  if (!entrada) return null;
  let digitos = entrada.replace(/[^\d+]/g, '');
  if (digitos.startsWith('+')) digitos = digitos.slice(1);
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (digitos.length === 12 && digitos.startsWith('244')) {
    digitos = digitos.slice(3);
  }
  // Números móveis e fixos angolanos têm 9 dígitos (móveis começam por 9, fixos por 2).
  if (!/^[29]\d{8}$/.test(digitos)) return null;
  return `+244${digitos}`;
}
