BEGIN;

-- CreateTable
CREATE TABLE "portal_aluno_acessos" (
    "cliente_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "provisoria_expira_em" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "portal_aluno_acessos_pkey" PRIMARY KEY ("cliente_id")
);

-- CreateTable
CREATE TABLE "portal_aluno_sessoes" (
    "token_hash" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_aluno_sessoes_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "portal_aluno_limites" (
    "chave" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_aluno_limites_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_aluno_acessos_email_key" ON "portal_aluno_acessos"("email");

-- CreateIndex
CREATE INDEX "portal_aluno_sessoes_cliente_id_idx" ON "portal_aluno_sessoes"("cliente_id");

-- CreateIndex
CREATE INDEX "portal_aluno_sessoes_expira_em_idx" ON "portal_aluno_sessoes"("expira_em");

-- CreateIndex
CREATE INDEX "portal_aluno_limites_expira_em_idx" ON "portal_aluno_limites"("expira_em");

-- AddForeignKey
ALTER TABLE "portal_aluno_acessos" ADD CONSTRAINT "portal_aluno_acessos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_aluno_sessoes" ADD CONSTRAINT "portal_aluno_sessoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "portal_aluno_acessos"("cliente_id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "portal_aluno_acessos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_aluno_sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_aluno_limites" ENABLE ROW LEVEL SECURITY;

COMMIT;
