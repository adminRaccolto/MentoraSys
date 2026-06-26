-- CreateTable: CentroCusto
CREATE TABLE "centros_custo" (
    "id"            TEXT NOT NULL,
    "empresa_id"    TEXT NOT NULL,
    "nome"          TEXT NOT NULL,
    "codigo"        TEXT,
    "descricao"     TEXT,
    "ativo"         BOOLEAN NOT NULL DEFAULT true,
    "projeto_id"    TEXT,
    "criado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex: projeto_id
CREATE UNIQUE INDEX "centros_custo_projeto_id_key" ON "centros_custo"("projeto_id");

-- AddColumn: e_centro_custo em projetos
ALTER TABLE "projetos" ADD COLUMN "e_centro_custo" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: centro_custo_id em recebiveis
ALTER TABLE "recebiveis" ADD COLUMN "centro_custo_id" TEXT;

-- AddColumn: centro_custo_id em contas_pagar
ALTER TABLE "contas_pagar" ADD COLUMN "centro_custo_id" TEXT;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_projeto_id_fkey"
    FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recebiveis" ADD CONSTRAINT "recebiveis_centro_custo_id_fkey"
    FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_centro_custo_id_fkey"
    FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
