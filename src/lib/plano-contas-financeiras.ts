import { prisma } from "@/lib/prisma";

/**
 * Garante que a hierarquia "Receitas > Receitas Não Operacionais >
 * Receitas Financeiras > Juros e Multas" existe para a empresa.
 * Retorna o id da conta "Juros e Multas".
 */
export async function obterOuCriarContaJurosMultas(empresaId: string): Promise<string> {
  async function findOrCreate(nome: string, parentId: string | null): Promise<string> {
    const existing = await prisma.planoDeContas.findFirst({
      where: { empresa_id: empresaId, nome, ativo: true },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.planoDeContas.create({
      data: {
        empresa_id: empresaId,
        nome,
        tipo: "RECEITA",
        parent_id: parentId,
        aceita_lancamento: nome === "Juros e Multas",
        ativo: true,
      },
    });
    return created.id;
  }

  const receitasId    = await findOrCreate("Receitas", null);
  const naoOpId       = await findOrCreate("Receitas Não Operacionais", receitasId);
  const financeirasId = await findOrCreate("Receitas Financeiras", naoOpId);
  const jurosMultasId = await findOrCreate("Juros e Multas", financeirasId);
  return jurosMultasId;
}
