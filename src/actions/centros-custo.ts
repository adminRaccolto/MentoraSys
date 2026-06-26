"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schema = z.object({
  nome:      z.string().min(1, "Nome obrigatório"),
  codigo:    z.string().optional(),
  descricao: z.string().optional(),
  ativo:     z.boolean().default(true),
});

export async function listarCentrosCusto() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.centroCusto.findMany({
    where: { empresa_id: empresaId },
    include: { projeto: { select: { id: true, titulo: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
}

export async function criarCentroCusto(input: z.input<typeof schema>) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const cc = await prisma.centroCusto.create({
    data: { ...data, empresa_id: empresaId },
    include: { projeto: { select: { id: true, titulo: true } } },
  });

  revalidatePath("/financeiro/centros-custo");
  revalidatePath("/financeiro/relatorio-cc");
  return { data: cc };
}

export async function editarCentroCusto(id: string, input: z.input<typeof schema>) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const existente = await prisma.centroCusto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Centro de custo não encontrado");
  if (existente.projeto_id) throw new Error("CCs vinculados a projetos são gerenciados pelo projeto");

  const cc = await prisma.centroCusto.update({
    where: { id },
    data,
    include: { projeto: { select: { id: true, titulo: true } } },
  });

  revalidatePath("/financeiro/centros-custo");
  revalidatePath("/financeiro/relatorio-cc");
  return { data: cc };
}

export async function excluirCentroCusto(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.centroCusto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Centro de custo não encontrado");
  if (existente.projeto_id) throw new Error("CCs vinculados a projetos são gerenciados pelo projeto");

  const emUso = await prisma.recebivel.count({ where: { centro_custo_id: id } }) +
                await prisma.contaPagar.count({ where: { centro_custo_id: id } });
  if (emUso > 0) throw new Error(`Este CC possui ${emUso} lançamento(s) e não pode ser excluído`);

  await prisma.centroCusto.delete({ where: { id } });

  revalidatePath("/financeiro/centros-custo");
  revalidatePath("/financeiro/relatorio-cc");
  return { ok: true };
}

// ─── Sync automático a partir do Projeto ─────────────────────────────────────

export async function sincronizarCcDoProjeto(
  projetoId: string,
  projetoTitulo: string,
  eCentroCusto: boolean,
  empresaId: string,
) {
  if (eCentroCusto) {
    await prisma.centroCusto.upsert({
      where: { projeto_id: projetoId },
      create: { empresa_id: empresaId, projeto_id: projetoId, nome: projetoTitulo },
      update: { nome: projetoTitulo },
    });
  } else {
    // desvincula: remove o CC mas só se não tiver lançamentos
    const cc = await prisma.centroCusto.findUnique({ where: { projeto_id: projetoId } });
    if (cc) {
      const emUso = await prisma.recebivel.count({ where: { centro_custo_id: cc.id } }) +
                    await prisma.contaPagar.count({ where: { centro_custo_id: cc.id } });
      if (emUso === 0) {
        await prisma.centroCusto.delete({ where: { id: cc.id } });
      } else {
        // mantém o CC mas desvincula do projeto
        await prisma.centroCusto.update({
          where: { id: cc.id },
          data: { projeto_id: null },
        });
      }
    }
  }
}
