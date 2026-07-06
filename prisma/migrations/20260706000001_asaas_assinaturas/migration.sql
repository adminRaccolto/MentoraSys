-- AlterTable: clientes — adicionar asaas_id (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='asaas_id') THEN
    ALTER TABLE "clientes" ADD COLUMN "asaas_id" TEXT;
  END IF;
END $$;

-- AlterTable: servicos — campos de canal / produto Asaas (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='canal') THEN
    ALTER TABLE "servicos" ADD COLUMN "canal" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='plano') THEN
    ALTER TABLE "servicos" ADD COLUMN "plano" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='tipo_cobranca') THEN
    ALTER TABLE "servicos" ADD COLUMN "tipo_cobranca" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='asaas_link_pagamento') THEN
    ALTER TABLE "servicos" ADD COLUMN "asaas_link_pagamento" TEXT;
  END IF;
END $$;

-- AlterTable: recebiveis — campos Asaas (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recebiveis' AND column_name='asaas_payment_id') THEN
    ALTER TABLE "recebiveis" ADD COLUMN "asaas_payment_id" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recebiveis' AND column_name='asaas_invoice_url') THEN
    ALTER TABLE "recebiveis" ADD COLUMN "asaas_invoice_url" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recebiveis' AND column_name='asaas_pix_copia_cola') THEN
    ALTER TABLE "recebiveis" ADD COLUMN "asaas_pix_copia_cola" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recebiveis' AND column_name='asaas_boleto_url') THEN
    ALTER TABLE "recebiveis" ADD COLUMN "asaas_boleto_url" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recebiveis' AND column_name='asaas_status') THEN
    ALTER TABLE "recebiveis" ADD COLUMN "asaas_status" TEXT;
  END IF;
END $$;

-- CreateTable: assinaturas (idempotent)
CREATE TABLE IF NOT EXISTS "assinaturas" (
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
    "atualizado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_empresa_id_fkey') THEN
    ALTER TABLE "assinaturas"
      ADD CONSTRAINT "assinaturas_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_cliente_id_fkey') THEN
    ALTER TABLE "assinaturas"
      ADD CONSTRAINT "assinaturas_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_servico_id_fkey') THEN
    ALTER TABLE "assinaturas"
      ADD CONSTRAINT "assinaturas_servico_id_fkey"
      FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
