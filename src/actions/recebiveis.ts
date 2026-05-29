"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";

const schemaCreate = z.object({
  descricao: z.string().min(1, "Descrição obrigatória"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  cliente_id: z.string().optional(),
  contrato_id: z.string().optional(),
  plano_contas_id: z.string().optional(),
  conta_bancaria_id: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.coerce.number().positive("Valor deve ser positivo"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});

const schemaParcelas = z.object({
  n_parcelas: z.coerce.number().int().min(1).max(120),
  data_primeira: z.string().min(1),
  valor_parcela: z.coerce.number().positive(),
  plano_contas_id: z.string().optional(),
  conta_bancaria_id: z.string().optional(),
});

type InputCreate = z.input<typeof schemaCreate>;
type InputBaixar = z.input<typeof schemaBaixar>;
type InputParcelas = z.input<typeof schemaParcelas>;

export async function criarRecebivel(input: InputCreate) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaCreate.parse(input);

  const recebivel = await prisma.recebivel.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id,
      descricao: data.descricao,
      valor: data.valor,
      data_vencimento: new Date(data.data_vencimento),
      cliente_id: data.cliente_id || null,
      contrato_id: data.contrato_id || null,
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "recebiveis", acao: "criar", registroId: recebivel.id });
  revalidatePath("/financeiro/recebiveis");
  return { data: { ...recebivel, valor: Number(recebivel.valor), valor_pago: recebivel.valor_pago != null ? Number(recebivel.valor_pago) : null } };
}

export async function gerarParcelasContrato(contratoId: string, input: InputParcelas) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaParcelas.parse(input);

  type ParcelaJson = { numero: number; vencimento: string; valor: number };

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId, empresa_id: empresaId },
    include: {
      cliente: { select: { id: true, nome: true } },
      proposta: { select: { parcelas_json: true } },
    },
  });
  if (!contrato) throw new Error("Contrato não encontrado");
  if (contrato.status !== "ASSINADO") throw new Error("Contrato não está assinado");

  const jaExiste = await prisma.recebivel.count({ where: { contrato_id: contratoId, empresa_id: empresaId } });
  if (jaExiste > 0) throw new Error("Este contrato já tem recebíveis gerados no financeiro");

  const propostaParcelas = Array.isArray(contrato.proposta?.parcelas_json)
    ? (contrato.proposta!.parcelas_json as ParcelaJson[])
    : null;

  const label = contrato.tipo_contrato || contrato.objeto || contrato.titulo;

  const parcelas = Array.from({ length: data.n_parcelas }, (_, i) => {
    const pp = propostaParcelas?.[i];
    const vencimento = pp ? new Date(pp.vencimento) : (() => {
      const d = new Date(data.data_primeira);
      d.setMonth(d.getMonth() + i);
      return d;
    })();
    const valor = pp ? pp.valor : data.valor_parcela;
    return {
      empresa_id: empresaId,
      criado_por: user?.id ?? null,
      contrato_id: contratoId,
      cliente_id: contrato.cliente_id,
      descricao: `${label} — Parcela ${i + 1}/${data.n_parcelas}`,
      valor,
      data_vencimento: vencimento,
      numero_parcela: i + 1,
      total_parcelas: data.n_parcelas,
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
    };
  });

  await prisma.recebivel.createMany({ data: parcelas });

  revalidatePath("/financeiro/recebiveis");
  return { data: { count: data.n_parcelas } };
}

