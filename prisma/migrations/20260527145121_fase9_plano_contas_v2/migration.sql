-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoPlanoContas" ADD VALUE 'CUSTO';
ALTER TYPE "TipoPlanoContas" ADD VALUE 'INVESTIMENTO';
ALTER TYPE "TipoPlanoContas" ADD VALUE 'TESOURARIA';

-- AlterTable
ALTER TABLE "plano_de_contas" ADD COLUMN     "aceita_lancamento" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "servicos" ADD COLUMN     "plano_contas_id" TEXT;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_plano_contas_id_fkey" FOREIGN KEY ("plano_contas_id") REFERENCES "plano_de_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
