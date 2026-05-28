-- CreateTable
CREATE TABLE "aceite_otp" (
    "id" TEXT NOT NULL,
    "proposta_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceite_otp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "aceite_otp" ADD CONSTRAINT "aceite_otp_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
