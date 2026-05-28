"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  responsavel_id: z.string().optional(),
  data_prazo: z.string().optional(),
});

type Input = z.input<typeof schema>;

export async function criarTarefa(etapaId: string, projetoId: string, input: Input) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const tarefa = await prisma.tarefa.create({
    data: {
      etapa_id: etapaId,
      projeto_id: projetoId,
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel_id: data.responsavel_id || null,
      data_prazo: data.data_prazo ? new Date(data.data_prazo) : null,
    },
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: tarefa };
}

export async function editarTarefa(tarefaId: string, projetoId: string, input: Input & { status?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const tarefa = await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel_id: data.responsavel_id || null,
      data_prazo: data.data_prazo ? new Date(data.data_prazo) : null,
      ...(input.status && { status: input.status as any }),
    },
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: tarefa };
}

export async function concluirTarefa(tarefaId: string, projetoId: string, concluida: boolean) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const tarefa = await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      status: concluida ? "CONCLUIDA" : "PENDENTE",
      concluida_em: concluida ? new Date() : null,
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: tarefa };
}

export async function excluirTarefa(tarefaId: string, projetoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  await prisma.tarefa.delete({ where: { id: tarefaId } });

  revalidatePath(`/projetos/${projetoId}`);
  return { data: null };
}
