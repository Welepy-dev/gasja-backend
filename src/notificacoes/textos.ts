import { formatarKz } from '../precos/motor-preco';

/**
 * Textos enviados ao cliente. Sem acentos, para caber no alfabeto GSM do SMS.
 * A recarga e a taxa de entrega aparecem sempre separadas (exigência legal).
 */
interface ResumoPedido {
  numero: number;
  itens: { quantidade: number; pesoKg: number }[];
  subtotalRecarga: number;
  taxaEntrega: number;
  zonaNumero: number;
  total: number;
  metodoPagamento: 'NUMERARIO' | 'MULTICAIXA_EXPRESS';
  codigoEntrega?: string;
}

const kz = (v: number) => formatarKz(v).replace(/ (?=\d)/g, '.');

function linhaPreco(p: ResumoPedido): string {
  const botijas = p.itens
    .map((i) => `${i.quantidade}x${i.pesoKg}kg`)
    .join(' + ');
  const entrega =
    p.zonaNumero === 0
      ? 'Levantamento no ponto 0 Kz'
      : `Entrega Zona ${p.zonaNumero} ${kz(p.taxaEntrega)}`;
  return `Botija ${botijas} ${kz(p.subtotalRecarga)} (preco oficial) + ${entrega} = Total ${kz(p.total)}`;
}

function pagamento(p: ResumoPedido): string {
  return p.metodoPagamento === 'NUMERARIO'
    ? 'numerario na entrega'
    : 'Multicaixa Express';
}

export const Textos = {
  pedirConfirmacao: (p: ResumoPedido) =>
    `GasJa: Pedido #${p.numero}. ${linhaPreco(p)}. Pagamento: ${pagamento(p)}. Responda SIM para confirmar ou NAO para cancelar.`,

  confirmado: (p: ResumoPedido) =>
    `GasJa: Pedido #${p.numero} confirmado. ${linhaPreco(p)}. Codigo de entrega: ${p.codigoEntrega}. De este codigo ao condutor.`,

  pagamentoPedido: (p: ResumoPedido) =>
    `GasJa: Enviamos um pedido de pagamento Multicaixa Express de ${kz(p.total)} para o pedido #${p.numero}. Aceite no seu telemovel.`,

  aCaminho: (numero: number, condutor: string) =>
    `GasJa: O condutor ${condutor} esta a caminho com o pedido #${numero}.`,

  entregue: (numero: number) =>
    `GasJa: Pedido #${numero} entregue. Obrigado! Reclamacoes: responda a esta mensagem.`,

  cancelado: (numero: number) => `GasJa: Pedido #${numero} cancelado.`,

  semPedidoPendente: () =>
    'GasJa: Nao encontramos nenhum pedido a aguardar confirmacao. Para pedir envie GAS 1x12 CASH e a sua morada.',
};
