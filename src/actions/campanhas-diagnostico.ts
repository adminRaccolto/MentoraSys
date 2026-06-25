"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  titulo: z.string().min(2),
  subtitulo: z.string().optional(),
  video_youtube: z.string().optional(),
  url_checkout: z.string().url("URL inválida").optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});

export async function criarCampanha(input: z.infer<typeof schema>) {
  await verificarPermissao("crm", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const campanha = await prisma.campanhaDiagnostico.create({
    data: { empresa_id: empresaId, ...data, url_checkout: data.url_checkout || null },
  });

  revalidatePath("/crm/diagnostico");
  return campanha;
}

export async function editarCampanha(id: string, input: z.infer<typeof schema>) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  await prisma.campanhaDiagnostico.updateMany({
    where: { id, empresa_id: empresaId },
    data: { ...data, url_checkout: data.url_checkout || null },
  });

  revalidatePath("/crm/diagnostico");
}

export async function excluirCampanha(id: string) {
  await verificarPermissao("crm", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.campanhaDiagnostico.deleteMany({ where: { id, empresa_id: empresaId } });
  revalidatePath("/crm/diagnostico");
}

export async function listarParticipantes(campanhaId: string) {
  const empresaId = await obterEmpresaAtiva();

  const campanha = await prisma.campanhaDiagnostico.findFirst({
    where: { id: campanhaId, empresa_id: empresaId },
  });
  if (!campanha) throw new Error("Campanha não encontrada");

  return prisma.diagnosticoParticipante.findMany({
    where: { campanha_id: campanhaId },
    orderBy: { criado_em: "desc" },
  });
}
