"use server";

import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { revalidatePath } from "next/cache";

export interface TarefaImportada {
  titulo: string;
  descricao?: string;
  etapaId?: string;    // etapa existente
  etapaNome?: string;  // cria a etapa se não existir
  responsavelId?: string;
  dataPrazo?: string;  // ISO YYYY-MM-DD
}

export interface EtapaCriada {
  id: string;
  titulo: string;
  descricao: null;
  status: "PENDENTE";
  ordem: number;
  data_inicio: null;
  data_fim: null;
  tarefas: never[];
}

export interface ResultadoImportacao {
  importadas: number;
  etapasCriadas: EtapaCriada[];
  tarefas: {
    id: string; etapaId: string; titulo: string; descricao: string | null;
    status: string; data_prazo: Date | null; concluida_em: Date | null;
    responsavel: { id: string; nome: string } | null; etiquetas: never[];
  }[];
}

export async function importarTarefas(projetoId: string, tarefas: TarefaImportada[]): Promise<ResultadoImportacao> {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");
  if (tarefas.length === 0) throw new Error("Nenhuma tarefa para importar");
  if (tarefas.length > 500) throw new Error("Limite de 500 tarefas por importação");

  // ── Cria etapas novas (preserva ordem de aparição) ──────────────────────────
  const nomesNovos = [...new Set(
    tarefas
      .filter((t) => !t.etapaId && t.etapaNome?.trim())
      .map((t) => t.etapaNome!.trim())
  )];

  const etapasCriadas: EtapaCriada[] = [];

  if (nomesNovos.length > 0) {
    const count = await prisma.etapa.count({ where: { projeto_id: projetoId } });
    for (let i = 0; i < nomesNovos.length; i++) {
      const etapa = await prisma.etapa.create({
        data: {
          projeto_id: projetoId,
          titulo: nomesNovos[i],
          ordem: count + i,
          descricao: null,
        },
      });
      etapasCriadas.push({
        id: etapa.id,
        titulo: etapa.titulo,
        descricao: null,
        status: "PENDENTE",
        ordem: etapa.ordem,
        data_inicio: null,
        data_fim: null,
        tarefas: [],
      });
    }
  }

  // Mapa nome → id (inclui etapas recém-criadas)
  const nomeMapa = new Map(etapasCriadas.map((e) => [e.titulo.toLowerCase(), e.id]));

  // Resolve etapaId final para cada tarefa
  const tarefasResolvidas = tarefas.map((t) => ({
    ...t,
    etapaIdFinal: t.etapaId ?? nomeMapa.get(t.etapaNome?.trim().toLowerCase() ?? "") ?? etapasCriadas[0]?.id ?? "",
  }));

  // ── Cria tarefas em batch ────────────────────────────────────────────────────
  const criadas = await prisma.$transaction(
    tarefasResolvidas.map((t) =>
      prisma.tarefa.create({
        data: {
          etapa_id: t.etapaIdFinal,
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
    etapasCriadas,
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
