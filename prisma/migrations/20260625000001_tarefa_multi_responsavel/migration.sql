-- CreateTable
CREATE TABLE "tarefas_responsaveis" (
    "tarefa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "tarefas_responsaveis_pkey" PRIMARY KEY ("tarefa_id","usuario_id")
);

-- AddForeignKey
ALTER TABLE "tarefas_responsaveis" ADD CONSTRAINT "tarefas_responsaveis_tarefa_id_fkey"
    FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_responsaveis" ADD CONSTRAINT "tarefas_responsaveis_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single responsavel to the join table
INSERT INTO "tarefas_responsaveis" ("tarefa_id", "usuario_id")
SELECT "id", "responsavel_id" FROM "tarefas"
WHERE "responsavel_id" IS NOT NULL
ON CONFLICT DO NOTHING;
