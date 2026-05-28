import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type ParcelaJson = { numero: number; vencimento: string; valor: number };

async function main() {
  // Buscar contratos que têm recebiveis gerados E proposta com parcelas_json
  const contratos = await prisma.contrato.findMany({
    where: { recebiveis: { some: {} } },
    include: {
      proposta: { select: { parcelas_json: true } },
      recebiveis: { orderBy: { numero_parcela: "asc" }, select: { id: true, numero_parcela: true, valor: true, data_vencimento: true } },
    },
  });

  for (const contrato of contratos) {
    const parcelas = contrato.proposta?.parcelas_json as ParcelaJson[] | null;
    if (!parcelas || parcelas.length === 0) {
      console.log(`Contrato ${contrato.id}: sem parcelas_json na proposta, pulando`);
      continue;
    }

    if (parcelas.length !== contrato.recebiveis.length) {
      console.log(`Contrato ${contrato.id}: parcelas_json tem ${parcelas.length} vs ${contrato.recebiveis.length} recebiveis, pulando`);
      continue;
    }

    console.log(`\nContrato ${contrato.numero_contrato ?? contrato.id}: corrigindo ${parcelas.length} parcelas`);
    for (let i = 0; i < parcelas.length; i++) {
      const p = parcelas[i];
      const r = contrato.recebiveis[i];
      const novoValor = p.valor;
      const novaData = new Date(p.vencimento);
      console.log(`  Parcela ${p.numero}: ${Number(r.valor)} → ${novoValor} | ${r.data_vencimento.toLocaleDateString("pt-BR")} → ${novaData.toLocaleDateString("pt-BR")}`);
      await prisma.recebivel.update({
        where: { id: r.id },
        data: { valor: novoValor, data_vencimento: novaData },
      });
    }
    console.log(`  Concluído.`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
