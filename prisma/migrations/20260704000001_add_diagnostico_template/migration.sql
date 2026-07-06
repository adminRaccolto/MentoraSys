-- CreateTable
CREATE TABLE "diagnostico_templates" (
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

-- CreateIndex
CREATE UNIQUE INDEX "diagnostico_templates_empresa_id_cultura_nivel_key" ON "diagnostico_templates"("empresa_id", "cultura", "nivel");

-- AddForeignKey
ALTER TABLE "diagnostico_templates" ADD CONSTRAINT "diagnostico_templates_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
