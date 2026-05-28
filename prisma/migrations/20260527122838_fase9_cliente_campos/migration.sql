-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'INATIVO', 'PROSPECT');

-- AlterTable: add new columns (keep ativo temporarily for data migration)
ALTER TABLE "clientes"
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "contato_principal" TEXT,
ADD COLUMN     "distancia_km" DECIMAL(8,2),
ADD COLUMN     "inscricao_estadual" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nome_fantasia" TEXT,
ADD COLUMN     "nome_fazenda" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "preco_km" DECIMAL(8,2),
ADD COLUMN     "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
ADD COLUMN     "whatsapp" TEXT;

-- Data migration: convert ativo boolean -> StatusCliente
UPDATE "clientes"
SET "status" = CASE WHEN "ativo" = true THEN 'ATIVO'::"StatusCliente" ELSE 'INATIVO'::"StatusCliente" END;

-- Drop the old ativo column
ALTER TABLE "clientes" DROP COLUMN "ativo";
