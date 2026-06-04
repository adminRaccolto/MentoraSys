"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  contrato_id: z.string().optional(),
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
});

type Input = z.input<typeof schema>;

export async function criarProjeto(input: Input) {
  await verificarPermissao("projetos", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const data = schema.parse(input);

  const projeto = await prisma.projeto.create({
    data: {
      empresa_id: empresaId,
      cliente_id: data.cliente_id,
      contrato_id: data.contrato_id || null,
      titulo: data.titulo,
      descricao: data.descricao || null,
      data_inicio: data.data_inicio ? parseLocalDate(data.data_inicio) : null,
      data_fim: data.data_fim ? parseLocalDate(data.data_fim) : null,
      criado_por: user?.id,
    },
  });

  revalidatePath("/projetos");
  return { data: projeto };
}

export async function editarProjeto(id: string, input: Input & { status?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.projeto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const projeto = await prisma.projeto.update({
    where: { id },
    data: {
      cliente_id: data.cliente_id,
      contrato_id: data.contrato_id || null,
      titulo: data.titulo,
      descricao: data.descricao || null,
      data_inicio: data.data_inicio ? parseLocalDate(data.data_inicio) : null,
      data_fim: data.data_fim ? parseLocalDate(data.data_fim) : null,
      ...(input.status && { status: input.status as any }),
    },
  });

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${id}`);
  return { data: projeto };
}

export async function excluirProjeto(id: string) {
  await verificarPermissao("projetos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.projeto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Projeto não encontrado");

  await prisma.projeto.delete({ where: { id } });

  revalidatePath("/projetos");
  return { data: null };
}
