import { config } from "dotenv";
config({ path: ".env.local" });

import { enviarFatura } from "../src/lib/email";

// ← Altere para o e-mail onde quer receber o teste
const EMAIL_TESTE = "gino.migotto01@gmail.com";

async function main() {
  console.log(`Enviando e-mail de teste para ${EMAIL_TESTE}...`);

  await enviarFatura({
    para: EMAIL_TESTE,
    clienteNome: "João da Silva",
    empresaNome: "Raccolto Gestão",
    descricao: "Consultoria em Gestão Financeira",
    valor: 3143.00,
    dataVencimento: new Date("2026-08-10"),
    numeroParcela: 3,
    totalParcelas: 12,
    formaPagamento: "PIX",
    pixChave: "financeiro@raccolto.com.br",
    link: "https://app.raccolto.com.br/fatura/p/exemplo-token-aqui",
    faturasEmAberto: [
      {
        descricao: "Consultoria em Gestão Financeira",
        valor: 3143.00,
        dataVencimento: new Date("2026-07-10"),
        numeroParcela: 2,
        totalParcelas: 12,
      },
    ],
  });

  console.log("✅ E-mail enviado! Verifique a caixa de entrada.");
}

main().catch((e) => {
  console.error("❌ Erro:", e.message);
  process.exit(1);
});
