import { Textos } from './textos';

describe('Textos', () => {
  it('pedido de confirmação separa recarga e entrega (exemplo do documento de preço)', () => {
    const texto = Textos.pedirConfirmacao({
      numero: 2841,
      itens: [{ quantidade: 1, pesoKg: 12 }],
      subtotalRecarga: 1200,
      taxaEntrega: 1500,
      zonaNumero: 2,
      total: 2700,
      metodoPagamento: 'NUMERARIO',
    });
    expect(texto).toBe(
      'GasJa: Pedido #2841. Botija 1x12kg 1.200 Kz (preco oficial) + Entrega Zona 2 1.500 Kz = Total 2.700 Kz. Pagamento: numerario na entrega. Responda SIM para confirmar ou NAO para cancelar.',
    );
  });
});
