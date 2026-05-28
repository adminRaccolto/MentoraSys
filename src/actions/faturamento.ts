"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";

const schemaCreate = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  contrato_id: z.string().optional(),
  numero: z.string().optional(),
  competencia: z.string().min(1, "Competência obrigatória"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  descricao: z.string().min(1, "Descrição obrigatória"),
  data_emissao: z.string().optional(),
  data_vencimento: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaEmitir = z.object({
  numero: z.string().optional(),
  data_emissao: z.string().min(1, "Data de emissão obrigatória"),
  data_vencimento: z.string().optional(),
});

type InputCreate = z.input<typeof schemaCreate>;
type InputEmitir = z.input<typeof schemaEmitir>;

export async function criarNota(input: InputCreate) {
  await verificarPermissao("faturamento", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaCreate.parse(input);

  const nota = await prisma.notaFiscal.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id,
      cliente_id: data.cliente_id,
      contrato_id: data.contrato_id || null,
      numero: data.numero || null,
      competencia: new Date(data.competencia),
      valor: data.valor,
      descricao: data.descricao,
      data_emissao: data.data_emissao ? new Date(data.data_emissao) : null,
      data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "faturamento", acao: "criar", registroId: nota.id });
  revalidatePath("/faturamento");
  return { ok: true, id: nota.id };
}

export async function editarNota(id: string, input: InputCreate) {
  await verificarPermissao("faturamento", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCreate.parse(input);

  await prisma.notaFiscal.updateMany({
    where: { id, empresa_id: empresaId },
    data: {
      cliente_id: data.cliente_id,
      contrato_id: data.contrato_id || null,
      numero: data.numero || null,
      competencia: new Date(data.competencia),
      valor: data.valor,
      descricao: data.descricao,
      data_emissao: data.data_emissao ? new Date(data.data_emissao) : null,
      data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "faturamento", acao: "editar", registroId: id });
  revalidatePath("/faturamento");
  return { ok: true };
}

export async function emitirNota(id: string, input: InputEmitir) {
  await verificarPermissao("faturamento", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaEmitir.parse(input);

  await prisma.notaFiscal.updateMany({
    where: { id, empresa_id: empresaId, status: "PENDENTE" },
    data: {
      status: "EMITIDA",
      numero: data.numero || null,
      data_emissao: new Date(data.data_emissao),
      data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : null,
    },
  });

  await registrar({ recurso: "faturamento", acao: "emitir", registroId: id });
  revalidatePath("/faturamento");
  return { ok: true };
}

export async function baixarNota(id: string) {
  await verificarPermissao("faturamento", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.notaFiscal.updateMany({
    where: { id, empresa_id: empresaId, status: "EMITIDA" },
    data: { status: "PAGA" },
  });

  await registrar({ recurso: "faturamento", acao: "baixar", registroId: id });
  revalidatePath("/faturamento");
  return { ok: true };
}

export async function cancelarNota(id: string) {
  await verificarPermissao("faturamento", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.notaFiscal.updateMany({
    where: { id, empresa_id: empresaId, status: { not: "PAGA" } },
    data: { status: "CANCELADA" },
  });

  await registrar({ recurso: "faturamento", acao: "cancelar", registroId: id });
  revalidatePath("/faturamento");
  return { ok: true };
}

export async function excluirNota(id: string) {
  await verificarPermissao("faturamento", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.notaFiscal.deleteMany({
    where: { id, empresa_id: empresaId, status: "PENDENTE" },
  });

  await registrar({ recurso: "faturamento", acao: "excluir", registroId: id });
  revalidatePath("/faturamento");
  return { ok: true };
}

export async function gerarRecebivel(id: string) {
  await verificarPermissao("faturamento", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const nota = await prisma.notaFiscal.findUnique({
    where: { id, empresa_id: empresaId },
  });
  if (!nota) throw new Error("Nota não encontrada");

  const recebivel = await prisma.recebivel.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id,
      cliente_id: nota.cliente_id,
      contrato_id: nota.contrato_id,
      descricao: `NF ${nota.numero ?? nota.id.slice(0, 6)} — ${nota.descricao}`,
      valor: nota.valor,
      data_vencimento: nota.data_vencimento ?? nota.data_emissao ?? new Date(),
    },
  });

  await registrar({ recurso: "faturamento", acao: "gerar_recebivel", registroId: id });
  revalidatePath("/faturamento");
  revalidatePath("/financeiro/recebiveis");
  return { ok: true, recebivelId: recebivel.id };
}
