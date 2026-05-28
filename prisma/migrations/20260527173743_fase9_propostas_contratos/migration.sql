-- AlterTable
ALTER TABLE "contratos" ADD COLUMN     "cliente_contato_email" TEXT,
ADD COLUMN     "cliente_contato_nome" TEXT,
ADD COLUMN     "cliente_contato_tel" TEXT,
ADD COLUMN     "cliente_cpf_cnpj" TEXT,
ADD COLUMN     "cliente_nome" TEXT,
ADD COLUMN     "data_emissao" TIMESTAMP(3),
ADD COLUMN     "dia_vencimento" INTEGER,
ADD COLUMN     "forma_pagamento" TEXT,
ADD COLUMN     "gerar_financeiro" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gerar_projeto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "indice_reajuste" TEXT,
ADD COLUMN     "numero_contrato" TEXT,
ADD COLUMN     "numero_parcelas" INTEGER,
ADD COLUMN     "objeto" TEXT,
ADD COLUMN     "periodicidade" TEXT,
ADD COLUMN     "periodicidade_reajuste" TEXT,
ADD COLUMN     "primeiro_vencimento" TIMESTAMP(3),
ADD COLUMN     "renovacao_automatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responsavel_id" TEXT,
ADD COLUMN     "tipo_contrato" TEXT;

-- AlterTable
ALTER TABLE "propostas" ADD COLUMN     "contato_email" TEXT,
ADD COLUMN     "contato_nome" TEXT,
ADD COLUMN     "contato_telefone" TEXT,
ADD COLUMN     "forma_pagamento" TEXT,
ADD COLUMN     "numero_parcelas" INTEGER,
ADD COLUMN     "objeto" TEXT,
ADD COLUMN     "periodicidade" TEXT,
ADD COLUMN     "primeiro_vencimento" TIMESTAMP(3),
ADD COLUMN     "responsavel_id" TEXT;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
