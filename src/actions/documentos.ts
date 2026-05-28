"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  arquivo_url: z.string().url("URL inválida"),
  arquivo_nome: z.string().min(1),
  arquivo_tamanho: z.number().min(0),
  mime_type: z.string().min(1),
});

type Input = z.input<typeof schema>;

export async function criarDocumento(projetoId: string, input: Input) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const documento = await prisma.documento.create({
    data: {
      empresa_id: empresaId,
      projeto_id: projetoId,
      criado_por: user?.id,
      titulo: data.titulo,
      arquivo_url: data.arquivo_url,
      arquivo_nome: data.arquivo_nome,
      arquivo_tamanho: data.arquivo_tamanho,
      mime_type: data.mime_type,
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: documento };
}

export async function excluirDocumento(documentoId: string, projetoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const doc = await prisma.documento.findUnique({ where: { id: documentoId } });

  if (doc) {
    const supabase = await createClient();
    const path = new URL(doc.arquivo_url).pathname.split("/documentos/")[1];
    if (path) {
      await supabase.storage.from("documentos").remove([path]);
    }
    await prisma.documento.delete({ where: { id: documentoId } });
  }

  revalidatePath(`/projetos/${projetoId}`);
  return { data: null };
}
