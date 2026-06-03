"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PrioridadeTarefa, StatusAprovacao } from "@/lib/generated/prisma";

const BUCKET = "documentos";

// ─── helpers internos ─────────────────────────────────────────────────────────

async function getAutorId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function registrarAtividade(tarefaId: string, autorId: string | null, descricao: string) {
  await prisma.atividadeTarefa.create({ data: { tarefa_id: tarefaId, autor_id: autorId, descricao } });
}

// ─── SCHEMA base ─────────────────────────────────────────────────────────────

const schema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  responsavel_id: z.string().optional(),
  data_prazo: z.string().optional(),
});

type Input = z.input<typeof schema>;

// ─── CRUD básico ─────────────────────────────────────────────────────────────

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

export async function editarTarefa(tarefaId: string, projetoId: string, input: Input & { status?: string; prioridade?: PrioridadeTarefa }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const autorId = await getAutorId();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const anterior = await prisma.tarefa.findUnique({ where: { id: tarefaId }, select: { status: true, titulo: true } });
  const data = schema.parse(input);

  const tarefa = await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel_id: data.responsavel_id || null,
      data_prazo: data.data_prazo ? new Date(data.data_prazo) : null,
      ...(input.status && { status: input.status as any }),
      ...(input.prioridade && { prioridade: input.prioridade }),
    },
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  if (input.status && anterior?.status !== input.status) {
    await registrarAtividade(tarefaId, autorId, `Status alterado para ${input.status.replace("_", " ")}`);
  }

  revalidatePath(`/projetos/${projetoId}`);
  return { data: tarefa };
}

export async function concluirTarefa(tarefaId: string, projetoId: string, concluida: boolean) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const autorId = await getAutorId();

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  const tarefa = await prisma.tarefa.update({
    where: { id: tarefaId },
    data: { status: concluida ? "CONCLUIDA" : "PENDENTE", concluida_em: concluida ? new Date() : null },
  });

  await registrarAtividade(tarefaId, autorId, concluida ? "Marcou como concluída" : "Reabriu a tarefa");

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

// ─── MOVER TAREFA (drag-and-drop) ────────────────────────────────────────────

export async function moverTarefa(input: {
  tarefaId: string;
  novaEtapaId: string;
  novaOrdem: number;
  projetoId: string;
}) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const projeto = await prisma.projeto.findUnique({ where: { id: input.projetoId, empresa_id: empresaId } });
  if (!projeto) throw new Error("Projeto não encontrado");

  await prisma.tarefa.update({
    where: { id: input.tarefaId },
    data: { etapa_id: input.novaEtapaId, ordem: input.novaOrdem },
  });

  return { ok: true };
}

// ─── CARREGAR TAREFA COMPLETA ─────────────────────────────────────────────────

export async function carregarTarefaCompleta(tarefaId: string) {
  await verificarPermissao("projetos", "listar");
  const empresaId = await obterEmpresaAtiva();

  const tarefa = await prisma.tarefa.findFirst({
    where: { id: tarefaId, projeto: { empresa_id: empresaId } },
    include: {
      responsavel: { select: { id: true, nome: true, avatar_url: true } },
      etapa: { select: { id: true, titulo: true } },
      projeto: { select: { id: true, titulo: true } },
      comentarios: {
        include: { autor: { select: { id: true, nome: true, avatar_url: true } } },
        orderBy: { criado_em: "asc" },
      },
      checklist: { orderBy: { ordem: "asc" } },
      anexos: {
        include: { criador: { select: { id: true, nome: true } } },
        orderBy: { criado_em: "desc" },
      },
      atividades: {
        include: { autor: { select: { id: true, nome: true } } },
        orderBy: { criado_em: "desc" },
        take: 30,
      },
      aprovacoes: {
        include: {
          solicitante: { select: { id: true, nome: true } },
          aprovador: { select: { id: true, nome: true } },
        },
        orderBy: { criado_em: "desc" },
      },
      etiquetas: {
        include: { etiqueta: true },
      },
    },
  });

  if (!tarefa) throw new Error("Tarefa não encontrada");
  return tarefa;
}

// ─── COMENTÁRIOS ─────────────────────────────────────────────────────────────

export async function adicionarComentario(tarefaId: string, conteudo: string) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const comentario = await prisma.comentarioTarefa.create({
    data: { tarefa_id: tarefaId, autor_id: autorId, conteudo },
    include: { autor: { select: { id: true, nome: true, avatar_url: true } } },
  });

  await registrarAtividade(tarefaId, autorId, "Adicionou um comentário");
  return { ok: true, comentario };
}

