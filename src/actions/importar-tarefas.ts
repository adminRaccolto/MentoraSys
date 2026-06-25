"use server";

import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { revalidatePath } from "next/cache";

export interface TarefaImportada {
  titulo: string;
  descricao?: string;
  etapaId: string;
  responsavelId?: string;
  dataPrazo?: string; // ISO YYYY-MM-DD
}

export interface ResultadoImportacao {
  importadas: number;
  tarefas: { id: string; etapaId: string; titulo: string; descricao: string | null; status: string; data_prazo: Date | null; concluida_em: Date | null; responsavel: { id: string; nome: string } | null; etiquetas: never[] }[];
}

export async function importarTarefas(projetoId: string, tarefas: TarefaImportada[]): Promise<ResultadoImportacao> {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  if (tarefas.length === 0) throw new Error("Nenhuma tarefa para importar");
  if (tarefas.length > 500) throw new Error("Limite de 500 tarefas por importação");

  const criadas = await prisma.$transaction(
    tarefas.map((t) =>
      prisma.tarefa.create({
        data: {
          etapa_id: t.etapaId,
          projeto_id: projetoId,
          titulo: t.titulo.trim(),
          descricao: t.descricao?.trim() || null,
          responsavel_id: t.responsavelId || null,
          data_prazo: t.dataPrazo ? new Date(t.dataPrazo) : null,
          status: "PENDENTE",
        },
        include: { responsavel: { select: { id: true, nome: true } } },
      })
    )
  );

  revalidatePath(`/projetos/${projetoId}`);

  return {
    importadas: criadas.length,
    tarefas: criadas.map((t) => ({
      id: t.id,
      etapaId: t.etapa_id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      data_prazo: t.data_prazo,
      concluida_em: null,
      responsavel: t.responsavel,
      etiquetas: [],
    })),
  };
}
