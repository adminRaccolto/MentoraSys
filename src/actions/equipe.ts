"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { enviarConviteEquipe } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── Convidar membro ─────────────────────────────────────────────────────────

const schemaConvite = z.object({
  email: z.string().email("E-mail inválido"),
  perfil_id: z.string().min(1, "Perfil obrigatório"),
});

export async function convidarMembro(input: z.input<typeof schemaConvite>) {
  await verificarPermissao("configuracoes", "criar");
  const empresaId = await obterEmpresaAtiva();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const data = schemaConvite.parse(input);

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { nome: true },
  });

  const convidador = user
    ? await prisma.usuario.findUnique({ where: { id: user.id }, select: { nome: true } })
    : null;

  // Verifica se já é membro
  const jaEMembro = await prisma.membroEmpresa.findFirst({
    where: {
      empresa_id: empresaId,
      usuario: { email: data.email },
    },
  });
  if (jaEMembro) return { ok: false as const, error: "Este usuário já é membro da empresa" };

  // Verifica se já tem convite pendente
  const convitePendente = await prisma.conviteEmpresa.findFirst({
    where: {
      empresa_id: empresaId,
      email: data.email,
      aceito_em: null,
      expira_em: { gt: new Date() },
    },
  });
  if (convitePendente) return { ok: false as const, error: "Já existe um convite pendente para este e-mail" };

  const expira_em = new Date();
  expira_em.setDate(expira_em.getDate() + 7);

  const convite = await prisma.conviteEmpresa.create({
    data: {
      empresa_id: empresaId,
      email: data.email,
      perfil_id: data.perfil_id,
      convidado_por: user?.id ?? null,
      expira_em,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const linkConvite = `${baseUrl}/membro/${convite.token}`;

  let emailEnviado = false;
  let emailErro: string | undefined;

  try {
    await enviarConviteEquipe(
      data.email,
      empresa?.nome ?? "a empresa",
      convidador?.nome ?? "Um colega",
      convite.token,
    );
    emailEnviado = true;
  } catch (err: unknown) {
    emailErro = err instanceof Error ? err.message : "Erro ao enviar e-mail";
  }

  revalidatePath("/configuracoes");
  return { ok: true as const, emailEnviado, emailErro, link: linkConvite };
}

// ─── Remover membro ───────────────────────────────────────────────────────────

export async function removerMembro(membroId: string) {
  await verificarPermissao("configuracoes", "excluir");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const membro = await prisma.membroEmpresa.findUnique({
    where: { id: membroId },
    select: { usuario_id: true },
  });

  if (membro?.usuario_id === user?.id) {
    return { ok: false as const, error: "Você não pode se remover da empresa" };
  }

  await prisma.membroEmpresa.delete({ where: { id: membroId } });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

// ─── Alterar perfil do membro ─────────────────────────────────────────────────

export async function alterarPerfilMembro(membroId: string, perfilId: string) {
  await verificarPermissao("configuracoes", "editar");

  await prisma.membroEmpresa.update({
    where: { id: membroId },
    data: { perfil_id: perfilId },
  });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

// ─── Criar usuário diretamente (sem convite) ─────────────────────────────────

const schemaCriarUsuario = z.object({
  nome:      z.string().min(2, "Nome obrigatório"),
  email:     z.string().email("E-mail inválido"),
  senha:     z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  perfil_id: z.string().min(1, "Perfil obrigatório"),
});

export async function criarUsuarioDireto(input: z.input<typeof schemaCriarUsuario>) {
  await verificarPermissao("configuracoes", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCriarUsuario.parse(input);

  // Verifica se já é membro
  const jaMembro = await prisma.membroEmpresa.findFirst({
    where: { empresa_id: empresaId, usuario: { email: data.email } },
  });
  if (jaMembro) return { ok: false as const, error: "Este e-mail já é membro da empresa" };

  const admin = adminClient();

  // Verifica se já existe no Supabase Auth
  const { data: listData } = await admin.auth.admin.listUsers();
  const existente = listData?.users?.find((u) => u.email === data.email);

  let userId: string;

  if (existente) {
    userId = existente.id;
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !newUser.user) {
      return { ok: false as const, error: error?.message ?? "Erro ao criar usuário no Supabase" };
    }
    userId = newUser.user.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.upsert({
      where: { id: userId },
      update: { nome: data.nome },
      create: { id: userId, nome: data.nome, email: data.email },
    });

    await tx.membroEmpresa.upsert({
      where: { usuario_id_empresa_id: { usuario_id: userId, empresa_id: empresaId } },
      update: { perfil_id: data.perfil_id, ativo: true },
      create: { usuario_id: userId, empresa_id: empresaId, perfil_id: data.perfil_id, ativo: true },
    });
  });

  revalidatePath("/configuracoes");
  return { ok: true as const, userId };
}

// ─── Cancelar convite ─────────────────────────────────────────────────────────

export async function cancelarConvite(conviteId: string) {
  await verificarPermissao("configuracoes", "excluir");

  await prisma.conviteEmpresa.delete({ where: { id: conviteId } });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

// ─── Aceitar convite (público, sem auth obrigatória) ─────────────────────────

const schemaAceitar = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export async function aceitarConvite(token: string, input: z.input<typeof schemaAceitar>) {
  const convite = await prisma.conviteEmpresa.findUnique({
    where: { token },
    include: {
      empresa: { select: { id: true, nome: true } },
    },
  });

  if (!convite) return { ok: false as const, error: "Link inválido" };
  if (convite.aceito_em) return { ok: false as const, error: "Este convite já foi aceito" };
  if (new Date() > convite.expira_em) return { ok: false as const, error: "Este convite expirou" };

  const data = schemaAceitar.parse(input);
  const admin = adminClient();

  // Verifica se usuário já existe no Supabase
  const { data: listData } = await admin.auth.admin.listUsers();
  const existente = listData?.users?.find((u) => u.email === convite.email);

  let userId: string;

  if (existente) {
    userId = existente.id;
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: convite.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !newUser.user) {
      return { ok: false as const, error: error?.message ?? "Erro ao criar usuário" };
    }
    userId = newUser.user.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.upsert({
      where: { id: userId },
      update: { nome: data.nome },
      create: { id: userId, nome: data.nome, email: convite.email },
    });

    await tx.membroEmpresa.upsert({
      where: { usuario_id_empresa_id: { usuario_id: userId, empresa_id: convite.empresa_id } },
      update: { perfil_id: convite.perfil_id, ativo: true },
      create: {
        usuario_id: userId,
        empresa_id: convite.empresa_id,
        perfil_id: convite.perfil_id,
        ativo: true,
      },
    });

    await tx.conviteEmpresa.update({
      where: { token },
      data: { aceito_em: new Date() },
    });
  });

  return { ok: true as const };
}

// ─── Obter dados do convite (público) ─────────────────────────────────────────

export async function obterConviteEmpresa(token: string) {
  const convite = await prisma.conviteEmpresa.findUnique({
    where: { token },
    include: {
      empresa: { select: { nome: true, logo_url: true } },
    },
  });

  if (!convite) return { ok: false as const, error: "Link inválido" };
  if (convite.aceito_em) return { ok: false as const, error: "Este convite já foi aceito" };
  if (new Date() > convite.expira_em) return { ok: false as const, error: "Este convite expirou" };

  return {
    ok: true as const,
    convite: {
      email: convite.email,
      empresa: {
        nome: convite.empresa.nome,
        logo_url: convite.empresa.logo_url ?? null,
      },
    },
  };
}
