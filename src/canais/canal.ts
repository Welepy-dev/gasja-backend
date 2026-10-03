/**
 * Camada de canais.
 *
 * Cada canal (chamada, SMS, app, e no futuro WhatsApp e Messenger) é um adaptador:
 * - à entrada, traduz o que recebe para uma MensagemNormalizada e entrega-a ao CanaisService;
 * - à saída, implementa AdaptadorSaida para enviar notificações pelo canal de origem.
 * O núcleo (pedidos, preço, despacho, pagamentos) nunca sabe de que canal veio o pedido.
 */

/** Canais conhecidos hoje. O campo `canal` é texto aberto: juntar um canal não muda o esquema. */
export const CANAIS = {
  CHAMADA: 'chamada',
  SMS: 'sms',
  APP: 'app',
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
} as const;

/** Canais em que o identificador do remetente é o número de telefone. */
export const CANAIS_POR_TELEFONE: string[] = [
  CANAIS.CHAMADA,
  CANAIS.SMS,
  CANAIS.APP,
  CANAIS.WHATSAPP,
];

export interface MensagemNormalizada {
  canal: string;
  /** Telefone, número WhatsApp, ID do Messenger... */
  remetente: string;
  texto: string;
  localizacao?: { lat: number; lng: number };
  conversaId?: string;
  /** Id da mensagem no fornecedor, para não processar a mesma mensagem duas vezes. */
  idExterno?: string;
  recebidaEm?: Date;
}

export interface AdaptadorSaida {
  readonly canal: string;
  enviar(destino: string, texto: string): Promise<{ idExterno?: string }>;
}

export const ADAPTADORES_SAIDA = Symbol('ADAPTADORES_SAIDA');
