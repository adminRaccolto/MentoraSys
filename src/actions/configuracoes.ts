"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva, verificarPermissao } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function uploadLogoAction(formData: FormData) {
  const empresaId = await obterEmpresaAtiva();
  const file = formData.get("file") as File | null;
  if (!file) return { ok: false as const, error: "Nenhum arquivo" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${empresaId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = adminClient();
  const { data, error } = await admin.storage
    .from("logos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { ok: false as const, error: error.message };

  const { data: { publicUrl } } = admin.storage.from("logos").getPublicUrl(data.path);

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { logo_url: publicUrl },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true as const, url: publicUrl };
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Não autenticado" };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false as const, error: "Nenhum arquivo" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `avatares/${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = adminClient();
  const { data, error } = await admin.storage
    .from("logos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { ok: false as const, error: error.message };

  const { data: { publicUrl } } = admin.storage.from("logos").getPublicUrl(data.path);

  await prisma.usuario.update({
    where: { id: user.id },
    data: { avatar_url: publicUrl },
  });

  revalidatePath("/configuracoes");
  return { ok: true as const, url: publicUrl };
}

const schemaEmpresa = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
  nome_fantasia: z.string().optional(),
  razao_social: z.string().optional(),
  telefone: z.string().optional(),
  email_contato: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  site: z.string().optional(),
  representante: z.string().optional(),
  representante_cargo: z.string().optional(),
  representante_cpf: z.string().optional(),
});

const schemaPerfil = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
});

type EmpresaInput = z.infer<typeof schemaEmpresa>;
type PerfilInput = z.infer<typeof schemaPerfil>;

export async function atualizarEmpresa(input: EmpresaInput) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaEmpresa.parse(input);

  const { nome, cnpj, ...extra } = data;

  const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { configuracoes: true } });
  const configAtual = (atual?.configuracoes as Record<string, unknown>) ?? {};

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      nome,
      cnpj: cnpj || null,
      configuracoes: { ...configAtual, ...extra },
    },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true };
}

export async function salvarLogoUrl(url: string) {
  const empresaId = await obterEmpresaAtiva();

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { logo_url: url },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true };
}

export async function removerLogo() {
  const empresaId = await obterEmpresaAtiva();

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { logo_url: null },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true };
}

export async function atualizarPerfil(input: PerfilInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const data = schemaPerfil.parse(input);

  await prisma.usuario.upsert({
    where: { id: user.id },
    update: { nome: data.nome },
    create: { id: user.id, nome: data.nome, email: user.email ?? "" },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function salvarAvatarUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  await prisma.usuario.update({
    where: { id: user.id },
    data: { avatar_url: url },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

// ─── Configurações Fiscais ─────────────────────────────────────────────────────

const schemaFiscal = z.object({
  inscricao_municipal: z.string().optional(),
  municipio_ibge: z.string().optional(),
  regime_tributario: z.string().optional(),
  codigo_servico_padrao: z.string().optional(),
  aliquota_iss_padrao: z.coerce.number().min(0).max(100).optional(),
  senha_certificado: z.string().optional(),
});

type FiscalInput = z.infer<typeof schemaFiscal>;

export async function salvarConfigFiscal(input: FiscalInput) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaFiscal.parse(input);

  const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { configuracoes: true } });
  const configAtual = (atual?.configuracoes as Record<string, unknown>) ?? {};

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      configuracoes: {
        ...configAtual,
        inscricao_municipal: data.inscricao_municipal ?? "",
        municipio_ibge: data.municipio_ibge ?? "",
        regime_tributario: data.regime_tributario ?? "",
        codigo_servico_padrao: data.codigo_servico_padrao ?? "",
        aliquota_iss_padrao: data.aliquota_iss_padrao ?? null,
        ...(data.senha_certificado !== undefined ? { senha_certificado: data.senha_certificado } : {}),
      },
    },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function uploadCertificadoAction(formData: FormData) {
  const empresaId = await obterEmpresaAtiva();
  const file = formData.get("file") as File | null;
  if (!file) return { ok: false as const, error: "Nenhum arquivo" };

  if (!file.name.toLowerCase().endsWith(".pfx") && !file.name.toLowerCase().endsWith(".p12")) {
    return { ok: false as const, error: "Formato inválido. Use .pfx ou .p12" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false as const, error: "Arquivo muito grande. Máximo 5 MB." };
  }

  const path = `${empresaId}/certificado.pfx`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = adminClient();
  const { data, error } = await admin.storage
    .from("certificados")
    .upload(path, buffer, { upsert: true, contentType: "application/x-pkcs12" });

  if (error) return { ok: false as const, error: error.message };

  const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { configuracoes: true } });
  const configAtual = (atual?.configuracoes as Record<string, unknown>) ?? {};

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { configuracoes: { ...configAtual, certificado_path: data.path } },
  });

  revalidatePath("/configuracoes");
  return { ok: true as const };
}

export async function removerCertificado() {
  const empresaId = await obterEmpresaAtiva();

  const admin = adminClient();
  await admin.storage.from("certificados").remove([`${empresaId}/certificado.pfx`]);

  const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { configuracoes: true } });
  const configAtual = (atual?.configuracoes as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { certificado_path: _removed, ...resto } = configAtual;

  await prisma.empresa.update({
    where: { id: empresaId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { configuracoes: resto as any },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

// ─── Chave de API Asaas por empresa ──────────────────────────────────────────

const schemaChaveAsaas = z.object({
  chave: z.string().min(1, "Chave obrigatória").startsWith("$aact_", "Chave inválida — deve começar com $aact_"),
});

export async function salvarChaveAsaas(input: z.input<typeof schemaChaveAsaas>) {
  await verificarPermissao("configuracoes", "editar");
  const empresaId = await obterEmpresaAtiva();
  const { chave } = schemaChaveAsaas.parse(input);

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { asaas_api_key: chave },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function removerChaveAsaas() {
  await verificarPermissao("configuracoes", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { asaas_api_key: null },
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function obterChaveAsaasConfigurada(): Promise<boolean> {
  const empresaId = await obterEmpresaAtiva();
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { asaas_api_key: true },
  });
  return !!empresa?.asaas_api_key;
}
