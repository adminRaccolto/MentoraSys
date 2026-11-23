CREATE TABLE IF NOT EXISTS "contrato_aditivos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "criado_por" TEXT,
    "numero" INTEGER NOT NULL,
    "inclui_reembolso" BOOLEAN NOT NULL DEFAULT false,
    "inclui_probono" BOOLEAN NOT NULL DEFAULT false,
    "texto_livre" TEXT,
    "conteudo" TEXT,
    "status" "StatusContrato" NOT NULL DEFAULT 'RASCUNHO',
    "authentique_id" TEXT,
    "authentique_url" TEXT,
    "pdf_assinado_url" TEXT,
    "assinado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_aditivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contrato_aditivos_contrato_id_numero_key" ON "contrato_aditivos"("contrato_id", "numero");
CREATE INDEX IF NOT EXISTS "contrato_aditivos_authentique_id_idx" ON "contrato_aditivos"("authentique_id");

DO $$ BEGIN
  ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_contrato_id_fkey"
    FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
