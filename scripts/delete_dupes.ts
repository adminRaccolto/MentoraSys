import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const grupos = await prisma.$queryRaw`
    SELECT contrato_id::text, COUNT(*)::int as total, MAX(criado_em) as ultimo_criado
    FROM recebiveis
    WHERE contrato_id IS NOT NULL
    GROUP BY contrato_id
    HAVING COUNT(*) > 1
    ORDER BY total DESC
  ` as { contrato_id: string; total: number; ultimo_criado: Date }[];

  if (grupos.length === 0) {
    console.log("Nenhuma duplicata encontrada.");
    return;
  }

  console.log("Contratos com duplicatas:", JSON.stringify(grupos, null, 2));

  for (const grupo of grupos) {
    const todos = await prisma.recebivel.findMany({
      where: { contrato_id: grupo.contrato_id },
      orderBy: { criado_em: "asc" },
      select: { id: true, criado_em: true, descricao: true, numero_parcela: true },
    });

    const metade = Math.floor(grupo.total / 2);
    const paraApagar = todos.slice(metade);
    console.log(`\nContrato ${grupo.contrato_id}: ${grupo.total} parcelas, apagando ${paraApagar.length}`);

    const deleted = await prisma.recebivel.deleteMany({
      where: { id: { in: paraApagar.map((r) => r.id) } },
    });
    console.log(`Deletados: ${deleted.count}`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
