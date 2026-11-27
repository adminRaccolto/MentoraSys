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
