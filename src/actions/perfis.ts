"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const TODOS_RECURSOS = [
  "clientes", "servicos", "crm", "propostas", "contratos",
  "projetos", "modelos", "agenda", "financeiro", "faturamento",
  "diagnosticos", "configuracoes",
];
const TODAS_ACOES = ["criar", "editar", "excluir"];

async function garantirPermissao(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], recurso: string, acao: string) {
  return tx.permissao.upsert({
    where: { recurso_acao: { recurso, acao } },
    update: {},
    create: { recurso, acao, descricao: `${acao} ${recurso}` },
  });
}

// ─── Criar perfil ─────────────────────────────────────────────────────────────

const schemaCreate = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional(),
  permissoes: z.array(z.object({ recurso: z.string(), acao: z.string() })),
});

export async function criarPerfil(input: z.input<typeof schemaCreate>) {
  await verificarPermissao("configuracoes", "criar");
  const empresaId = await obterEmpresaAtiva();

  const data = schemaCreate.parse(input);

  const perfil = await prisma.$transaction(async (tx) => {
    const p = await tx.perfil.create({
      data: { empresa_id: empresaId, nome: data.nome, descricao: data.descricao || null },
    });

    for (const { recurso, acao } of data.permissoes) {
      const perm = await garantirPermissao(tx, recurso, acao);
      await tx.perfilPermissao.create({ data: { perfil_id: p.id, permissao_id: perm.id } });
    }

    return p;
  });

  revalidatePath("/configuracoes");
  return { ok: true as const, id: perfil.id };
}

// ─── Editar perfil ────────────────────────────────────────────────────────────

const schemaEdit = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional(),
  permissoes: z.array(z.object({ recurso: z.string(), acao: z.string() })),
});

export async function editarPerfil(id: string, input: z.input<typeof schemaEdit>) {
  await verificarPermissao("configuracoes", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.perfil.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) return { ok: false as const, error: "Perfil não encontrado" };

  const data = schemaEdit.parse(input);

  await prisma.$transaction(async (tx) => {
    await tx.perfil.update({
      where: { id },
      data: { nome: data.nome, descricao: data.descricao || null },
    });

    await tx.perfilPermissao.deleteMany({ where: { perfil_id: id } });

    for (const { recurso, acao } of data.permissoes) {
      const perm = await garantirPermissao(tx, recurso, acao);
      await tx.perfilPermissao.create({ data: { perfil_id: id, permissao_id: perm.id } });
    }
  });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

// ─── Excluir perfil ───────────────────────────────────────────────────────────

export async function excluirPerfil(id: string) {
  await verificarPermissao("configuracoes", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const perfil = await prisma.perfil.findFirst({
    where: { id, empresa_id: empresaId },
    include: { _count: { select: { membros: true } } },
  });
  if (!perfil) return { ok: false as const, error: "Perfil não encontrado" };
  if (perfil._count.membros > 0) {
    return { ok: false as const, error: `Este perfil possui ${perfil._count.membros} membro(s) vinculado(s). Mova-os para outro perfil antes de excluir.` };
  }

  await prisma.perfil.delete({ where: { id } });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

export { TODOS_RECURSOS, TODAS_ACOES };
