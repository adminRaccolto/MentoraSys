BEGIN;

-- CreateEnum
CREATE TYPE "TipoMentoria" AS ENUM ('GRUPO', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "StatusEncontroMentoria" AS ENUM ('AGENDADO', 'REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPostMentoria" AS ENUM ('MURAL', 'PUBLICACAO');

-- AlterTable
ALTER TABLE "tokens_portal" ADD COLUMN     "mentoria_id" TEXT;

-- CreateTable
CREATE TABLE "mentorias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "turma" TEXT,
    "descricao" TEXT,
    "tipo" "TipoMentoria" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_alunos" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_encontros" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "pauta" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER NOT NULL,
    "status" "StatusEncontroMentoria" NOT NULL DEFAULT 'AGENDADO',
    "sala_url" TEXT,
    "gravacao_url" TEXT,
    "zoom_id" TEXT,
    "zoom_gravacao" TEXT,
    "zoom_pendente" TIMESTAMP(3),

    CONSTRAINT "mentoria_encontros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_posts" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "tipo" "TipoPostMentoria" NOT NULL,
    "autor" TEXT NOT NULL,
    "titulo" TEXT,
    "texto" TEXT NOT NULL,
    "url" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_presencas" (
    "encontro_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "checkin_em" TIMESTAMP(3),
    "entrada_zoom_em" TIMESTAMP(3),
    "presente_manual" BOOLEAN,

    CONSTRAINT "mentoria_presencas_pkey" PRIMARY KEY ("encontro_id","aluno_id")
);

-- CreateTable
CREATE TABLE "mentoria_tarefas" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "prazo" DATE,
    "concluida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_arquivos" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentorias_empresa_id_criado_em_idx" ON "mentorias"("empresa_id", "criado_em");

-- CreateIndex
CREATE INDEX "mentoria_alunos_cliente_id_ativo_idx" ON "mentoria_alunos"("cliente_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "mentoria_alunos_mentoria_id_cliente_id_key" ON "mentoria_alunos"("mentoria_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentoria_encontros_zoom_id_key" ON "mentoria_encontros"("zoom_id");

-- CreateIndex
CREATE INDEX "mentoria_encontros_mentoria_id_inicio_idx" ON "mentoria_encontros"("mentoria_id", "inicio");

-- CreateIndex
CREATE INDEX "mentoria_posts_mentoria_id_tipo_criado_em_idx" ON "mentoria_posts"("mentoria_id", "tipo", "criado_em");

-- CreateIndex
CREATE INDEX "mentoria_tarefas_aluno_id_criado_em_idx" ON "mentoria_tarefas"("aluno_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "mentoria_arquivos_caminho_key" ON "mentoria_arquivos"("caminho");

-- CreateIndex
CREATE INDEX "mentoria_arquivos_aluno_id_criado_em_idx" ON "mentoria_arquivos"("aluno_id", "criado_em");

-- CreateIndex
CREATE INDEX "tokens_portal_mentoria_id_idx" ON "tokens_portal"("mentoria_id");

-- AddForeignKey
ALTER TABLE "tokens_portal" ADD CONSTRAINT "tokens_portal_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorias" ADD CONSTRAINT "mentorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_alunos" ADD CONSTRAINT "mentoria_alunos_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_alunos" ADD CONSTRAINT "mentoria_alunos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_encontros" ADD CONSTRAINT "mentoria_encontros_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_posts" ADD CONSTRAINT "mentoria_posts_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_presencas" ADD CONSTRAINT "mentoria_presencas_encontro_id_fkey" FOREIGN KEY ("encontro_id") REFERENCES "mentoria_encontros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_presencas" ADD CONSTRAINT "mentoria_presencas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "mentoria_alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_tarefas" ADD CONSTRAINT "mentoria_tarefas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "mentoria_alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_arquivos" ADD CONSTRAINT "mentoria_arquivos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "mentoria_alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O acesso pelo navegador passa pelas rotas autenticadas da aplicação.
ALTER TABLE "tokens_portal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_alunos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_encontros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_presencas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_tarefas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_arquivos" ENABLE ROW LEVEL SECURITY;

-- Os perfis responsáveis pela operação recebem a gestão do novo produto.
INSERT INTO "permissoes" ("id", "recurso", "acao", "descricao")
VALUES
  ('mentorias-criar', 'mentorias', 'criar', 'Criar mentorias'),
  ('mentorias-editar', 'mentorias', 'editar', 'Gerenciar mentorias')
ON CONFLICT ("recurso", "acao") DO NOTHING;

INSERT INTO "perfis_permissoes" ("perfil_id", "permissao_id")
SELECT perfil."id", permissao."id"
FROM "perfis" perfil
CROSS JOIN "permissoes" permissao
WHERE perfil."nome" IN ('Administrador', 'Gestor')
  AND permissao."recurso" = 'mentorias'
ON CONFLICT DO NOTHING;

COMMIT;
