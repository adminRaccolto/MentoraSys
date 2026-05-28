import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import PlanoContasClient from "./plano-contas-client";

export default async function PlanoContasPage() {
  const empresaId = await obterEmpresaAtiva();

  const contas = await prisma.planoDeContas.findMany({
    where: { empresa_id: empresaId },
    select: {
      id: true,
      codigo: true,
      nome: true,
      tipo: true,
      parent_id: true,
      aceita_lancamento: true,
      ativo: true,
      _count: { select: { recebiveis: true, contas_pagar: true, servicos: true, filhos: true } },
    } as const,
    orderBy: [{ codigo: "asc" }, { nome: "asc" }],
  });

  return <PlanoContasClient contas={contas} />;
}
