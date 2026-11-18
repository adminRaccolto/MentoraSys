-- Cláusula configurável de reembolso de deslocamento, alimentação e hospedagem (idempotente)
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "reembolso_despesas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "reembolso_valor_km" DECIMAL(10,2);
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "reembolso_distancia_km" DECIMAL(8,2);
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "reembolso_limite_alimentacao" DECIMAL(10,2);
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "reembolso_limite_hospedagem" DECIMAL(10,2);
