-- AlterTable
ALTER TABLE "notas_fiscais" ADD COLUMN "recebivel_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_recebivel_id_key" ON "notas_fiscais"("recebivel_id");

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_recebivel_id_fkey" FOREIGN KEY ("recebivel_id") REFERENCES "recebiveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
