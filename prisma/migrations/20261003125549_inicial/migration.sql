-- CreateEnum
CREATE TYPE "PerfilUtilizador" AS ENUM ('OPERADOR', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('RECEBIDO', 'CONFIRMADO', 'ATRIBUIDO', 'ACEITE', 'RECOLHIDO', 'A_CAMINHO', 'NO_LOCAL', 'ENTREGUE', 'CANCELADO', 'FALHADO');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('ENTREGA', 'LEVANTAMENTO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('NUMERARIO', 'MULTICAIXA_EXPRESS');

-- CreateEnum
CREATE TYPE "EstadoPagamento" AS ENUM ('PENDENTE', 'PAGO', 'FALHOU');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('ESTADO', 'PROBLEMA', 'NOTA');

-- CreateEnum
CREATE TYPE "EstadoMensagem" AS ENUM ('NOVA', 'DUVIDA', 'CONVERTIDA', 'RESPOSTA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHOU');

-- CreateTable
CREATE TABLE "Utilizador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "perfil" "PerfilUtilizador" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilizador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condutor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "veiculo" TEXT,
    "matricula" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "disponivel" BOOLEAN NOT NULL DEFAULT false,
    "ultimaLat" DOUBLE PRECISION,
    "ultimaLng" DOUBLE PRECISION,
    "ultimaPosicaoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "notas" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentidadeCanal" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentidadeCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Morada" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT 'Casa',
    "bairroId" TEXT,
    "descricao" TEXT NOT NULL,
    "referencia" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "gpsConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Morada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pesoKg" INTEGER NOT NULL,
    "precoRecarga" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaEntrega" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "kmMax" DOUBLE PRECISION,
    "exigeOrcamento" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZonaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaEntrega" (
    "id" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "valorPorKm" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TarifaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bairro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "zonaId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bairro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposito" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "moradaId" TEXT,
    "canal" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'RECEBIDO',
    "tipoEntrega" "TipoEntrega" NOT NULL DEFAULT 'ENTREGA',
    "metodoPagamento" "MetodoPagamento" NOT NULL,
    "estadoPagamento" "EstadoPagamento" NOT NULL DEFAULT 'PENDENTE',
    "trocaVazia" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "depositoId" TEXT,
    "zonaId" TEXT,
    "zonaNumero" INTEGER NOT NULL DEFAULT 0,
    "distanciaKm" DOUBLE PRECISION,
    "subtotalRecarga" INTEGER NOT NULL,
    "taxaEntrega" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "codigoEntrega" TEXT NOT NULL,
    "condutorId" TEXT,
    "criadoPorId" TEXT,
    "mensagemOrigemId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "atribuidoEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "motivoFim" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "ItemPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL DEFAULT 'ESTADO',
    "deEstado" "EstadoPedido",
    "paraEstado" "EstadoPedido",
    "autorTipo" TEXT NOT NULL,
    "autorId" TEXT,
    "motivo" TEXT,
    "dados" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "idLocal" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemEntrada" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "clienteId" TEXT,
    "texto" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "conversaId" TEXT,
    "idExterno" TEXT,
    "estado" "EstadoMensagem" NOT NULL DEFAULT 'NOVA',
    "interpretacao" JSONB,
    "tratadaPorId" TEXT,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MensagemEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemSaida" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "pedidoId" TEXT,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "idExterno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),

    CONSTRAINT "MensagemSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "valor" INTEGER NOT NULL,
    "estado" "EstadoPagamento" NOT NULL DEFAULT 'PENDENTE',
    "referenciaExterna" TEXT,
    "condutorId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "conciliadoEm" TIMESTAMP(3),
    "dados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistoAuditoria" (
    "id" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT,
    "accao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilizador_email_key" ON "Utilizador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Condutor_telefone_key" ON "Condutor"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_telefone_key" ON "Cliente"("telefone");

-- CreateIndex
CREATE INDEX "IdentidadeCanal_clienteId_idx" ON "IdentidadeCanal"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentidadeCanal_canal_identificador_key" ON "IdentidadeCanal"("canal", "identificador");

-- CreateIndex
CREATE INDEX "Morada_clienteId_idx" ON "Morada"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaEntrega_numero_key" ON "ZonaEntrega"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaEntrega_zonaId_produtoId_key" ON "TarifaEntrega"("zonaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Bairro_nome_municipio_key" ON "Bairro"("nome", "municipio");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_mensagemOrigemId_key" ON "Pedido"("mensagemOrigemId");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_clienteId_idx" ON "Pedido"("clienteId");

-- CreateIndex
CREATE INDEX "Pedido_condutorId_estado_idx" ON "Pedido"("condutorId", "estado");

-- CreateIndex
CREATE INDEX "Pedido_criadoEm_idx" ON "Pedido"("criadoEm");

-- CreateIndex
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoPedido_idLocal_key" ON "EventoPedido"("idLocal");

-- CreateIndex
CREATE INDEX "EventoPedido_pedidoId_idx" ON "EventoPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "MensagemEntrada_estado_idx" ON "MensagemEntrada"("estado");

-- CreateIndex
CREATE INDEX "MensagemEntrada_clienteId_idx" ON "MensagemEntrada"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemEntrada_canal_idExterno_key" ON "MensagemEntrada"("canal", "idExterno");

-- CreateIndex
CREATE INDEX "MensagemSaida_pedidoId_idx" ON "MensagemSaida"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_referenciaExterna_key" ON "Pagamento"("referenciaExterna");

-- CreateIndex
CREATE INDEX "Pagamento_pedidoId_idx" ON "Pagamento"("pedidoId");

-- CreateIndex
CREATE INDEX "Pagamento_condutorId_conciliadoEm_idx" ON "Pagamento"("condutorId", "conciliadoEm");

-- CreateIndex
CREATE INDEX "RegistoAuditoria_entidade_entidadeId_idx" ON "RegistoAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "RegistoAuditoria_criadoEm_idx" ON "RegistoAuditoria"("criadoEm");

-- AddForeignKey
ALTER TABLE "IdentidadeCanal" ADD CONSTRAINT "IdentidadeCanal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Morada" ADD CONSTRAINT "Morada_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Morada" ADD CONSTRAINT "Morada_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "Bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaEntrega" ADD CONSTRAINT "TarifaEntrega_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "ZonaEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaEntrega" ADD CONSTRAINT "TarifaEntrega_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bairro" ADD CONSTRAINT "Bairro_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "ZonaEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_moradaId_fkey" FOREIGN KEY ("moradaId") REFERENCES "Morada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "ZonaEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_condutorId_fkey" FOREIGN KEY ("condutorId") REFERENCES "Condutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Utilizador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_mensagemOrigemId_fkey" FOREIGN KEY ("mensagemOrigemId") REFERENCES "MensagemEntrada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPedido" ADD CONSTRAINT "EventoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemEntrada" ADD CONSTRAINT "MensagemEntrada_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemSaida" ADD CONSTRAINT "MensagemSaida_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_condutorId_fkey" FOREIGN KEY ("condutorId") REFERENCES "Condutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
