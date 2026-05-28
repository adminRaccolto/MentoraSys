-- CreateEnum
CREATE TYPE "TipoModelo" AS ENUM ('CONTRATO', 'PROPOSTA', 'RECIBO', 'GENERICO');

-- CreateTable
CREATE TABLE "modelos_documento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoModelo" NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_documento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "modelos_documento" ADD CONSTRAINT "modelos_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
