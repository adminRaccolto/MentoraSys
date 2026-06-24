-- AlterTable: tornar cliente_id opcional e adicionar campo interno
ALTER TABLE "projetos" ALTER COLUMN "cliente_id" DROP NOT NULL;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "interno" BOOLEAN NOT NULL DEFAULT false;
