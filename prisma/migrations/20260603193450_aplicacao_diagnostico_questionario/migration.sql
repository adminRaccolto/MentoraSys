-- CreateEnum
CREATE TYPE "MomentoDiagnostico" AS ENUM ('PONTO_A', 'PONTO_B', 'PONTO_C');

-- CreateEnum
CREATE TYPE "StatusAplicacaoDiagnostico" AS ENUM ('PENDENTE', 'ENVIADO', 'RESPONDIDO');

-- CreateTable
CREATE TABLE "aplicacoes_diagnostico" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "criado_por" TEXT,
    "momento" "MomentoDiagnostico" NOT NULL,
    "status" "StatusAplicacaoDiagnostico" NOT NULL DEFAULT 'PENDENTE',
    "token" TEXT NOT NULL,
    "respostas" JSONB,
    "enviado_em" TIMESTAMP(3),
    "respondido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aplicacoes_diagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aplicacoes_diagnostico_token_key" ON "aplicacoes_diagnostico"("token");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacoes_diagnostico_projeto_id_momento_key" ON "aplicacoes_diagnostico"("projeto_id", "momento");

-- AddForeignKey
ALTER TABLE "aplicacoes_diagnostico" ADD CONSTRAINT "aplicacoes_diagnostico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacoes_diagnostico" ADD CONSTRAINT "aplicacoes_diagnostico_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacoes_diagnostico" ADD CONSTRAINT "aplicacoes_diagnostico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
