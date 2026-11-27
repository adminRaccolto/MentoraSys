BEGIN;

-- CreateTable
CREATE TABLE "mentoria_paginas" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentoria_paginas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_itens" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel" TEXT,
    "prazo" DATE,
    "concluida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoria_materiais" (
    "id" TEXT NOT NULL,
    "mentoria_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentoria_paginas_mentoria_id_alterada_em_idx" ON "mentoria_paginas"("mentoria_id", "alterada_em");

-- CreateIndex
CREATE INDEX "mentoria_itens_mentoria_id_criado_em_idx" ON "mentoria_itens"("mentoria_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "mentoria_materiais_caminho_key" ON "mentoria_materiais"("caminho");

-- CreateIndex
CREATE INDEX "mentoria_materiais_mentoria_id_criado_em_idx" ON "mentoria_materiais"("mentoria_id", "criado_em");

-- AddForeignKey
ALTER TABLE "mentoria_paginas" ADD CONSTRAINT "mentoria_paginas_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_itens" ADD CONSTRAINT "mentoria_itens_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoria_materiais" ADD CONSTRAINT "mentoria_materiais_mentoria_id_fkey" FOREIGN KEY ("mentoria_id") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mentoria_paginas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentoria_materiais" ENABLE ROW LEVEL SECURITY;

COMMIT;
