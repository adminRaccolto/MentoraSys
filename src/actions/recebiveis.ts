"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";
import { obterOuCriarContaJurosMultas } from "@/lib/plano-contas-financeiras";

const schemaCreate = z.object({
  descricao:       z.string().min(1, "Descrição obrigatória"),
  valor:           z.coerce.number().positive("Valor deve ser positivo"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  cliente_id:      z.string().optional(),
  contrato_id:     z.string().optional(),
  plano_contas_id: z.string().optional(),
  conta_bancaria_id: z.string().optional(),
  centro_custo_id: z.string().optional(),
  observacoes:     z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.coerce.number().positive("Valor deve ser positivo"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
  juros_valor: z.coerce.number().min(0).optional(),
  multa_valor: z.coerce.number().min(0).optional(),
  desconto_valor: z.coerce.number().min(0).optional(),
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
      data_vencimento: new Date(`${data.data_vencimento}T12:00:00`),
      cliente_id: data.cliente_id || null,
      contrato_id: data.contrato_id || null,
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      centro_custo_id: data.centro_custo_id || null,
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
      const d = parseLocalDate(data.data_primeira);
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
      data_pagamento: parseLocalDate(data.data_pagamento),
      valor_pago: data.valor_pago,
      forma_pagamento: data.forma_pagamento,
      conta_bancaria_id: data.conta_bancaria_id || null,
      juros_valor: data.juros_valor && data.juros_valor > 0 ? data.juros_valor : null,
      multa_valor: data.multa_valor && data.multa_valor > 0 ? data.multa_valor : null,
      desconto_valor: data.desconto_valor && data.desconto_valor > 0 ? data.desconto_valor : null,
    },
  });

  // Apropria juros/multa automaticamente no plano de contas
  const totalJurosMulta = (data.juros_valor ?? 0) + (data.multa_valor ?? 0);
  if (totalJurosMulta > 0) {
    const jurosMultasId = await obterOuCriarContaJurosMultas(empresaId);
    await prisma.recebivel.create({
      data: {
        empresa_id: empresaId,
        cliente_id: recebivel.cliente_id,
        contrato_id: recebivel.contrato_id,
        plano_contas_id: jurosMultasId,
        descricao: `Juros e multas — ${recebivel.descricao}`,
        valor: totalJurosMulta,
        data_vencimento: parseLocalDate(data.data_pagamento),
        status: "PAGO",
        data_pagamento: parseLocalDate(data.data_pagamento),
        valor_pago: totalJurosMulta,
        forma_pagamento: data.forma_pagamento,
        conta_bancaria_id: data.conta_bancaria_id || null,
        recebivel_origem_id: recebivel.id,
      },
    });
  }

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
        data_pagamento: parseLocalDate(data.data_pagamento),
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
      data_vencimento: new Date(`${data.data_vencimento}T12:00:00`),
      cliente_id: data.cliente_id || null,
      contrato_id: data.contrato_id || null,
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      centro_custo_id: data.centro_custo_id || null,
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

const schemaRefaturar = z.object({
  juros_valor: z.coerce.number().min(0).default(0),
  multa_valor: z.coerce.number().min(0).default(0),
  desconto_valor: z.coerce.number().min(0).default(0),
  nova_data_vencimento: z.string().min(1, "Nova data obrigatória"),
  observacoes: z.string().optional(),
});

export async function refaturarRecebivel(id: string, input: z.input<typeof schemaRefaturar>) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaRefaturar.parse(input);

  const original = await prisma.recebivel.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!original) throw new Error("Recebível não encontrado");
  if (!["VENCIDO", "PENDENTE", "PARCIAL"].includes(original.status)) {
    throw new Error("Apenas recebíveis pendentes, parciais ou vencidos podem ser refaturados");
  }

  const novoValor = Number(original.valor)
    + (data.juros_valor ?? 0)
    + (data.multa_valor ?? 0)
    - (data.desconto_valor ?? 0);

  if (novoValor <= 0) throw new Error("O valor resultante deve ser positivo");

  // Marca o original como RENEGOCIADO
  await prisma.recebivel.update({
    where: { id },
    data: { status: "RENEGOCIADO" },
  });

  // Cria o novo recebível com os valores atualizados
  const novo = await prisma.recebivel.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id ?? null,
      cliente_id: original.cliente_id,
      contrato_id: original.contrato_id,
      plano_contas_id: original.plano_contas_id,
      conta_bancaria_id: original.conta_bancaria_id,
      descricao: original.descricao,
      valor: novoValor,
      juros_valor: data.juros_valor > 0 ? data.juros_valor : null,
      multa_valor: data.multa_valor > 0 ? data.multa_valor : null,
      desconto_valor: data.desconto_valor > 0 ? data.desconto_valor : null,
      data_vencimento: new Date(`${data.nova_data_vencimento}T12:00:00`),
      numero_parcela: original.numero_parcela,
      total_parcelas: original.total_parcelas,
      observacoes: data.observacoes || `Renegociação de lançamento de ${new Date(original.data_vencimento).toLocaleDateString("pt-BR")}`,
      recebivel_origem_id: id,
    },
  });

  // Se havia juros/multa, registra automaticamente no plano de contas
  const totalJurosMulta = (data.juros_valor ?? 0) + (data.multa_valor ?? 0);
  if (totalJurosMulta > 0) {
    const jurosMultasId = await obterOuCriarContaJurosMultas(empresaId);
    await prisma.recebivel.create({
      data: {
        empresa_id: empresaId,
        cliente_id: original.cliente_id,
        contrato_id: original.contrato_id,
        plano_contas_id: jurosMultasId,
        descricao: `Juros e multas — ${original.descricao}`,
        valor: totalJurosMulta,
        data_vencimento: new Date(`${data.nova_data_vencimento}T12:00:00`),
        recebivel_origem_id: id,
        observacoes: "Apropriação automática de juros e multas por renegociação",
      },
    });
  }

  await registrar({ recurso: "recebiveis", acao: "refaturar", registroId: id, detalhes: { novoId: novo.id, juros: data.juros_valor, multa: data.multa_valor } });
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/faturamento");
  return { ok: true, novoRecebivelId: novo.id };
}

