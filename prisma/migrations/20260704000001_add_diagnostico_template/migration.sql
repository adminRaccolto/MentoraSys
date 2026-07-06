-- CreateTable (idempotent — tabela pode já existir)
CREATE TABLE IF NOT EXISTS "diagnostico_templates" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cultura" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "titulo" TEXT,
    "texto_receita" TEXT,
    "texto_custos" TEXT,
    "texto_caixa" TEXT,
    "texto_recomendacoes" TEXT,
    "parametros_dre" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostico_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostico_templates_empresa_id_cultura_nivel_key" ON "diagnostico_templates"("empresa_id", "cultura", "nivel");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnostico_templates_empresa_id_fkey'
  ) THEN
    ALTER TABLE "diagnostico_templates" ADD CONSTRAINT "diagnostico_templates_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
