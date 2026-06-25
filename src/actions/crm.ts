"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";

// ─── ETAPAS CRM ──────────────────────────────────────────────────────────────

const ETAPAS_PADRAO = [
  { chave: "NOVO",       nome: "Novo",              cor: "#64748b", ordem: 0 },
  { chave: "CONTATO",    nome: "Em contato",        cor: "#3b82f6", ordem: 1 },
  { chave: "QUALIFICADO",nome: "Qualificado",       cor: "#8b5cf6", ordem: 2 },
  { chave: "PROPOSTA",   nome: "Proposta enviada",  cor: "#f59e0b", ordem: 3 },
  { chave: "NEGOCIACAO", nome: "Em negociação",     cor: "#f97316", ordem: 4 },
  { chave: "GANHO",      nome: "Ganho",             cor: "#22c55e", ordem: 5 },
  { chave: "PERDIDO",    nome: "Perdido",           cor: "#ef4444", ordem: 6 },
];

export async function listarEtapas() {
  const empresaId = await obterEmpresaAtiva();

  let etapas = await prisma.etapaCrm.findMany({
    where: { empresa_id: empresaId },
    orderBy: { ordem: "asc" },
  });

  if (etapas.length === 0) {
    etapas = await prisma.$transaction(
      ETAPAS_PADRAO.map((e) =>
        prisma.etapaCrm.create({ data: { empresa_id: empresaId, ...e } })
      )
    );
    etapas = etapas.sort((a, b) => a.ordem - b.ordem);
  }

  return etapas;
}

export async function criarEtapa(input: { nome: string; cor: string }) {
  await verificarPermissao("crm", "criar");
  const empresaId = await obterEmpresaAtiva();

  const chave = input.nome.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
  const maxOrdem = await prisma.etapaCrm.aggregate({ where: { empresa_id: empresaId }, _max: { ordem: true } });
  const ordem = (maxOrdem._max.ordem ?? -1) + 1;

  const etapa = await prisma.etapaCrm.create({
    data: { empresa_id: empresaId, chave: `${chave}_${Date.now()}`, nome: input.nome.trim(), cor: input.cor, ordem },
  });

  revalidatePath("/crm");
  return etapa;
}

export async function editarEtapa(id: string, input: { nome: string; cor: string }) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.etapaCrm.updateMany({
    where: { id, empresa_id: empresaId },
    data: { nome: input.nome.trim(), cor: input.cor },
  });

  revalidatePath("/crm");
}

export async function reordenarEtapas(ids: string[]) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.$transaction(
    ids.map((id, idx) => prisma.etapaCrm.updateMany({ where: { id, empresa_id: empresaId }, data: { ordem: idx } }))
  );

  revalidatePath("/crm");
}

export async function excluirEtapa(id: string) {
  await verificarPermissao("crm", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const etapa = await prisma.etapaCrm.findFirst({ where: { id, empresa_id: empresaId } });
  if (!etapa) throw new Error("Etapa não encontrada");

  const primeiraEtapa = await prisma.etapaCrm.findFirst({
    where: { empresa_id: empresaId, id: { not: id } },
    orderBy: { ordem: "asc" },
  });

  if (primeiraEtapa) {
    await prisma.lead.updateMany({
      where: { empresa_id: empresaId, etapa_chave: etapa.chave },
      data: { etapa_chave: primeiraEtapa.chave, etapa_id: primeiraEtapa.id },
    });
  }

  await prisma.etapaCrm.delete({ where: { id } });
  revalidatePath("/crm");
}

// ─── LEADS / OPORTUNIDADES ───────────────────────────────────────────────────

const schemaLead = z.object({
  nome: z.string().min(1, "Título obrigatório"),
  empresa_nome: z.string().min(1, "Empresa/lead obrigatório"),
  contato_nome: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  origem: z.string().optional(),
  servico_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  cliente_id: z.string().optional(),
  valor_estimado: z.coerce.number().positive().optional().nullable(),
  etapa_chave: z.string().default("NOVO"),
  etapa_id: z.string().optional().nullable(),
  probabilidade: z.coerce.number().min(0).max(100).default(10),
  previsao_fechamento: z.string().optional().nullable(),
  proxima_acao: z.string().optional(),
  data_proxima_acao: z.string().optional().nullable(),
  motivo_perda: z.string().optional(),
  observacoes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

type LeadInput = z.input<typeof schemaLead>;

export async function listarLeads(filtros?: { etapa_chave?: string; responsavel_id?: string; servico_id?: string }) {
  const empresaId = await obterEmpresaAtiva();

  return prisma.lead.findMany({
    where: {
      empresa_id: empresaId,
      ...(filtros?.etapa_chave && { etapa_chave: filtros.etapa_chave }),
      ...(filtros?.responsavel_id && { responsavel_id: filtros.responsavel_id }),
      ...(filtros?.servico_id && { servico_id: filtros.servico_id }),
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      servico: { select: { id: true, nome: true } },
      comentarios: { orderBy: { criado_em: "asc" } },
    },
    orderBy: { criado_em: "desc" },
  });
}

export async function criarLead(input: LeadInput) {
  await verificarPermissao("crm", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaLead.parse(input);

  const lead = await prisma.lead.create({
    data: {
      empresa_id: empresaId,
      nome: data.nome,
      empresa_nome: data.empresa_nome || null,
      contato_nome: data.contato_nome || null,
      email: data.email || null,
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      origem: data.origem || null,
      servico_id: data.servico_id || null,
      responsavel_id: data.responsavel_id || null,
      cliente_id: data.cliente_id || null,
      valor_estimado: data.valor_estimado ?? null,
      etapa_chave: data.etapa_chave,
      etapa_id: data.etapa_id || null,
      probabilidade: data.probabilidade,
      previsao_fechamento: data.previsao_fechamento ? new Date(data.previsao_fechamento) : null,
      proxima_acao: data.proxima_acao || null,
      data_proxima_acao: data.data_proxima_acao ? new Date(data.data_proxima_acao) : null,
      motivo_perda: data.motivo_perda || null,
      observacoes: data.observacoes || null,
      tags: data.tags,
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      servico: { select: { id: true, nome: true } },
      comentarios: true,
    },
  });

  await registrar({ recurso: "crm", acao: "criar", registroId: lead.id });
  revalidatePath("/crm");
  return lead;
}

export async function editarLead(id: string, input: LeadInput) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaLead.parse(input);

  const existente = await prisma.lead.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Lead não encontrado");

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      nome: data.nome,
      empresa_nome: data.empresa_nome || null,
      contato_nome: data.contato_nome || null,
      email: data.email || null,
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      origem: data.origem || null,
      servico_id: data.servico_id || null,
      responsavel_id: data.responsavel_id || null,
      cliente_id: data.cliente_id || null,
      valor_estimado: data.valor_estimado ?? null,
      etapa_chave: data.etapa_chave,
      etapa_id: data.etapa_id || null,
      probabilidade: data.probabilidade,
      previsao_fechamento: data.previsao_fechamento ? new Date(data.previsao_fechamento) : null,
      proxima_acao: data.proxima_acao || null,
      data_proxima_acao: data.data_proxima_acao ? new Date(data.data_proxima_acao) : null,
      motivo_perda: data.motivo_perda || null,
      observacoes: data.observacoes || null,
      tags: data.tags,
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      servico: { select: { id: true, nome: true } },
      comentarios: { orderBy: { criado_em: "asc" } },
    },
  });

  await registrar({ recurso: "crm", acao: "editar", registroId: id });
  revalidatePath("/crm");
  return lead;
}