// ─── Parcelamento / Recorrência manual ───────────────────────────────────────

const PERIODICIDADES = ["SEMANAL", "QUINZENAL", "MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;

const schemaParceladoManual = z.object({
  descricao:         z.string().min(1, "Descrição obrigatória"),
  valor_total:       z.coerce.number().positive("Valor deve ser positivo"),
  n_parcelas:        z.coerce.number().int().min(2).max(120),
  periodicidade:     z.enum(PERIODICIDADES),
  data_primeira:     z.string().min(1, "Data obrigatória"),
  tipo:              z.enum(["PARCELADO", "RECORRENTE"]),
  cliente_id:        z.string().optional(),
  plano_contas_id:   z.string().optional(),
  conta_bancaria_id: z.string().optional(),
  centro_custo_id:   z.string().optional(),
  observacoes:       z.string().optional(),
});

function addPeriodo(base: Date, periodicidade: string, i: number): Date {
  const d = new Date(base);
  switch (periodicidade) {
    case "SEMANAL":    d.setDate(d.getDate() + 7 * i); break;
    case "QUINZENAL":  d.setDate(d.getDate() + 15 * i); break;
    case "MENSAL":     d.setMonth(d.getMonth() + i); break;
    case "BIMESTRAL":  d.setMonth(d.getMonth() + 2 * i); break;
    case "TRIMESTRAL": d.setMonth(d.getMonth() + 3 * i); break;
    case "SEMESTRAL":  d.setMonth(d.getMonth() + 6 * i); break;
    case "ANUAL":      d.setFullYear(d.getFullYear() + i); break;
  }
  return d;
}

export async function criarRecebivelParcelado(input: z.input<typeof schemaParceladoManual>) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const d = schemaParceladoManual.parse(input);

  const base = new Date(`${d.data_primeira}T12:00:00`);
  const valorBase = Math.floor((d.valor_total / d.n_parcelas) * 100) / 100;
  const valorUltima = Math.round((d.valor_total - valorBase * (d.n_parcelas - 1)) * 100) / 100;

  const registros = Array.from({ length: d.n_parcelas }, (_, i) => ({
    empresa_id:        empresaId,
    criado_por:        user?.id ?? null,
    descricao:         d.tipo === "PARCELADO"
                         ? `${d.descricao} — Parcela ${i + 1}/${d.n_parcelas}`
                         : d.descricao,
    valor:             i === d.n_parcelas - 1 ? valorUltima : valorBase,
    data_vencimento:   addPeriodo(base, d.periodicidade, i),
    cliente_id:        d.cliente_id || null,
    plano_contas_id:   d.plano_contas_id || null,
    conta_bancaria_id: d.conta_bancaria_id || null,
    centro_custo_id:   d.centro_custo_id || null,
    observacoes:       d.observacoes || null,
    numero_parcela:    d.tipo === "PARCELADO" ? i + 1 : null,
    total_parcelas:    d.tipo === "PARCELADO" ? d.n_parcelas : null,
  }));

  await prisma.recebivel.createMany({ data: registros });
  await registrar({ recurso: "recebiveis", acao: "criar", registroId: empresaId, detalhes: { parcelado: true, n: d.n_parcelas } });
  revalidatePath("/financeiro/recebiveis");
  return { count: d.n_parcelas };
}
