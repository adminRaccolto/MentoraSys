import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BANCOS = [
  { codigo: "001", sigla: "BB",        nome: "Banco do Brasil" },
  { codigo: "003", sigla: "BASA",      nome: "Banco da Amazônia" },
  { codigo: "004", sigla: "BNB",       nome: "Banco do Nordeste" },
  { codigo: "033", sigla: "Santander", nome: "Banco Santander Brasil" },
  { codigo: "041", sigla: "Banrisul",  nome: "Banrisul" },
  { codigo: "047", sigla: "Banese",    nome: "Banco do Estado de Sergipe" },
  { codigo: "070", sigla: "BRB",       nome: "BRB – Banco de Brasília" },
  { codigo: "077", sigla: "Inter",     nome: "Banco Inter" },
  { codigo: "084", sigla: "Uniprime",  nome: "Uniprime Norte do Paraná" },
  { codigo: "104", sigla: "CEF",       nome: "Caixa Econômica Federal" },
  { codigo: "212", sigla: "Original",  nome: "Banco Original" },
  { codigo: "237", sigla: "Bradesco",  nome: "Banco Bradesco" },
  { codigo: "260", sigla: "Nubank",    nome: "Nu Pagamentos (Nubank)" },
  { codigo: "290", sigla: "PagBank",   nome: "PagBank (PagSeguro)" },
  { codigo: "318", sigla: "BMG",       nome: "Banco BMG" },
  { codigo: "336", sigla: "C6Bank",    nome: "C6 Bank" },
  { codigo: "341", sigla: "Itaú",      nome: "Itaú Unibanco" },
  { codigo: "380", sigla: "PicPay",    nome: "PicPay Serviços" },
  { codigo: "403", sigla: "Cora",      nome: "Cora SCD" },
  { codigo: "422", sigla: "Safra",     nome: "Banco Safra" },
  { codigo: "461", sigla: "Asaas",     nome: "Asaas IP" },
  { codigo: "633", sigla: "Rendimento",nome: "Banco Rendimento" },
  { codigo: "637", sigla: "Sofisa",    nome: "Banco Sofisa" },
  { codigo: "655", sigla: "Votorantim",nome: "Banco Votorantim (BV)" },
  { codigo: "707", sigla: "Daycoval",  nome: "Banco Daycoval" },
  { codigo: "748", sigla: "Sicredi",   nome: "Sicredi" },
  { codigo: "756", sigla: "Sicoob",    nome: "Sicoob" },
  { codigo: "999", sigla: "Caixa",     nome: "Caixa Interna / Dinheiro" },
];

async function main() {
  let criados = 0, existentes = 0;
  for (const b of BANCOS) {
    const exists = await prisma.banco.findUnique({ where: { codigo: b.codigo } });
    if (exists) { existentes++; continue; }
    await prisma.banco.create({ data: b });
    criados++;
  }
  console.log(`Bancos: ${criados} criados, ${existentes} já existiam.`);
  await prisma.$disconnect();
}
main().catch(console.error);
