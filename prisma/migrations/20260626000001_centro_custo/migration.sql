-- CreateTable: CentroCusto (idempotente)
CREATE TABLE IF NOT EXISTS "centros_custo" (
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

-- UniqueIndex: projeto_id (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS "centros_custo_projeto_id_key" ON "centros_custo"("projeto_id");

-- AddColumn: e_centro_custo em projetos (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projetos' AND column_name = 'e_centro_custo'
  ) THEN
    ALTER TABLE "projetos" ADD COLUMN "e_centro_custo" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- AddColumn: centro_custo_id em recebiveis (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recebiveis' AND column_name = 'centro_custo_id'
  ) THEN
    ALTER TABLE "recebiveis" ADD COLUMN "centro_custo_id" TEXT;
  END IF;
END $$;

-- AddColumn: centro_custo_id em contas_pagar (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contas_pagar' AND column_name = 'centro_custo_id'
  ) THEN
    ALTER TABLE "contas_pagar" ADD COLUMN "centro_custo_id" TEXT;
  END IF;
END $$;

-- AddForeignKey: centros_custo → empresas (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'centros_custo_empresa_id_fkey'
  ) THEN
    ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: centros_custo → projetos (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'centros_custo_projeto_id_fkey'
  ) THEN
    ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_projeto_id_fkey"
      FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: recebiveis → centros_custo (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recebiveis_centro_custo_id_fkey'
  ) THEN
    ALTER TABLE "recebiveis" ADD CONSTRAINT "recebiveis_centro_custo_id_fkey"
      FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: contas_pagar → centros_custo (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contas_pagar_centro_custo_id_fkey'
  ) THEN
    ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_centro_custo_id_fkey"
      FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
