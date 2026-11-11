-- Cláusula de cessão pro bono do sistema Arato (idempotente)
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "probono_arato" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "probono_versao" TEXT;
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "probono_meses" INTEGER;
