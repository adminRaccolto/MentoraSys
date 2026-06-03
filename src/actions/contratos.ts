"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";

const schemaContrato = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  proposta_id: z.string().optional().nullable(),
  responsavel_id: z.string().optional().nullable(),
  numero_contrato: z.string().optional(),
  tipo_contrato: z.string().optional(),
  titulo: z.string().min(2, "Título obrigatório"),
  objeto: z.string().optional(),
  conteudo: z.string().optional(),
  valor_total: z.coerce.number().min(0).optional().nullable(),
  forma_pagamento: z.string().optional(),
  periodicidade: z.string().optional(),
  numero_parcelas: z.coerce.number().int().positive().optional().nullable(),
  primeiro_vencimento: z.string().optional(),
  dia_vencimento: z.coerce.number().int().min(1).max(31).optional().nullable(),
  indice_reajuste: z.string().optional(),
  periodicidade_reajuste: z.string().optional(),
  renovacao_automatica: z.boolean().default(false),
  gerar_projeto: z.boolean().default(false),
  gerar_financeiro: z.boolean().default(true),
  data_emissao: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  cliente_nome: z.string().optional(),
  cliente_cpf_cnpj: z.string().optional(),
  cliente_contato_nome: z.string().optional(),
  cliente_contato_email: z.string().optional(),
  cliente_contato_tel: z.string().optional(),
  parcelas_json: z.array(z.object({ numero: z.number(), vencimento: z.string(), valor: z.number() })).optional(),
});

type ContratoInput = z.infer<typeof schemaContrato>;

export async function criarContrato(input: ContratoInput) {
  await verificarPermissao("contratos", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const data = schemaContrato.parse(input);

  const cliente = await prisma.cliente.findUnique({
    where: { id: data.cliente_id },
    select: { nome: true, cpf_cnpj: true, contato_principal: true, email: true, telefone: true },
  });

  const contrato = await prisma.contrato.create({
    data: {
      empresa_id: empresaId,
      cliente_id: data.cliente_id,
      proposta_id: data.proposta_id || null,
      responsavel_id: data.responsavel_id || null,
      criado_por: user?.id,
      numero_contrato: data.numero_contrato || null,
      tipo_contrato: data.tipo_contrato || null,
      titulo: data.titulo,
      objeto: data.objeto || null,
      conteudo: data.conteudo || null,
      valor_total: data.valor_total ?? 0,
      forma_pagamento: data.forma_pagamento || null,
      periodicidade: data.periodicidade || null,
      numero_parcelas: data.numero_parcelas ?? null,
      primeiro_vencimento: data.primeiro_vencimento ? new Date(data.primeiro_vencimento) : null,
      dia_vencimento: data.dia_vencimento ?? null,
      indice_reajuste: data.indice_reajuste || null,
      periodicidade_reajuste: data.periodicidade_reajuste || null,
      renovacao_automatica: data.renovacao_automatica,
      gerar_projeto: data.gerar_projeto,
      gerar_financeiro: data.gerar_financeiro,
      data_emissao: data.data_emissao ? new Date(data.data_emissao) : null,
      data_inicio: data.data_inicio ? new Date(data.data_inicio) : null,
      data_fim: data.data_fim ? new Date(data.data_fim) : null,
      cliente_nome: data.cliente_nome || cliente?.nome || null,
      cliente_cpf_cnpj: data.cliente_cpf_cnpj || cliente?.cpf_cnpj || null,
      cliente_contato_nome: data.cliente_contato_nome || cliente?.contato_principal || null,
      cliente_contato_email: data.cliente_contato_email || cliente?.email || null,
      cliente_contato_tel: data.cliente_contato_tel || cliente?.telefone || null,
      parcelas_json: data.parcelas_json && data.parcelas_json.length > 0 ? data.parcelas_json : undefined,
    },
  });

  await registrar({ recurso: "contratos", acao: "criar", registroId: contrato.id, detalhes: { titulo: data.titulo } });
  revalidatePath("/contratos");
  return { data: { ...contrato, valor_total: Number(contrato.valor_total) } };
}

export async function editarContrato(id: string, input: ContratoInput) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.contrato.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Contrato não encontrado");

  const data = schemaContrato.parse(input);

  const contrato = await prisma.contrato.update({
    where: { id },
    data: {
      cliente_id: data.cliente_id,
      proposta_id: data.proposta_id || null,
      responsavel_id: data.responsavel_id || null,
      numero_contrato: data.numero_contrato || null,
      tipo_contrato: data.tipo_contrato || null,
      titulo: data.titulo,
      objeto: data.objeto || null,
      conteudo: data.conteudo || null,
      valor_total: data.valor_total ?? 0,
      forma_pagamento: data.forma_pagamento || null,
      periodicidade: data.periodicidade || null,
      numero_parcelas: data.numero_parcelas ?? null,
      primeiro_vencimento: data.primeiro_vencimento ? new Date(data.primeiro_vencimento) : null,
      dia_vencimento: data.dia_vencimento ?? null,
      indice_reajuste: data.indice_reajuste || null,
      periodicidade_reajuste: data.periodicidade_reajuste || null,
      renovacao_automatica: data.renovacao_automatica,
      gerar_projeto: data.gerar_projeto,
      gerar_financeiro: data.gerar_financeiro,
      data_emissao: data.data_emissao ? new Date(data.data_emissao) : null,
      data_inicio: data.data_inicio ? new Date(data.data_inicio) : null,
      data_fim: data.data_fim ? new Date(data.data_fim) : null,
      cliente_nome: data.cliente_nome || null,
      cliente_cpf_cnpj: data.cliente_cpf_cnpj || null,
      cliente_contato_nome: data.cliente_contato_nome || null,
      cliente_contato_email: data.cliente_contato_email || null,
      cliente_contato_tel: data.cliente_contato_tel || null,
      parcelas_json: data.parcelas_json && data.parcelas_json.length > 0 ? data.parcelas_json : undefined,
    },
  });

  await registrar({ recurso: "contratos", acao: "editar", registroId: id });
  revalidatePath("/contratos");
  return { data: { ...contrato, valor_total: Number(contrato.valor_total) } };
}

export async function salvarAnexoContrato(id: string, anexo_url: string | null) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.contrato.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Contrato não encontrado");

  await prisma.contrato.update({ where: { id }, data: { anexo_url } });
  revalidatePath("/contratos");
  return { ok: true };
}

export async function excluirContrato(id: string) {
  await verificarPermissao("contratos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.contrato.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Contrato não encontrado");

  await prisma.contrato.delete({ where: { id } });

  await registrar({ recurso: "contratos", acao: "excluir", registroId: id });
  revalidatePath("/contratos");
  return { data: null };
}

export async function marcarAssinado(id: string, dataAssinatura?: string) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.contrato.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) return { ok: false as const, error: "Contrato não encontrado" };
  if (existente.status === "CANCELADO") return { ok: false as const, error: "Contrato cancelado não pode ser marcado como assinado" };

  await prisma.contrato.update({
    where: { id },
    data: {
      status: "ASSINADO",
      assinado_em: dataAssinatura ? new Date(dataAssinatura) : new Date(),
    },
  });

  await registrar({ recurso: "contratos", acao: "marcar_assinado", registroId: id });
  revalidatePath("/contratos");
  return { ok: true as const };
}
