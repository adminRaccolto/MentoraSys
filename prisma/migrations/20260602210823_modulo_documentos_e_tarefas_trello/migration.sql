-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('CONTRATO', 'PROPOSTA', 'PROJETO', 'FINANCEIRO', 'INTERNO', 'OUTROS');

-- DropForeignKey
ALTER TABLE "documentos" DROP CONSTRAINT "documentos_projeto_id_fkey";

-- AlterTable
ALTER TABLE "documentos" ADD COLUMN     "categoria" "CategoriaDocumento" NOT NULL DEFAULT 'INTERNO',
ADD COLUMN     "cliente_id" TEXT,
ADD COLUMN     "contrato_id" TEXT,
ADD COLUMN     "descricao" TEXT,
ALTER COLUMN "projeto_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tarefas" ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'MEDIA';

-- CreateTable
CREATE TABLE "comentarios_tarefa" (
    "id" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "conteudo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comentarios_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_tarefa" (
    "id" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "criado_por" TEXT,
    "nome" TEXT NOT NULL,
    "arquivo_url" TEXT NOT NULL,
    "arquivo_tamanho" INTEGER NOT NULL DEFAULT 0,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades_tarefa" (
    "id" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "descricao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovacoes_tarefa" (
    "id" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "solicitante_id" TEXT,
    "aprovador_id" TEXT,
    "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_em" TIMESTAMP(3),

    CONSTRAINT "aprovacoes_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_tarefa" (
    "id" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas_tarefa" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#64748B',

    CONSTRAINT "etiquetas_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas_etiquetas" (
    "tarefa_id" TEXT NOT NULL,
    "etiqueta_id" TEXT NOT NULL,

    CONSTRAINT "tarefas_etiquetas_pkey" PRIMARY KEY ("tarefa_id","etiqueta_id")
);

-- AddForeignKey
ALTER TABLE "comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_tarefa" ADD CONSTRAINT "anexos_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_tarefa" ADD CONSTRAINT "anexos_tarefa_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_tarefa" ADD CONSTRAINT "atividades_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_tarefa" ADD CONSTRAINT "atividades_tarefa_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_tarefa" ADD CONSTRAINT "aprovacoes_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_tarefa" ADD CONSTRAINT "aprovacoes_tarefa_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_tarefa" ADD CONSTRAINT "aprovacoes_tarefa_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_tarefa" ADD CONSTRAINT "checklist_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiquetas_tarefa" ADD CONSTRAINT "etiquetas_tarefa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_etiquetas" ADD CONSTRAINT "tarefas_etiquetas_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_etiquetas" ADD CONSTRAINT "tarefas_etiquetas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiquetas_tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
