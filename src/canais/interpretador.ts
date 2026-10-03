import { MetodoPagamento } from '@prisma/client';

/**
 * Leitor de pedidos em texto livre, partilhado por SMS e, no futuro, WhatsApp e Messenger.
 *
 * Formatos aceites (maiúsculas ou minúsculas, com ou sem acentos):
 *   GAS 2x12 CASH Maianga, Rua da Missão, perto da cantina
 *   GAS 12 2 MCX CASA
 *   gas 51 numerario trabalho
 *   2 botijas de 12kg, pago em dinheiro, Talatona rua 5
 *
 * O que não se consegue ler fica em `duvidas`; a central valida antes de criar o pedido.
 */

export interface PedidoInterpretado {
  pesoKg: number | null;
  quantidade: number;
  metodoPagamento: MetodoPagamento | null;
  /** Nome de uma morada guardada (ex.: "CASA", "TRABALHO"). */
  moradaGuardada: string | null;
  /** Texto livre da morada, com o ponto de referência. */
  moradaTexto: string | null;
  levantamento: boolean;
  duvidas: string[];
}

export type Resposta = 'SIM' | 'NAO';

const PESOS_VALIDOS = [12, 51];
const PAGAMENTO: Record<string, MetodoPagamento> = {
  CASH: MetodoPagamento.NUMERARIO,
  NUMERARIO: MetodoPagamento.NUMERARIO,
  DINHEIRO: MetodoPagamento.NUMERARIO,
  MCX: MetodoPagamento.MULTICAIXA_EXPRESS,
  MULTICAIXA: MetodoPagamento.MULTICAIXA_EXPRESS,
  EXPRESS: MetodoPagamento.MULTICAIXA_EXPRESS,
};
const MORADAS_GUARDADAS = ['CASA', 'TRABALHO'];
const LEVANTAMENTO = ['LEVANTAR', 'LEVANTAMENTO', 'BUSCAR'];
const PALAVRAS_IGNORADAS = new Set([
  'GAS',
  'GÁS',
  'BOTIJA',
  'BOTIJAS',
  'DE',
  'KG',
  'QUERO',
  'PAGO',
  'PAGAR',
  'PAGAMENTO',
  'EM',
  'COM',
  'POR',
  'FAVOR',
  'PF',
  'PFV',
  'E',
]);

function semAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "SIM" ou "NAO" quando a mensagem é só uma resposta de confirmação. */
export function lerResposta(texto: string): Resposta | null {
  const t = semAcentos(texto)
    .trim()
    .toUpperCase()
    .replace(/[.!]+$/, '');
  if (['SIM', 'S', 'CONFIRMO', 'OK'].includes(t)) return 'SIM';
  if (['NAO', 'N', 'CANCELAR', 'CANCELA'].includes(t)) return 'NAO';
  return null;
}

export function interpretarPedido(texto: string): PedidoInterpretado {
  const resultado: PedidoInterpretado = {
    pesoKg: null,
    quantidade: 1,
    metodoPagamento: null,
    moradaGuardada: null,
    moradaTexto: null,
    levantamento: false,
    duvidas: [],
  };

  const original = texto.trim().split(/\s+/);
  const restoMorada: string[] = [];
  let quantidadeLida = false;

  for (let i = 0; i < original.length; i++) {
    const palavra = original[i];
    const t = semAcentos(palavra)
      .toUpperCase()
      .replace(/[,;:.]+$/, '');

    // 2x12, 2X12KG, 1x51
    const qxp = /^(\d{1,2})[X*](\d{2})(KG)?$/.exec(t);
    if (qxp && resultado.pesoKg === null) {
      resultado.quantidade = Number(qxp[1]);
      resultado.pesoKg = Number(qxp[2]);
      quantidadeLida = true;
      continue;
    }
    // 12, 12KG, 51kg
    const peso = /^(\d{2})(KG)?$/.exec(t);
    if (
      peso &&
      resultado.pesoKg === null &&
      PESOS_VALIDOS.includes(Number(peso[1]))
    ) {
      resultado.pesoKg = Number(peso[1]);
      continue;
    }
    // quantidade solta (1 a 2 dígitos), antes ou depois do peso
    if (/^\d{1,2}$/.test(t) && !quantidadeLida && restoMorada.length === 0) {
      resultado.quantidade = Number(t);
      quantidadeLida = true;
      continue;
    }
    if (PAGAMENTO[t] && resultado.metodoPagamento === null) {
      resultado.metodoPagamento = PAGAMENTO[t];
      continue;
    }
    if (MORADAS_GUARDADAS.includes(t) && restoMorada.length === 0) {
      resultado.moradaGuardada = t;
      continue;
    }
    if (LEVANTAMENTO.includes(t)) {
      resultado.levantamento = true;
      continue;
    }
    if (PALAVRAS_IGNORADAS.has(t) && restoMorada.length === 0) continue;

    restoMorada.push(palavra);
  }

  const morada = restoMorada
    .join(' ')
    .replace(/^[,;:\s]+/, '')
    .trim();
  if (morada) resultado.moradaTexto = morada;

  if (resultado.pesoKg === null || !PESOS_VALIDOS.includes(resultado.pesoKg)) {
    resultado.duvidas.push('tamanho da botija (12 ou 51 kg)');
    if (resultado.pesoKg !== null) resultado.pesoKg = null;
  }
  if (resultado.quantidade < 1 || resultado.quantidade > 20) {
    resultado.duvidas.push('quantidade');
  }
  if (resultado.metodoPagamento === null) {
    resultado.duvidas.push('método de pagamento (CASH ou MCX)');
  }
  if (
    !resultado.levantamento &&
    !resultado.moradaGuardada &&
    !resultado.moradaTexto
  ) {
    resultado.duvidas.push('morada');
  }
  return resultado;
}
