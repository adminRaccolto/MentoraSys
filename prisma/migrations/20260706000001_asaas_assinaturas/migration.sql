-- AlterTable: clientes — adicionar asaas_id
ALTER TABLE "clientes" ADD COLUMN "asaas_id" TEXT;

-- AlterTable: servicos — campos de canal / produto Asaas
ALTER TABLE "servicos"
  ADD COLUMN "canal"                 TEXT,
  ADD COLUMN "plano"                 TEXT,
  ADD COLUMN "tipo_cobranca"         TEXT,
  ADD COLUMN "asaas_link_pagamento"  TEXT;

-- AlterTable: recebiveis — campos Asaas
ALTER TABLE "recebiveis"
  ADD COLUMN "asaas_payment_id"      TEXT,
  ADD COLUMN "asaas_invoice_url"     TEXT,
  ADD COLUMN "asaas_pix_copia_cola"  TEXT,
  ADD COLUMN "asaas_boleto_url"      TEXT,
  ADD COLUMN "asaas_status"          TEXT;

-- CreateTable: assinaturas
CREATE TABLE "assinaturas" (
    "id"                    TEXT NOT NULL,
    "empresa_id"            TEXT NOT NULL,
    "cliente_id"            TEXT,
    "servico_id"            TEXT,
    "nome_cliente"          TEXT NOT NULL,
    "email_cliente"         TEXT,
    "telefone_cliente"      TEXT,
    "canal"                 TEXT NOT NULL,
    "plano"                 TEXT,
    "valor"                 DECIMAL(10,2) NOT NULL,
    "ciclo"                 TEXT NOT NULL DEFAULT 'MONTHLY',
    "status"                TEXT NOT NULL DEFAULT 'ATIVA',
    "asaas_subscription_id" TEXT,
    "asaas_customer_id"     TEXT,
    "proximo_vencimento"    TIMESTAMP(3),
    "data_inicio"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_cancelamento"     TIMESTAMP(3),
    "motivo_cancelamento"   TEXT,
    "observacoes"           TEXT,
    "criado_em"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: assinaturas → empresas
ALTER TABLE "assinaturas"
  ADD CONSTRAINT "assinaturas_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: assinaturas → clientes
ALTER TABLE "assinaturas"
  ADD CONSTRAINT "assinaturas_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: assinaturas → servicos
ALTER TABLE "assinaturas"
  ADD CONSTRAINT "assinaturas_servico_id_fkey"
  FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
