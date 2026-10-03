# GásJá — backend

API do GásJá: pedidos de botijas de gás em Luanda, preço por zonas de distância, despacho para condutores, canais de contacto (chamada e SMS no piloto; app, WhatsApp e Messenger depois) e pagamentos em numerário ou Multicaixa Express.

Consumida pelo painel da central (`gasja-central`) e pela app do condutor (`gasja-app-condutor`). A app do cliente (`gasja-app`) entra na fase 2.

## Stack

- **NestJS 11** (Node.js 22, TypeScript)
- **PostgreSQL 16** com **Prisma 6** (esquema em `prisma/schema.prisma`)
- **Socket.IO** para o painel em tempo real
- **JWT** para a central (email + password) e para os condutores (telefone + PIN)
- Documentação da API em `/docs` (OpenAPI/Swagger)

## Arrancar em desenvolvimento

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL local (cria também a base gasja_teste)
npm install
npm run db:migrate            # aplica as migrações
npm run db:seed               # botijas, zonas, tarifas, bairros e contas de teste
npm run start:dev
```

- API: http://localhost:3000/v1
- Documentação: http://localhost:3000/docs
- Saúde: http://localhost:3000/saude

Contas criadas pelo seed fora de produção:

| Conta | Entrada |
|---|---|
| Administrador da central | `admin@gasja.ao` / `gasja-admin-dev` |
| Condutor de teste | `923 000 001` / PIN `1234` |

Em produção o seed só cria o administrador se `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` estiverem definidos, e não cria o condutor de teste.

## Testes

```bash
npm test                                   # unitários (motor de preço, estados, leitor de SMS...)
DATABASE_URL_TESTE=postgresql://gasja:gasja@localhost:5432/gasja_teste npm run test:e2e
npm run lint:check
```

Os testes e2e correm os fluxos do piloto contra PostgreSQL: pedido por chamada até à entrega com numerário, pedido por SMS com confirmação SIM, Multicaixa Express pago antes da saída, e permissões.

## Como está organizado

| Pasta | O quê |
|---|---|
| `src/pedidos` | Núcleo: criação, máquina de estados, atribuição, entrega, problemas |
| `src/precos` | Motor de preço (puro, `motor-preco.ts`), tabela configurável, bairros e depósitos |
| `src/canais` | Camada de canais: mensagem normalizada, leitor de texto, adaptadores SMS e chamada, caixa de mensagens |
| `src/clientes` | Ficha do cliente (identificado pelo telefone), moradas, identidades por canal |
| `src/condutores` | Gestão de condutores (central) e API da app do condutor (`/v1/condutor/...`) |
| `src/pagamentos` | Multicaixa Express (gateway simulado por agora) e numerário |
| `src/notificacoes` | Mensagens ao cliente pelo canal de origem, SMS como reserva |
| `src/tempo-real` | Eventos Socket.IO para o painel e para os condutores |
| `src/auditoria` | Registo de quem mudou pedidos, preços e contas |

### Pedido

Um só objecto `Pedido` para todos os canais, com o campo `canal` em texto aberto (`chamada`, `sms`, `app`, `whatsapp`, `messenger`...).

Estados: `RECEBIDO` → `CONFIRMADO` → `ATRIBUIDO` → `ACEITE` → `RECOLHIDO` → `A_CAMINHO` → `NO_LOCAL` → `ENTREGUE`, ou `CANCELADO` / `FALHADO`. As transições permitidas a cada actor (central, condutor, cliente) estão em `src/pedidos/estados.ts`. O pagamento tem um estado próprio (`PENDENTE`, `PAGO`, `FALHOU`).

Regras aplicadas pelo sistema:

- O pedido só passa a `CONFIRMADO` com o "sim" do cliente (na chamada, ou SIM por SMS).
- Multicaixa Express tem de estar pago antes de o condutor passar a `A_CAMINHO`.
- Em numerário, o condutor só pode registar exactamente o total do pedido.
- Cada pedido guarda o preço do momento (recarga, taxa, zona e distância); mudar a tabela não altera pedidos antigos.
- Na 1.ª entrega, a posição GPS do condutor passa a ser o ponto exacto da morada.

### Preço

Segue o documento "preço do transporte por distância e enquadramento legal":

- Recarga ao preço oficial (`Produto.precoRecarga`), sempre numa linha separada da taxa de entrega.
- Taxa de entrega por zona e tipo de botija (`TarifaEntrega`). Seed: zonas 1 a 4 (até 3, 7, 12 e 20 km) e "fora de zona" (base + valor por km, exige orçamento).
- Cada botija adicional na mesma entrega paga 50% da taxa (configurável).
- Levantamento no ponto: sem taxa.
- A zona vem do bairro, quando o bairro está classificado pela central; senão, da distância em linha recta ao depósito activo mais próximo.
- Não há preço dinâmico. Todas as alterações à tabela ficam auditadas.

Tudo é configurável pela central (`/v1/precos`, `/v1/bairros`, `/v1/depositos`), por supervisores e administradores.

### Camada de canais

Cada canal é um adaptador. À entrada, traduz o que recebe para uma `MensagemNormalizada` e chama `CanaisService.receber()`; à saída, implementa `AdaptadorSaida`. O núcleo nunca sabe de que canal veio o pedido.

- **SMS** (`POST /v1/canais/sms/webhook`): mensagens como `GAS 2x12 CASH Maianga, perto da cantina` ou `GAS 12 2 MCX CASA` viram pedido e o cliente recebe o preço por SMS para responder SIM ou NAO. O que não se consegue ler fica na caixa de mensagens como dúvida, e a central converte-o em pedido (`POST /v1/pedidos` com `mensagemOrigemId`).
- **Chamada** (`POST /v1/canais/chamada/eventos`): o PBX avisa que há uma chamada e o painel recebe `chamada.a_tocar` com a ficha do cliente. O operador cria o pedido durante a chamada.

Para juntar WhatsApp ou Messenger: um controller em `src/canais/adaptadores/` que recebe o webhook da Meta e chama `CanaisService.receber()`, e um `AdaptadorSaida` registado em `NotificacoesModule`. O leitor de texto e a ficha do cliente (`IdentidadeCanal`) já servem esses canais.

Os webhooks dos fornecedores são protegidos pelo cabeçalho `x-gasja-segredo` (variável `CANAIS_SEGREDO_WEBHOOK`). Quando cada fornecedor for escolhido, acrescenta-se a validação de assinatura própria dele.

### Tempo real

Socket.IO no namespace `/tempo-real`, com `auth: { token }`.

- Central: `pedido.criado`, `pedido.actualizado`, `pedido.problema`, `mensagem.recebida`, `chamada.a_tocar`, `chamada.atendida`, `chamada.terminada`, `pagamento.actualizado`, `condutor.actualizado`, `condutor.posicao`.
- Condutor: `entrega.atribuida`, `entrega.actualizada`, `entrega.retirada`.

### App do condutor offline

As acções da app (`/v1/condutor/entregas/:id/...`) aceitam `idLocal` (gerado no telemóvel) e `ocorridoEm`. A app guarda as acções sem rede e reenvia-as depois; a mesma acção enviada duas vezes só conta uma.

## Ainda por ligar

Estas peças estão preparadas com uma interface, mas dependem de contratos ainda por fazer:

| Peça | Estado |
|---|---|
| Agregador de SMS | SMS de saída ficam só no registo (`AdaptadorSmsSaida`); o webhook de entrada usa um formato provisório |
| PBX | Endpoint de eventos pronto; falta ligar o Asterisk/FreePBX ou o serviço escolhido |
| Multicaixa Express | `GatewayMulticaixaSimulado`; falta o gateway real (EMIS via banco ou agregador) |
| Facturação certificada AGT | Ainda não implementada; os pedidos já guardam as duas linhas (recarga e taxa) |
| Segunda verificação no login da central | Por fazer |
| Distância por estrada | Hoje é linha recta; os bairros classificados por zona são a fonte principal no piloto |

## Deploy

`Dockerfile` pronto: a imagem aplica as migrações (`prisma migrate deploy`) e arranca a API. Variáveis necessárias em `.env.example`.
