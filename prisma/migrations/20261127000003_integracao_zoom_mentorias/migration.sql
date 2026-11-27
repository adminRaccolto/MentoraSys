BEGIN;

CREATE TABLE "integracoes_zoom_mentorias" (
    "empresa_id" TEXT NOT NULL,
    "dados" TEXT NOT NULL,

    CONSTRAINT "integracoes_zoom_mentorias_pkey" PRIMARY KEY ("empresa_id"),
    CONSTRAINT "integracoes_zoom_mentorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "integracoes_zoom_mentorias" ENABLE ROW LEVEL SECURITY;

COMMIT;
