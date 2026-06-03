"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
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

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      nome,
      cnpj: cnpj || null,
      configuracoes: extra,
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
