-- AlterTable
ALTER TABLE "notas_fiscais" ADD COLUMN     "aliquota_iss" DECIMAL(5,2),
ADD COLUMN     "codigo_servico" TEXT,
ADD COLUMN     "email_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_enviado_em" TIMESTAMP(3),
ADD COLUMN     "nfsio_id" TEXT,
ADD COLUMN     "numero_nfse" TEXT,
ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "xml_url" TEXT;

-- CreateTable
CREATE TABLE "boletos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "recebivel_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "asaas_id" TEXT,
    "asaas_customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "linha_digitavel" TEXT,
    "codigo_barras" TEXT,
    "url_boleto" TEXT,
    "url_fatura" TEXT,
    "nosso_numero" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boletos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boletos_recebivel_id_key" ON "boletos"("recebivel_id");

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_recebivel_id_fkey" FOREIGN KEY ("recebivel_id") REFERENCES "recebiveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