export async function baixarRecebivel(id: string, input: InputBaixar) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaBaixar.parse(input);

  const recebivel = await prisma.recebivel.findFirst({ where: { id, empresa_id: empresaId } });
  if (!recebivel) throw new Error("Recebível não encontrado");
  if (recebivel.status === "PAGO") throw new Error("Recebível já foi baixado");
  if (recebivel.status === "CANCELADO") throw new Error("Recebível cancelado não pode ser baixado");

  const novoStatus = data.valor_pago < Number(recebivel.valor) ? "PARCIAL" : "PAGO";

  const updated = await prisma.recebivel.update({
    where: { id },
    data: {
      status: novoStatus,
      data_pagamento: new Date(data.data_pagamento),
      valor_pago: data.valor_pago,
      forma_pagamento: data.forma_pagamento,
      conta_bancaria_id: data.conta_bancaria_id || null,
    },
  });

  await registrar({ recurso: "recebiveis", acao: "baixar", registroId: id, detalhes: { status: novoStatus, valor_pago: data.valor_pago } });
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/financeiro");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: updated.valor_pago != null ? Number(updated.valor_pago) : null } };
}

export async function estornarRecebivel(id: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({ where: { id, empresa_id: empresaId } });
  if (!recebivel) throw new Error("Recebível não encontrado");
  if (recebivel.status !== "PAGO" && recebivel.status !== "PARCIAL") throw new Error("Apenas lançamentos pagos ou parciais podem ser estornados");

  const vencimento = recebivel.data_vencimento;
  const novoStatus = vencimento < new Date() ? "VENCIDO" : "PENDENTE";

  const updated = await prisma.recebivel.update({
    where: { id },
    data: { status: novoStatus, data_pagamento: null, valor_pago: null, forma_pagamento: null },
  });

  await registrar({ recurso: "recebiveis", acao: "estornar", registroId: id });
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/financeiro");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: null } };
}

const schemaBaixarLote = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});
type InputBaixarLote = z.input<typeof schemaBaixarLote>;

export async function baixarLoteRecebiveis(ids: string[], input: InputBaixarLote) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaBaixarLote.parse(input);

  const recebiveis = await prisma.recebivel.findMany({ where: { id: { in: ids }, empresa_id: empresaId } });
  const elegíveis = recebiveis.filter(r => r.status !== "PAGO" && r.status !== "CANCELADO");
  if (elegíveis.length === 0) throw new Error("Nenhum lançamento elegível para baixa");

  await Promise.all(elegíveis.map(r =>
    prisma.recebivel.update({
      where: { id: r.id },
      data: {
        status: "PAGO",
        data_pagamento: new Date(data.data_pagamento),
        valor_pago: r.valor,
        forma_pagamento: data.forma_pagamento,
        conta_bancaria_id: data.conta_bancaria_id || null,
      },
    })
  ));

  await registrar({ recurso: "recebiveis", acao: "baixar_lote", detalhes: { ids: elegíveis.map(r => r.id), qtd: elegíveis.length } });
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/financeiro");
  return { data: { qtd: elegíveis.length } };
}

export async function editarRecebivel(id: string, input: InputCreate) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCreate.parse(input);

  const recebivel = await prisma.recebivel.findFirst({ where: { id, empresa_id: empresaId } });
  if (!recebivel) throw new Error("Recebível não encontrado");
  if (recebivel.status === "PAGO") throw new Error("Recebível pago não pode ser editado");

  const updated = await prisma.recebivel.update({
    where: { id },
    data: {
      descricao: data.descricao,
      valor: data.valor,
      data_vencimento: new Date(data.data_vencimento),
      cliente_id: data.cliente_id || null,
      contrato_id: data.contrato_id || null,
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      observacoes: data.observacoes || null,
    },
  });

  revalidatePath("/financeiro/recebiveis");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: updated.valor_pago != null ? Number(updated.valor_pago) : null } };
}

export async function excluirRecebivel(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({ where: { id, empresa_id: empresaId } });
  if (!recebivel) throw new Error("Recebível não encontrado");
  if (recebivel.status === "PAGO") throw new Error("Recebível pago não pode ser excluído");

  await prisma.recebivel.delete({ where: { id } });
  await registrar({ recurso: "recebiveis", acao: "excluir", registroId: id });
  revalidatePath("/financeiro/recebiveis");
  return { data: null };
}
