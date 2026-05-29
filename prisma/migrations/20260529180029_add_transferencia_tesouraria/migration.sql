-- CreateTable
CREATE TABLE "transferencias_tesouraria" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "conta_origem_id" TEXT NOT NULL,
    "conta_destino_id" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_tesouraria_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transferencias_tesouraria" ADD CONSTRAINT "transferencias_tesouraria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_tesouraria" ADD CONSTRAINT "transferencias_tesouraria_conta_origem_id_fkey" FOREIGN KEY ("conta_origem_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_tesouraria" ADD CONSTRAINT "transferencias_tesouraria_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
