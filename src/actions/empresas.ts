"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { criarPerfisPadrao, criarPlanoContasPadrao } from "@/lib/defaults-empresa";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
});

export async function criarEmpresa(input: z.input<typeof schema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const data = schema.parse(input);

  const slug = data.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const slugUnico = `${slug}-${Date.now()}`;

  const empresa = await prisma.$transaction(async (tx) => {
    const novaEmpresa = await tx.empresa.create({
      data: { nome: data.nome, slug: slugUnico, cnpj: data.cnpj || null },
    });

    // Busca todas as permissões para criar perfil Administrador com acesso total
    const permissoes = await tx.permissao.findMany();

    const perfil = await tx.perfil.create({
      data: {
        empresa_id: novaEmpresa.id,
        nome: "Administrador",
        descricao: "Acesso total ao sistema",
      },
    });

    if (permissoes.length > 0) {
      await tx.perfilPermissao.createMany({
        data: permissoes.map((p) => ({
          perfil_id: perfil.id,
          permissao_id: p.id,
        })),
      });
    }

    // Garante que o usuário existe na tabela usuarios
    await tx.usuario.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, nome: user.email ?? "Usuário", email: user.email ?? "" },
    });

    await tx.membroEmpresa.create({
      data: { usuario_id: user.id, empresa_id: novaEmpresa.id, perfil_id: perfil.id },
    });

    // Perfis padrão adicionais (Consultor, Financeiro)
    await criarPerfisPadrao(novaEmpresa.id, tx);

    // Plano de contas padrão
    await criarPlanoContasPadrao(novaEmpresa.id, tx);

    return novaEmpresa;
  });

  return { ok: true, empresaId: empresa.id } as const;
}

// ─── Inicializar empresa existente ───────────────────────────────────────────
// Aplica plano de contas e perfis padrão em empresa que ainda não os tem.

export async function inicializarEmpresaExistente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Não autenticado" };

  const membro = await prisma.membroEmpresa.findFirst({
    where: { usuario_id: user.id, ativo: true },
    include: { perfil: { include: { permissoes: { include: { permissao: true } } } } },
    orderBy: { criado_em: "asc" },
  });
  if (!membro) return { ok: false as const, error: "Nenhuma empresa vinculada" };

  const temPermissao = membro.perfil.permissoes.some(
    (pp) => pp.permissao.recurso === "configuracoes" && pp.permissao.acao === "criar"
  );
  if (!temPermissao) return { ok: false as const, error: "Sem permissão" };

  const empresaId = membro.empresa_id;

  try {
    await prisma.$transaction(async (tx) => {
      // Perfis — só cria os que ainda não existem
      const perfisExistentes = await tx.perfil.findMany({
        where: { empresa_id: empresaId },
        select: { nome: true },
      });
      const nomesExistentes = new Set(perfisExistentes.map((p) => p.nome));

      const PERFIS = ["Consultor", "Financeiro"];
      if (!PERFIS.every((n) => nomesExistentes.has(n))) {
        await criarPerfisPadrao(empresaId, tx);
      }

      // Plano de contas — só cria se estiver vazio
      const qtdContas = await tx.planoDeContas.count({ where: { empresa_id: empresaId } });
      if (qtdContas === 0) {
        await criarPlanoContasPadrao(empresaId, tx);
      }
    });

    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erro ao inicializar empresa" };
  }
}
