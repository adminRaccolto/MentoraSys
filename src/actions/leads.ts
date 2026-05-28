"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { StatusLead } from "@/lib/generated/prisma";

const schemaLead = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  empresa_nome: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  cliente_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  valor_estimado: z.string().optional(),
  origem: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaAtividade = z.object({
  tipo: z.enum(["LIGACAO", "EMAIL", "REUNIAO", "NOTA", "WHATSAPP"]),
  descricao: z.string().min(1, "Descrição obrigatória"),
});

type LeadInput = z.infer<typeof schemaLead>;

export async function criarLead(input: LeadInput) {
  await verificarPermissao("crm", "criar");
  const empresaId = await obterEmpresaAtiva();

  const data = schemaLead.parse(input);

  const lead = await prisma.lead.create({
    data: {
      nome: data.nome,
      empresa_nome: data.empresa_nome || null,
      email: data.email || null,
      telefone: data.telefone || null,
      cliente_id: data.cliente_id || null,
      responsavel_id: data.responsavel_id || null,
      valor_estimado: data.valor_estimado ? parseFloat(data.valor_estimado) : null,
      origem: data.origem || null,
      observacoes: data.observacoes || null,
      empresa_id: empresaId,
    },
  });

  revalidatePath("/crm");
  return { data: lead };
}

export async function editarLead(id: string, input: LeadInput) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.lead.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Lead não encontrado");

  const data = schemaLead.parse(input);

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      nome: data.nome,
      empresa_nome: data.empresa_nome || null,
      email: data.email || null,
      telefone: data.telefone || null,
      cliente_id: data.cliente_id || null,
      responsavel_id: data.responsavel_id || null,
      valor_estimado: data.valor_estimado ? parseFloat(data.valor_estimado) : null,
      origem: data.origem || null,
      observacoes: data.observacoes || null,
    },
  });

  revalidatePath("/crm");
  return { data: lead };
}

export async function moverLead(id: string, novoStatus: StatusLead) {
  await verificarPermissao("crm", "editar");
  const empresaId = await obterEmpresaAtiva();

  const extra: Record<string, unknown> = {};
  if (novoStatus === "GANHO") extra.ganho_em = new Date();
  if (novoStatus === "PERDIDO") extra.perdido_em = new Date();

  const existenteLead = await prisma.lead.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existenteLead) throw new Error("Lead não encontrado");

  const lead = await prisma.lead.update({
    where: { id },
    data: { status: novoStatus, ...extra },
  });

  revalidatePath("/crm");
  return { data: lead };
}

export async function excluirLead(id: string) {
  await verificarPermissao("crm", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existenteDel = await prisma.lead.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existenteDel) throw new Error("Lead não encontrado");

  await prisma.lead.delete({ where: { id } });

  revalidatePath("/crm");
  return { data: null };
}

export async function criarAtividade(
  leadId: string,
  input: z.infer<typeof schemaAtividade>
) {
  await verificarPermissao("crm", "editar");

  const data = schemaAtividade.parse(input);

  const atividade = await prisma.atividadeCRM.create({
    data: { lead_id: leadId, tipo: data.tipo, descricao: data.descricao },
  });

  revalidatePath("/crm");
  return { data: atividade };
}
