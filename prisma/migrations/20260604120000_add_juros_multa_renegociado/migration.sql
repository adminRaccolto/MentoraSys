-- Adiciona enum RENEGOCIADO ao StatusRecebivel
DO $$ BEGIN
  ALTER TYPE "StatusRecebivel" ADD VALUE IF NOT EXISTS 'RENEGOCIADO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adiciona campos de juros/multa ao Contrato
ALTER TABLE "contratos"
  ADD COLUMN IF NOT EXISTS "juros_ao_mes_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "multa_percentual" DECIMAL(5,2);

-- Adiciona campos financeiros e origem ao Recebivel
ALTER TABLE "recebiveis"
  ADD COLUMN IF NOT EXISTS "juros_valor" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "multa_valor" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "desconto_valor" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "recebivel_origem_id" TEXT;
