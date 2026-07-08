-- CreateEnum
CREATE TYPE "TipoDesconto" AS ENUM ('PERCENTUAL', 'FIXO');

-- CreateTable
CREATE TABLE "campanhas_cupom" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "servico_id" TEXT,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo_desconto" "TipoDesconto" NOT NULL DEFAULT 'PERCENTUAL',
    "valor_desconto" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "validade_ate" TIMESTAMP(3),
    "usos_maximos" INTEGER,
    "usos_count" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_cupom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_cupom_empresa_id_codigo_key" ON "campanhas_cupom"("empresa_id", "codigo");

-- AddForeignKey
ALTER TABLE "campanhas_cupom" ADD CONSTRAINT "campanhas_cupom_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_cupom" ADD CONSTRAINT "campanhas_cupom_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
