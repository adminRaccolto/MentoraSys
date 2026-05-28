"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { criarNotificacao } from "@/lib/notificacoes";

// ─── Gerar convite (interno) ──────────────────────────────────────────────────

export async function gerarConviteCliente() {
  await verificarPermissao("clientes", "criar");
  const empresaId = await obterEmpresaAtiva();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const expira_em = new Date();
  expira_em.setDate(expira_em.getDate() + 30); // expira em 30 dias

  const convite = await prisma.conviteCliente.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id ?? null,
      expira_em,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return {
    ok: true,
    url: `${baseUrl}/convite/${convite.token}`,
    token: convite.token,
  };
}

// ─── Obter dados da empresa pelo token (público, sem auth) ───────────────────

export async function obterConvitePublico(token: string) {
  const convite = await prisma.conviteCliente.findUnique({
    where: { token },
    include: {
      empresa: {
        select: { nome: true, logo_url: true, configuracoes: true },
      },
    },
  });

  if (!convite) return { ok: false, error: "Link inválido" } as const;
  if (convite.usado_em) return { ok: false, error: "Este link já foi utilizado" } as const;
  if (convite.expira_em && new Date() > convite.expira_em) {
    return { ok: false, error: "Este link expirou" } as const;
  }

  const config = (convite.empresa.configuracoes as Record<string, string>) ?? {};

  return {
    ok: true,
    empresa: {
      nome: convite.empresa.nome,
      logo_url: convite.empresa.logo_url ?? null,
      cor_primaria: config.cor_primaria ?? "#1B4F72",
    },
  } as const;
}

// ─── Schema do formulário público ────────────────────────────────────────────

const schemaCadastro = z.object({
  tipo: z.enum(["PESSOA_FISICA", "PESSOA_JURIDICA"]),
  nome: z.string().min(2, "Nome obrigatório"),
  nome_fantasia: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  contato_principal: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  nome_fazenda: z.string().optional(),
});

type CadastroInput = z.input<typeof schemaCadastro>;

// ─── Submeter cadastro (público, sem auth) ────────────────────────────────────

export async function submeterCadastroConvite(token: string, input: CadastroInput) {
  const convite = await prisma.conviteCliente.findUnique({
    where: { token },
    include: { empresa: { select: { id: true, nome: true } } },
  });

  if (!convite) return { ok: false, error: "Link inválido" } as const;
  if (convite.usado_em) return { ok: false, error: "Este link já foi utilizado" } as const;
  if (convite.expira_em && new Date() > convite.expira_em) {
    return { ok: false, error: "Este link expirou" } as const;
  }

  const data = schemaCadastro.parse(input);
  const empresaId = convite.empresa.id;

  const cliente = await prisma.cliente.create({
    data: {
      empresa_id: empresaId,
      nome: data.nome,
      tipo: data.tipo,
      nome_fantasia: data.nome_fantasia || null,
      cpf_cnpj: data.cpf_cnpj || null,
      inscricao_estadual: data.inscricao_estadual || null,
      contato_principal: data.contato_principal || null,
      email: data.email || null,
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      cep: data.cep || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      nome_fazenda: data.nome_fazenda || null,
      status: "ATIVO",
    },
  });

  // Marcar convite como usado e vincular ao cliente
  await prisma.conviteCliente.update({
    where: { token },
    data: { usado_em: new Date(), cliente_id: cliente.id },
  });

  // Notificar todos os membros da empresa
  await criarNotificacao({
    empresa_id: empresaId,
    tipo: "novo_cliente",
    titulo: "Novo cliente cadastrado",
    mensagem: `${data.nome} preencheu o formulário de cadastro.`,
    url: `/clientes`,
  });

  revalidatePath("/clientes");
  return { ok: true } as const;
}