export async function excluirComentario(comentarioId: string) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const c = await prisma.comentarioTarefa.findUnique({ where: { id: comentarioId } });
  if (!c) return { ok: false };

  await prisma.comentarioTarefa.delete({ where: { id: comentarioId } });
  await registrarAtividade(c.tarefa_id, autorId, "Removeu um comentário");
  return { ok: true };
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────

export async function adicionarItemChecklist(tarefaId: string, texto: string) {
  await verificarPermissao("projetos", "editar");

  const ultimo = await prisma.itemChecklist.findFirst({
    where: { tarefa_id: tarefaId }, orderBy: { ordem: "desc" }, select: { ordem: true },
  });

  const item = await prisma.itemChecklist.create({
    data: { tarefa_id: tarefaId, texto, ordem: (ultimo?.ordem ?? -1) + 1 },
  });
  return { ok: true, item };
}

export async function toggleItemChecklist(itemId: string, concluido: boolean) {
  await verificarPermissao("projetos", "editar");
  const item = await prisma.itemChecklist.update({ where: { id: itemId }, data: { concluido } });
  return { ok: true, item };
}

export async function excluirItemChecklist(itemId: string) {
  await verificarPermissao("projetos", "editar");
  await prisma.itemChecklist.delete({ where: { id: itemId } });
  return { ok: true };
}

// ─── ANEXOS DA TAREFA ─────────────────────────────────────────────────────────

export async function criarUrlUploadAnexo(arquivoNome: string, mimeType: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const ext = arquivoNome.split(".").pop() ?? "bin";
  const caminho = `${empresaId}/tarefas/${Date.now()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) throw new Error(error?.message ?? "Erro ao gerar URL de upload");

  return { caminho, signedUrl: data.signedUrl };
}

export async function confirmarUploadAnexo(input: {
  tarefaId: string;
  nome: string;
  caminho: string;
  tamanho: number;
  mimeType: string;
}) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(input.caminho);

  const anexo = await prisma.anexoTarefa.create({
    data: {
      tarefa_id: input.tarefaId,
      criado_por: autorId,
      nome: input.nome,
      arquivo_url: urlData.publicUrl,
      arquivo_tamanho: input.tamanho,
      mime_type: input.mimeType,
    },
    include: { criador: { select: { id: true, nome: true } } },
  });

  await registrarAtividade(input.tarefaId, autorId, `Anexou "${input.nome}"`);
  return { ok: true, anexo };
}

export async function excluirAnexoTarefa(anexoId: string) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const anexo = await prisma.anexoTarefa.findUnique({ where: { id: anexoId } });
  if (!anexo) return { ok: false };

  const caminho = new URL(anexo.arquivo_url).pathname
    .split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (caminho) await supabaseAdmin.storage.from(BUCKET).remove([caminho]);

  await prisma.anexoTarefa.delete({ where: { id: anexoId } });
  await registrarAtividade(anexo.tarefa_id, autorId, `Removeu o anexo "${anexo.nome}"`);
  return { ok: true };
}

// ─── APROVAÇÃO ────────────────────────────────────────────────────────────────

export async function solicitarAprovacao(tarefaId: string, aprovadorId: string) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const aprovacao = await prisma.aprovacaoTarefa.create({
    data: { tarefa_id: tarefaId, solicitante_id: autorId, aprovador_id: aprovadorId, status: "PENDENTE" },
    include: {
      solicitante: { select: { id: true, nome: true } },
      aprovador: { select: { id: true, nome: true } },
    },
  });

  await registrarAtividade(tarefaId, autorId, `Solicitou aprovação de ${aprovacao.aprovador?.nome ?? "—"}`);
  return { ok: true, aprovacao };
}

export async function decidirAprovacao(aprovacaoId: string, decisao: "APROVADO" | "REPROVADO", comentario?: string) {
  await verificarPermissao("projetos", "editar");
  const autorId = await getAutorId();

  const aprovacao = await prisma.aprovacaoTarefa.update({
    where: { id: aprovacaoId },
    data: { status: decisao as StatusAprovacao, comentario: comentario ?? null, decidido_em: new Date() },
  });

  await registrarAtividade(
    aprovacao.tarefa_id, autorId,
    decisao === "APROVADO" ? "Aprovou a tarefa" : `Reprovou a tarefa${comentario ? `: ${comentario}` : ""}`
  );
  return { ok: true, aprovacao };
}
