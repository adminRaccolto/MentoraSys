import { prisma } from "@/lib/prisma";

type ContaImposto = "PIS/COFINS" | "IRPJ" | "CSLL";

/**
 * Garante que a hierarquia "Despesas Operacionais > Impostos e Taxas > <conta>"
 * existe para a empresa (reaproveita os nós já criados pelo seed padrão quando
 * existirem) e retorna o id da conta de lançamento.
 */
export async function obterOuCriarContaImposto(empresaId: string, nomeConta: ContaImposto): Promise<string> {
  async function findOrCreate(nome: string, parentId: string | null, aceitaLancamento: boolean): Promise<string> {
    const existing = await prisma.planoDeContas.findFirst({
      where: { empresa_id: empresaId, nome, ativo: true },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.planoDeContas.create({
      data: {
        empresa_id: empresaId,
        nome,
        tipo: "DESPESA",
        parent_id: parentId,
        aceita_lancamento: aceitaLancamento,
        ativo: true,
      },
    });
    return created.id;
  }

  const impostosId = await findOrCreate("Impostos e Taxas", null, false);
  return findOrCreate(nomeConta, impostosId, true);
}
