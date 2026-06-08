"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

// Garante que todos os pares recurso/acao existam e retorna seus IDs
// Usa createMany com skipDuplicates + findMany — 2 queries em vez de N upserts
async function garantirPermissoes(pares: { recurso: string; acao: string }[]) {
  if (pares.length === 0) return [];

  await prisma.permissao.createMany({
    data: pares.map(({ recurso, acao }) => ({
      recurso,
      acao,
      descricao: `${acao} ${recurso}`,
    })),
    skipDuplicates: true,
  });

  return prisma.permissao.findMany({
    where: { OR: pares.map(({ recurso, acao }) => ({ recurso, acao })) },
    select: { id: true },
  });
}

// ─── Listar perfis de uma empresa (para seleção ao criar usuário) ─────────────

export async function listarPerfisEmpresa(empresaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const membro = await prisma.membroEmpresa.findFirst({
    where: { usuario_id: user.id, empresa_id: empresaId, ativo: true },
  });
  if (!membro) return [];

  return prisma.perfil.findMany({
    where: { empresa_id: empresaId },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
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

  // Cria o perfil sem transaction (as permissões vêm a seguir em bulk)
  const perfil = await prisma.perfil.create({
    data: { empresa_id: empresaId, nome: data.nome, descricao: data.descricao || null },
  });

  if (data.permissoes.length > 0) {
    const permissoes = await garantirPermissoes(data.permissoes);
    await prisma.perfilPermissao.createMany({
      data: permissoes.map((p) => ({ perfil_id: perfil.id, permissao_id: p.id })),
      skipDuplicates: true,
    });
  }

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

  // Atualiza nome/descricao e recria permissões em bulk (sem transaction longa)
  await prisma.perfil.update({
    where: { id },
    data: { nome: data.nome, descricao: data.descricao || null },
  });

  await prisma.perfilPermissao.deleteMany({ where: { perfil_id: id } });

  if (data.permissoes.length > 0) {
    const permissoes = await garantirPermissoes(data.permissoes);
    await prisma.perfilPermissao.createMany({
      data: permissoes.map((p) => ({ perfil_id: id, permissao_id: p.id })),
      skipDuplicates: true,
    });
  }

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
