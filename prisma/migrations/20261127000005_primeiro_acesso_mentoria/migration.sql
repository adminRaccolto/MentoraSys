BEGIN;

-- CreateTable
CREATE TABLE "portal_aluno_convites" (
    "token_hash" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),

    CONSTRAINT "portal_aluno_convites_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE INDEX "portal_aluno_convites_aluno_id_idx" ON "portal_aluno_convites"("aluno_id");

-- CreateIndex
CREATE INDEX "portal_aluno_convites_expira_em_idx" ON "portal_aluno_convites"("expira_em");

-- AddForeignKey
ALTER TABLE "portal_aluno_convites" ADD CONSTRAINT "portal_aluno_convites_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "mentoria_alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "portal_aluno_convites" ENABLE ROW LEVEL SECURITY;

COMMIT;
