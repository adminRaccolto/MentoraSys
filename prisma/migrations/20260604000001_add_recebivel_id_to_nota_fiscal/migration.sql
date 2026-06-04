-- AlterTable (safe: coluna pode já existir se db push foi usado antes)
ALTER TABLE "notas_fiscais" ADD COLUMN IF NOT EXISTS "recebivel_id" TEXT;

-- CreateIndex (safe)
CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_recebivel_id_key" ON "notas_fiscais"("recebivel_id");

-- AddForeignKey (safe: ignora se constraint já existir)
DO $$ BEGIN
  ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_recebivel_id_fkey"
    FOREIGN KEY ("recebivel_id") REFERENCES "recebiveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
