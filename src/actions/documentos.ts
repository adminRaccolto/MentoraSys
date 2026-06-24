"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CategoriaDocumento } from "@/lib/generated/prisma";

// ─── PASTAS ──────────────────────────────────────────────────────────────────

export async function listarPastas() {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  return prisma.pastaDocumento.findMany({
    where: { empresa_id: empresaId },
    include: { _count: { select: { documentos: true, filhos: true } } },
    orderBy: { nome: "asc" },
  });
}

export async function criarPasta(input: { nome: string; descricao?: string; parent_id?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const pasta = await prisma.pastaDocumento.create({
    data: {
      empresa_id: empresaId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      parent_id: input.parent_id || null,
      criado_por: user?.id ?? null,
    },
    include: { _count: { select: { documentos: true, filhos: true } } },
  });
  revalidatePath("/documentos");
  return { ok: true as const, pasta };
}

export async function editarPasta(id: string, input: { nome: string; descricao?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.pastaDocumento.updateMany({
    where: { id, empresa_id: empresaId },
    data: { nome: input.nome.trim(), descricao: input.descricao?.trim() || null },
  });
  revalidatePath("/documentos");
  return { ok: true as const };
}

export async function excluirPasta(id: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const pasta = await prisma.pastaDocumento.findFirst({ where: { id, empresa_id: empresaId } });
  if (!pasta) return { ok: false as const, error: "Pasta não encontrada" };

  // Remove vínculo dos documentos filhos e subpastas cascadeiam pelo schema
  await prisma.documento.updateMany({ where: { pasta_id: id }, data: { pasta_id: null } });
  await prisma.pastaDocumento.delete({ where: { id } });
  revalidatePath("/documentos");
  return { ok: true as const };
}

export async function moverDocumento(documentoId: string, pasta_id: string | null) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.documento.updateMany({
    where: { id: documentoId, empresa_id: empresaId },
    data: { pasta_id },
  });
  revalidatePath("/documentos");
  return { ok: true as const };
}

const BUCKET = "documentos";

// ─── LISTAR ──────────────────────────────────────────────────────────────────

export async function listarDocumentos(filtros?: {
  categoria?: CategoriaDocumento;
  projeto_id?: string;
  cliente_id?: string;
  contrato_id?: string;
  busca?: string;
}) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  return prisma.documento.findMany({
    where: {
      empresa_id: empresaId,
      ...(filtros?.categoria && { categoria: filtros.categoria }),
      ...(filtros?.projeto_id && { projeto_id: filtros.projeto_id }),
      ...(filtros?.cliente_id && { cliente_id: filtros.cliente_id }),
      ...(filtros?.contrato_id && { contrato_id: filtros.contrato_id }),
      ...(filtros?.busca && {
        OR: [
          { titulo: { contains: filtros.busca, mode: "insensitive" } },
          { descricao: { contains: filtros.busca, mode: "insensitive" } },
          { arquivo_nome: { contains: filtros.busca, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      criador: { select: { id: true, nome: true, avatar_url: true } },
      projeto: { select: { id: true, titulo: true } },
      cliente: { select: { id: true, nome: true } },
      contrato: { select: { id: true, titulo: true } },
    },
    orderBy: { criado_em: "desc" },
  });
}

// ─── GERAR URL ASSINADA DE UPLOAD ─────────────────────────────────────────────

export async function criarUrlUpload(input: {
  arquivo_nome: string;
  mime_type: string;
}) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const extensao = input.arquivo_nome.split(".").pop() ?? "bin";
  const caminho = `${empresaId}/${Date.now()}.${extensao}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(caminho);

  if (error || !data) throw new Error(error?.message ?? "Erro ao gerar URL de upload");

  return { caminho, signedUrl: data.signedUrl, token: data.token };
}

// ─── CONFIRMAR UPLOAD (registra no banco após upload direto ao Storage) ───────

export async function confirmarUpload(input: {
  titulo: string;
  descricao?: string;
  categoria: CategoriaDocumento;
  caminho: string;
  arquivo_nome: string;
  arquivo_tamanho: number;
  mime_type: string;
  projeto_id?: string;
  cliente_id?: string;
  contrato_id?: string;
  pasta_id?: string;
}) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(input.caminho);

  const doc = await prisma.documento.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id ?? null,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      categoria: input.categoria,
      arquivo_url: urlData.publicUrl,
      arquivo_nome: input.arquivo_nome,
      arquivo_tamanho: input.arquivo_tamanho,
      mime_type: input.mime_type,
      projeto_id: input.projeto_id ?? null,
      cliente_id: input.cliente_id ?? null,
      contrato_id: input.contrato_id ?? null,
      pasta_id: input.pasta_id ?? null,
    },
  });

  revalidatePath("/documentos");
  return { ok: true, doc };
}

// ─── URL DE DOWNLOAD PRÉ-ASSINADA (1 hora) ───────────────────────────────────

export async function obterUrlDownload(documentoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const doc = await prisma.documento.findFirst({
    where: { id: documentoId, empresa_id: empresaId },
    select: { arquivo_url: true, arquivo_nome: true },
  });

  if (!doc) throw new Error("Documento não encontrado");

  const caminho = new URL(doc.arquivo_url).pathname
    .split(`/storage/v1/object/public/${BUCKET}/`)[1];

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 3600);

  if (error || !data) throw new Error("Erro ao gerar link de download");

  return { url: data.signedUrl, nome: doc.arquivo_nome };
}

// ─── EXCLUIR ─────────────────────────────────────────────────────────────────

export async function excluirDocumento(documentoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const doc = await prisma.documento.findFirst({
    where: { id: documentoId, empresa_id: empresaId },
    select: { arquivo_url: true },
  });

  if (!doc) return { ok: false, error: "Documento não encontrado" };

  const caminho = new URL(doc.arquivo_url).pathname
    .split(`/storage/v1/object/public/${BUCKET}/`)[1];

  if (caminho) await supabaseAdmin.storage.from(BUCKET).remove([caminho]);

  await prisma.documento.delete({ where: { id: documentoId } });

  revalidatePath("/documentos");
  return { ok: true };
}

// ─── ATUALIZAR METADADOS ──────────────────────────────────────────────────────

export async function atualizarDocumento(
  documentoId: string,
  data: { titulo?: string; descricao?: string; categoria?: CategoriaDocumento }
) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const resultado = await prisma.documento.updateMany({
    where: { id: documentoId, empresa_id: empresaId },
    data,
  });

  revalidatePath("/documentos");
  return { ok: resultado.count > 0 };
}

// ─── UPLOAD LEGADO (de dentro de projeto — mantém compatibilidade) ────────────

export async function criarDocumento(
  projetoId: string,
  input: {
    titulo: string;
    arquivo_url: string;
    arquivo_nome: string;
    arquivo_tamanho: number;
    mime_type: string;
  }
) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId, empresa_id: empresaId },
  });
  if (!projeto) throw new Error("Projeto não encontrado");

  const documento = await prisma.documento.create({
    data: {
      empresa_id: empresaId,
      projeto_id: projetoId,
      criado_por: user?.id ?? null,
      titulo: input.titulo,
      arquivo_url: input.arquivo_url,
      arquivo_nome: input.arquivo_nome,
      arquivo_tamanho: input.arquivo_tamanho,
      mime_type: input.mime_type,
      categoria: "PROJETO",
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: documento };
}