export async function moverLead(id: string, etapa_chave: string, etapa_id: string | null) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.lead.updateMany({
    where: { id, empresa_id: empresaId },
    data: { etapa_chave, etapa_id: etapa_id ?? null },
  });

  revalidatePath("/crm");
}

export async function excluirLead(id: string) {
  await verificarPermissao("crm", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.lead.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Lead não encontrado");

  await prisma.lead.delete({ where: { id } });
  await registrar({ recurso: "crm", acao: "excluir", registroId: id });
  revalidatePath("/crm");
}

// ─── COMENTÁRIOS ─────────────────────────────────────────────────────────────

export async function adicionarComentario(leadId: string, mensagem: string) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const lead = await prisma.lead.findFirst({ where: { id: leadId, empresa_id: empresaId } });
  if (!lead) throw new Error("Lead não encontrado");

  const membro = user
    ? await prisma.usuario.findUnique({ where: { id: user.id }, select: { nome: true } })
    : null;

  const comentario = await prisma.comentarioCrm.create({
    data: {
      lead_id: leadId,
      usuario_id: user?.id ?? null,
      autor_nome: membro?.nome ?? "Usuário",
      mensagem: mensagem.trim(),
    },
  });

  revalidatePath("/crm");
  return comentario;
}

// ─── CONVERSÃO DE LEAD ───────────────────────────────────────────────────────

export async function converterLead(id: string, opcoes: { criarContrato: boolean; criarProjeto: boolean }) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const lead = await prisma.lead.findFirst({
    where: { id, empresa_id: empresaId },
    include: { cliente: true, servico: true },
  });
  if (!lead) throw new Error("Lead não encontrado");

  return await prisma.$transaction(async (tx) => {
    let clienteId = lead.cliente_id;

    if (!clienteId && lead.empresa_nome) {
      const novoCliente = await tx.cliente.create({
        data: {
          empresa_id: empresaId,
          nome: lead.contato_nome || lead.empresa_nome,
          nome_fantasia: lead.empresa_nome,
          email: lead.email ?? null,
          telefone: lead.telefone ?? null,
          whatsapp: lead.whatsapp ?? null,
        },
      });
      clienteId = novoCliente.id;
      await tx.lead.update({ where: { id }, data: { cliente_id: clienteId } });
    }

    let contratoId: string | null = null;
    if (opcoes.criarContrato && clienteId) {
      const contrato = await tx.contrato.create({
        data: {
          empresa_id: empresaId,
          cliente_id: clienteId,
          titulo: lead.nome,
          criado_por: user?.id ?? null,
          responsavel_id: lead.responsavel_id ?? null,
          valor_total: lead.valor_estimado ?? 0,
          numero_parcelas: 1,
        },
      });
      contratoId = contrato.id;
    }

    let projetoId: string | null = null;
    if (opcoes.criarProjeto && clienteId) {
      const projeto = await tx.projeto.create({
        data: {
          empresa_id: empresaId,
          cliente_id: clienteId,
          criado_por: user?.id ?? null,
          titulo: lead.nome,
          contrato_id: contratoId ?? null,
        },
      });
      projetoId = projeto.id;
    }

    await tx.lead.update({
      where: { id },
      data: { etapa_chave: "GANHO" },
    });

    await registrar({ recurso: "crm", acao: "editar", registroId: id });
    revalidatePath("/crm");
    revalidatePath("/contratos");
    revalidatePath("/projetos");

    return { clienteId, contratoId, projetoId };
  });
}
