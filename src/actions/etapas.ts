"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  ordem: z.number().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
});

type Input = z.input<typeof schema>;

export async function criarEtapa(projetoId: string, input: Input) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const count = await prisma.etapa.count({ where: { projeto_id: projetoId } });

  const etapa = await prisma.etapa.create({
    data: {
      projeto_id: projetoId,
      titulo: data.titulo,
      descricao: data.descricao || null,
      ordem: data.ordem ?? count,
      data_inicio: data.data_inicio ? new Date(data.data_inicio) : null,
      data_fim: data.data_fim ? new Date(data.data_fim) : null,
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: etapa };
}

export async function editarEtapa(etapaId: string, projetoId: string, input: Input & { status?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const etapa = await prisma.etapa.update({
    where: { id: etapaId },
    data: {
      titulo: data.titulo,
      descricao: data.descricao || null,
      data_inicio: data.data_inicio ? new Date(data.data_inicio) : null,
      data_fim: data.data_fim ? new Date(data.data_fim) : null,
      ...(input.status && { status: input.status as any }),
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: etapa };
}

export async function excluirEtapa(etapaId: string, projetoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  await prisma.etapa.delete({ where: { id: etapaId } });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: null };
}
