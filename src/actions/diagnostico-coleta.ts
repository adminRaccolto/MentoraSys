"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { MomentoDiagnostico } from "@/lib/generated/prisma";

// ─── Tipo das respostas (JSON estruturado) ────────────────────────────────────

export type RespostaFazenda = {
  nome: string;
  area_arrendada: number | null;
  valor_arrendamento: number | null;
  tipo_arrendamento: "Reais/ha" | "Sc/ha";
  area_plantio_propria: number | null;
  culturas: { nome: string; produtividade_media: number | null; area_ultima_safra: number | null }[];
  funcionarios_fixos: number | null;
  operacoes_terceirizadas: string[];
};

export type RespostasDiagnostico = {
  fazendas: RespostaFazenda[];
  custos_por_cultura: { cultura: string; insumos_sc_ha: number | null; operacao_sc_ha: number | null }[];
  fluxo_caixa_meses: string;
  financiamento_insumo: string;
  captacao_safra: string;
  margem_custo_financeiro: string;
  renegociou_dividas: string;
  sistema_gestao: string;
  nome_sistema: string;
  confia_sistema: string;
  executor_tarefas_admin: string;
  comprador_insumos: string[];
  decisao_compras: string;
};

// ─── LISTAR ──────────────────────────────────────────────────────────────────

export async function listarDiagnosticosColeta(projetoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  return prisma.aplicacaoDiagnostico.findMany({
    where: { projeto_id: projetoId, empresa_id: empresaId },
    orderBy: { momento: "asc" },
  });
}

// ─── CRIAR ────────────────────────────────────────────────────────────────────

export async function criarAplicacaoDiagnostico(projetoId: string, momento: MomentoDiagnostico) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const projeto = await prisma.projeto.findFirst({
    where: { id: projetoId, empresa_id: empresaId },
    select: { cliente_id: true },
  });
  if (!projeto) throw new Error("Projeto não encontrado");

  const aplicacao = await prisma.aplicacaoDiagnostico.create({
    data: {
      empresa_id: empresaId,
      projeto_id: projetoId,
      cliente_id: projeto.cliente_id,
      criado_por: user?.id ?? null,
      momento,
    },
  });

  revalidatePath(`/projetos/${projetoId}`);
  return { ok: true, aplicacao };
}

// ─── ENVIAR (marca como enviado + registra timestamp) ─────────────────────────

export async function marcarDiagnosticoEnviado(aplicacaoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const aplicacao = await prisma.aplicacaoDiagnostico.findFirst({
    where: { id: aplicacaoId, empresa_id: empresaId },
  });
  if (!aplicacao) throw new Error("Aplicação não encontrada");

  const updated = await prisma.aplicacaoDiagnostico.update({
    where: { id: aplicacaoId },
    data: { status: "ENVIADO", enviado_em: new Date() },
  });

  revalidatePath(`/projetos/${aplicacao.projeto_id}`);
  return { ok: true, aplicacao: updated };
}

// ─── RESPONDER (chamado pela página pública — sem autenticação) ───────────────

export async function responderDiagnostico(token: string, respostas: RespostasDiagnostico) {
  const aplicacao = await prisma.aplicacaoDiagnostico.findUnique({
    where: { token },
    select: { id: true, status: true, projeto_id: true },
  });

  if (!aplicacao) throw new Error("Diagnóstico não encontrado");
  if (aplicacao.status === "RESPONDIDO") throw new Error("Este diagnóstico já foi respondido");

  await prisma.aplicacaoDiagnostico.update({
    where: { token },
    data: {
      status: "RESPONDIDO",
      respostas: respostas as any,
      respondido_em: new Date(),
    },
  });

  revalidatePath(`/projetos/${aplicacao.projeto_id}`);
  return { ok: true };
}

// ─── BUSCAR POR TOKEN (página pública) ───────────────────────────────────────

export async function buscarDiagnosticoPorToken(token: string) {
  const aplicacao = await prisma.aplicacaoDiagnostico.findUnique({
    where: { token },
    include: {
      projeto: { select: { titulo: true } },
      cliente: { select: { nome: true } },
      empresa: { select: { nome: true, logo_url: true } },
    },
  });
  return aplicacao;
}

// ─── BUSCAR RESPOSTAS (para comparação) ──────────────────────────────────────

export async function buscarRespostasDiagnostico(projetoId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  return prisma.aplicacaoDiagnostico.findMany({
    where: { projeto_id: projetoId, empresa_id: empresaId, status: "RESPONDIDO" },
    select: { momento: true, respostas: true, respondido_em: true },
    orderBy: { momento: "asc" },
  });
}
