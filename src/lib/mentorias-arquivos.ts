import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "mentorias-privadas";

export const LIMITE_ARQUIVO = 4 * 1024 * 1024;
export const TIPOS_ARQUIVO = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const;

export const arquivosMentoria = supabaseAdmin.storage.from(BUCKET);

export async function prepararArquivosMentoria() {
  const atual = await supabaseAdmin.storage.getBucket(BUCKET);
  if (atual.data) {
    if (atual.data.public) throw new Error("O armazenamento das mentorias precisa ser privado.");
    return;
  }
  const criado = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: LIMITE_ARQUIVO,
    allowedMimeTypes: [...new Set(Object.values(TIPOS_ARQUIVO))],
  });
  if (criado.error) {
    const existente = await supabaseAdmin.storage.getBucket(BUCKET);
    if (!existente.data || existente.data.public) throw criado.error;
  }
}

type MetadadosArquivo = { nome: string; caminho: string; tamanho: number };

export async function baixarArquivoMentoria(arquivo: Pick<MetadadosArquivo, "nome" | "caminho">) {
  const { data, error } = await arquivosMentoria.createSignedUrl(arquivo.caminho, 60, { download: arquivo.nome });
  if (error) return Response.json({ erro: "Arquivo temporariamente indisponível." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function salvarArquivoMentoria(
  request: Request,
  pasta: string,
  registrar: (arquivo: MetadadosArquivo, form: FormData) => Promise<unknown>,
) {
  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size < 1 || arquivo.size > LIMITE_ARQUIVO) {
      return Response.json({ erro: "Selecione um arquivo de até 4 MB." }, { status: 400 });
    }
    const nome = arquivo.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(-180);
    const extensao = nome.split(".").pop()?.toLowerCase();
    if (!extensao || !Object.hasOwn(TIPOS_ARQUIVO, extensao)) {
      return Response.json({ erro: "Formato de arquivo não aceito." }, { status: 400 });
    }
    const caminho = `${pasta}/${randomUUID()}.${extensao}`;
    await prepararArquivosMentoria();
    const { error } = await arquivosMentoria.upload(caminho, arquivo, {
      contentType: TIPOS_ARQUIVO[extensao as keyof typeof TIPOS_ARQUIVO],
      upsert: false,
    });
    if (error) throw error;

    try {
      await registrar({ nome, caminho, tamanho: arquivo.size }, form);
    } catch (erro) {
      await arquivosMentoria.remove([caminho]);
      throw erro;
    }
    return Response.json({ sucesso: "Documento anexado." }, { status: 201 });
  } catch (erro) {
    console.error("Falha ao anexar documento da mentoria", erro instanceof Error ? erro.name : typeof erro);
    return Response.json({ erro: "Não foi possível anexar o documento." }, { status: 500 });
  }
}
