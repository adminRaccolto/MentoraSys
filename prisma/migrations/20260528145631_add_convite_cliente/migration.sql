-- CreateTable
CREATE TABLE "convites_cliente" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "criado_por" TEXT,
    "usado_em" TIMESTAMP(3),
    "cliente_id" TEXT,
    "expira_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convites_cliente_token_key" ON "convites_cliente"("token");

-- CreateIndex
CREATE UNIQUE INDEX "convites_cliente_cliente_id_key" ON "convites_cliente"("cliente_id");

-- AddForeignKey
ALTER TABLE "convites_cliente" ADD CONSTRAINT "convites_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites_cliente" ADD CONSTRAINT "convites_cliente_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites_cliente" ADD CONSTRAINT "convites_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
