// Replica o NDA da empresa 51.499.616/0001-90 → 49.578.526/0001-42
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const envFile = readFileSync(resolve(root, ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

process.env.DATABASE_URL = process.env.DIRECT_URL;
const { PrismaClient } = await import(resolve(root, "src/lib/generated/prisma/index.js"));
const { PrismaPg } = await import("@prisma/adapter-pg");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

const [origem, destino] = await Promise.all([
  prisma.empresa.findUnique({ where: { cnpj: "51.499.616/0001-90" }, select: { id: true, nome: true } }),
  prisma.empresa.findUnique({ where: { cnpj: "49.578.526/0001-42" }, select: { id: true, nome: true } }),
]);

if (!origem || !destino) { console.error("Empresa não encontrada"); process.exit(1); }

const modelo = await prisma.modeloDocumento.findFirst({
  where: { empresa_id: origem.id, nome: "Termo de Confidencialidade e Sigilo" },
});

if (!modelo) { console.error("Modelo não encontrado na origem"); process.exit(1); }

const existente = await prisma.modeloDocumento.findFirst({
  where: { empresa_id: destino.id, nome: modelo.nome },
});

if (existente) {
  await prisma.modeloDocumento.update({ where: { id: existente.id }, data: { conteudo: modelo.conteudo, ativo: true } });
  console.log(`✅ Atualizado em ${destino.nome}`);
} else {
  const criado = await prisma.modeloDocumento.create({
    data: { empresa_id: destino.id, nome: modelo.nome, tipo: modelo.tipo, conteudo: modelo.conteudo, ativo: true },
  });
  console.log(`✅ Criado em ${destino.nome}: [${criado.id}]`);
}

await prisma.$disconnect();
