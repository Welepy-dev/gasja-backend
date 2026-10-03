import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { criarApp, entrarCentral, entrarCondutor, SEGREDO } from './util';

/** Fluxos do piloto (chamada + SMS) de ponta a ponta, contra PostgreSQL. */
/** Telefone novo em cada execução: a base de testes não é apagada entre execuções. */
const sufixo = String(Date.now()).slice(-6);
const tel = (prefixo: string) => `+2449${prefixo}${sufixo}`;

describe('Fluxos do piloto', () => {
  let app: INestApplication<App>;
  let central: string;
  let condutor: { token: string; id: string };
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp();
    central = await entrarCentral(app);
    condutor = await entrarCondutor(app);
    await api()
      .put('/v1/condutor/turno')
      .auth(condutor.token, { type: 'bearer' })
      .send({ disponivel: true })
      .expect(200);
    await api()
      .post('/v1/condutor/posicao')
      .auth(condutor.token, { type: 'bearer' })
      .send({ lat: -8.92, lng: 13.19 })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  async function bairro(nome: string) {
    const r = await api()
      .get('/v1/bairros')
      .auth(central, { type: 'bearer' })
      .expect(200);
    return (r.body as { id: string; nome: string }[]).find(
      (b) => b.nome === nome,
    )!;
  }

  describe('chamada: operador cria, condutor entrega, numerário', () => {
    let pedidoId: string;
    let total: number;

    it('dá o preço ao vivo com recarga e taxa separadas', async () => {
      const talatona = await bairro('Talatona');
      const r = await api()
        .post('/v1/precos/orcamento')
        .auth(central, { type: 'bearer' })
        .send({
          itens: [{ codigo: '12KG', quantidade: 2 }],
          bairroId: talatona.id,
        })
        .expect(200);
      // Talatona fica a menos de 3 km do depósito de exemplo: zona 1.
      expect(r.body.zona.numero).toBe(1);
      expect(r.body.subtotalRecarga).toBe(2400);
      expect(r.body.taxaEntrega).toBe(1000 + 500);
      expect(r.body.total).toBe(3900);
    });

    it('cria o pedido confirmado na chamada e atribui ao condutor', async () => {
      const talatona = await bairro('Talatona');
      const r = await api()
        .post('/v1/pedidos')
        .auth(central, { type: 'bearer' })
        .send({
          telefone: tel('21'),
          nomeCliente: 'Ana Domingos',
          novaMorada: {
            nome: 'Casa',
            bairroId: talatona.id,
            descricao: 'Talatona, Rua do Talatona',
            referencia: 'Portão azul ao lado da cantina',
          },
          itens: [{ pesoKg: 12, quantidade: 2 }],
          metodoPagamento: 'NUMERARIO',
          confirmadoPeloCliente: true,
          condutorId: condutor.id,
        })
        .expect(201);
      expect(r.body.estado).toBe('ATRIBUIDO');
      expect(r.body.canal).toBe('chamada');
      expect(r.body.cliente.telefone).toBe(tel('21'));
      expect(r.body.condutor.id).toBe(condutor.id);
      pedidoId = r.body.id;
      total = r.body.total;
    });

    it('aparece na lista do condutor', async () => {
      const r = await api()
        .get('/v1/condutor/entregas')
        .auth(condutor.token, { type: 'bearer' })
        .expect(200);
      expect(r.body.map((p: { id: string }) => p.id)).toContain(pedidoId);
    });

    it('condutor avança aceitar → recolhi → a caminho → cheguei', async () => {
      for (const estado of ['ACEITE', 'RECOLHIDO', 'A_CAMINHO', 'NO_LOCAL']) {
        const r = await api()
          .post(`/v1/condutor/entregas/${pedidoId}/estado`)
          .auth(condutor.token, { type: 'bearer' })
          .send({ estado, idLocal: `local-${estado}-${pedidoId}` })
          .expect(200);
        expect(r.body.estado).toBe(estado);
      }
    });

    it('a mesma acção reenviada pela app offline não conta duas vezes', async () => {
      const r = await api()
        .post(`/v1/condutor/entregas/${pedidoId}/estado`)
        .auth(condutor.token, { type: 'bearer' })
        .send({ estado: 'NO_LOCAL', idLocal: `local-NO_LOCAL-${pedidoId}` })
        .expect(200);
      expect(r.body.estado).toBe('NO_LOCAL');
    });

    it('recusa numerário diferente do total', async () => {
      await api()
        .post(`/v1/condutor/entregas/${pedidoId}/entregar`)
        .auth(condutor.token, { type: 'bearer' })
        .send({ valorRecebido: total + 500 })
        .expect(400);
    });

    it('entrega com o total, marca o ponto GPS da morada e soma ao numerário em mão', async () => {
      const antes = await api()
        .get('/v1/condutor/resumo')
        .auth(condutor.token, { type: 'bearer' })
        .expect(200);
      const r = await api()
        .post(`/v1/condutor/entregas/${pedidoId}/entregar`)
        .auth(condutor.token, { type: 'bearer' })
        .send({
          valorRecebido: total,
          vaziasRecolhidas: 2,
          lat: -8.9175,
          lng: 13.1841,
        })
        .expect(200);
      expect(r.body.estado).toBe('ENTREGUE');
      expect(r.body.estadoPagamento).toBe('PAGO');
      expect(r.body.morada.gpsConfirmado).toBe(true);

      const resumo = await api()
        .get('/v1/condutor/resumo')
        .auth(condutor.token, { type: 'bearer' })
        .expect(200);
      expect(resumo.body.numerarioEmMao - antes.body.numerarioEmMao).toBe(
        total,
      );
      expect(resumo.body.numerarioRecargas + resumo.body.numerarioTaxas).toBe(
        resumo.body.numerarioEmMao,
      );
    });

    it('guarda o histórico de estados', async () => {
      const r = await api()
        .get(`/v1/pedidos/${pedidoId}`)
        .auth(central, { type: 'bearer' })
        .expect(200);
      const estados = r.body.eventos.map(
        (e: { paraEstado: string }) => e.paraEstado,
      );
      expect(estados).toEqual([
        'CONFIRMADO',
        'ATRIBUIDO',
        'ACEITE',
        'RECOLHIDO',
        'A_CAMINHO',
        'NO_LOCAL',
        'ENTREGUE',
      ]);
    });
  });

  describe('SMS: o cliente pede e confirma por SMS', () => {
    const cliente = tel('12');
    const sms = (texto: string, id: string, de = cliente) =>
      api()
        .post('/v1/canais/sms/webhook')
        .set('x-gasja-segredo', SEGREDO)
        .send({ de, texto, id: `${id}-${sufixo}` });
    const pedidosDoCliente = async () => {
      const ficha = await api()
        .get(`/v1/clientes/telefone/${encodeURIComponent(cliente)}`)
        .auth(central, { type: 'bearer' })
        .expect(200);
      const r = await api()
        .get(`/v1/pedidos?clienteId=${ficha.body.id}`)
        .auth(central, { type: 'bearer' })
        .expect(200);
      return r.body as { estado: string; canal: string }[];
    };

    it('rejeita o webhook sem segredo', async () => {
      await api()
        .post('/v1/canais/sms/webhook')
        .send({ de: cliente, texto: 'GAS 1x12 CASH Kilamba' })
        .expect(401);
    });

    it('GAS 1x12 CASH com morada cria um pedido à espera do SIM', async () => {
      const r = await sms(
        'GAS 1x12 CASH Kilamba, bloco B, prédio 12',
        'sms-1',
      ).expect(200);
      expect(r.body.estado).toBe('CONVERTIDA');

      const pedidos = await pedidosDoCliente();
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]).toMatchObject({
        estado: 'RECEBIDO',
        canal: 'sms',
        morada: { bairro: { nome: 'Kilamba' } },
      });
    });

    it('a mesma SMS entregue duas vezes pelo agregador é ignorada', async () => {
      await sms('GAS 1x12 CASH Kilamba, bloco B, prédio 12', 'sms-1').expect(
        200,
      );
      expect(await pedidosDoCliente()).toHaveLength(1);
    });

    it('SIM confirma o pedido', async () => {
      const r = await sms('Sim', 'sms-2').expect(200);
      expect(r.body.estado).toBe('RESPOSTA');
      expect((await pedidosDoCliente())[0].estado).toBe('CONFIRMADO');
    });

    it('mensagem incompleta fica na caixa como dúvida e a central converte-a', async () => {
      const r = await sms(
        'preciso de gás no Zango 3',
        'sms-3',
        tel('34'),
      ).expect(200);
      expect(r.body.estado).toBe('DUVIDA');

      const caixa = await api()
        .get('/v1/mensagens?estado=DUVIDA')
        .auth(central, { type: 'bearer' })
        .expect(200);
      const mensagem = caixa.body.find(
        (m: { id: string }) => m.id === r.body.id,
      );
      expect(mensagem.cliente.telefone).toBe(tel('34'));

      const zango = await bairro('Zango');
      const pedido = await api()
        .post('/v1/pedidos')
        .auth(central, { type: 'bearer' })
        .send({
          clienteId: mensagem.cliente.id,
          canal: 'sms',
          mensagemOrigemId: mensagem.id,
          novaMorada: { bairroId: zango.id, descricao: 'Zango 3, casa 45' },
          itens: [{ pesoKg: 12, quantidade: 1 }],
          metodoPagamento: 'NUMERARIO',
        })
        .expect(201);
      expect(pedido.body.estado).toBe('RECEBIDO');

      const depois = await api()
        .get(`/v1/mensagens/${mensagem.id}`)
        .auth(central, { type: 'bearer' })
        .expect(200);
      expect(depois.body.estado).toBe('CONVERTIDA');
      expect(depois.body.pedido.id).toBe(pedido.body.id);
    });
  });

  describe('Multicaixa Express: pago antes da saída', () => {
    let pedidoId: string;

    it('pedido MCX confirmado gera um pedido de pagamento', async () => {
      const r = await api()
        .post('/v1/pedidos')
        .auth(central, { type: 'bearer' })
        .send({
          telefone: tel('21'),
          novaMorada: { descricao: 'Benfica, rua 3', lat: -8.95, lng: 13.15 },
          itens: [{ pesoKg: 51, quantidade: 1 }],
          metodoPagamento: 'MULTICAIXA_EXPRESS',
          confirmadoPeloCliente: true,
          condutorId: condutor.id,
        })
        .expect(201);
      pedidoId = r.body.id;
      expect(r.body.estadoPagamento).toBe('PENDENTE');

      await api()
        .post(`/v1/condutor/entregas/${pedidoId}/estado`)
        .auth(condutor.token, { type: 'bearer' })
        .send({ estado: 'ACEITE' })
        .expect(200);
    });

    it('o condutor não sai sem o pagamento confirmado', async () => {
      await api()
        .post(`/v1/condutor/entregas/${pedidoId}/estado`)
        .auth(condutor.token, { type: 'bearer' })
        .send({ estado: 'A_CAMINHO' })
        .expect(409);
    });

    it('callback do gateway marca pago e o condutor pode sair', async () => {
      const detalhe = await api()
        .get(`/v1/pedidos/${pedidoId}`)
        .auth(central, { type: 'bearer' })
        .expect(200);
      const referencia = detalhe.body.pagamentos[0].referenciaExterna;
      await api()
        .post('/v1/pagamentos/multicaixa/callback')
        .set('x-gasja-segredo', SEGREDO)
        .send({ referenciaExterna: referencia, pago: true })
        .expect(200);

      const r = await api()
        .post(`/v1/condutor/entregas/${pedidoId}/estado`)
        .auth(condutor.token, { type: 'bearer' })
        .send({ estado: 'A_CAMINHO' })
        .expect(200);
      expect(r.body.estadoPagamento).toBe('PAGO');
    });
  });

  describe('permissões', () => {
    it('condutor não acede à fila da central', async () => {
      await api()
        .get('/v1/pedidos')
        .auth(condutor.token, { type: 'bearer' })
        .expect(403);
    });

    it('sem token não há acesso', async () => {
      await api().get('/v1/pedidos').expect(401);
    });

    it('operador não muda preços; supervisor/admin sim, e fica auditado', async () => {
      await api()
        .post('/v1/utilizadores')
        .auth(central, { type: 'bearer' })
        .send({
          nome: 'Rosa Simão',
          email: `rosa-${sufixo}@gasja.ao`,
          password: 'operadora-123',
          perfil: 'OPERADOR',
        })
        .expect(201);
      const login = await api()
        .post('/v1/auth/central/login')
        .send({ email: `rosa-${sufixo}@gasja.ao`, password: 'operadora-123' })
        .expect(200);
      const tabela = await api()
        .get('/v1/precos')
        .auth(login.body.token, { type: 'bearer' })
        .expect(200);
      const p12 = tabela.body.produtos.find(
        (p: { codigo: string }) => p.codigo === '12KG',
      );

      await api()
        .patch(`/v1/precos/produtos/${p12.id}`)
        .auth(login.body.token, { type: 'bearer' })
        .send({ precoRecarga: 2000 })
        .expect(403);
      await api()
        .patch(`/v1/precos/produtos/${p12.id}`)
        .auth(central, { type: 'bearer' })
        .send({ precoRecarga: 1200 })
        .expect(200);
    });
  });
});
