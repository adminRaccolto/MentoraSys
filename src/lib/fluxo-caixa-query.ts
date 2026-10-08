import { prisma } from "@/lib/prisma";
import { saldoRecebivel, saldoContaPagar } from "@/lib/recebiveis";

export interface Lancamento {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
  referencia: string; valor: number; data: string; projetado: boolean;
}

// Busca os lançamentos (pagos e pendentes) de Recebível/ContaPagar no período,
// mais o saldo acumulado até o início do período. Usado pela tela de Fluxo de
// Caixa e pelo relatório impresso — mantido num só lugar para os dois não
// divergirem (ex: tratamento de parcelas pagas parcialmente).
export async function buscarFluxoCaixa(empresaId: string, inicio: Date, fim: Date) {
  const [
    recebiveisPagos, recebiveisPendentes,
    contasPagarPagas, contasPagarPendentes,
    somaSaldosIniciais, recebAnterior, pagarAnterior,
  ] = await Promise.all([
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, cliente: { select: { nome: true } }, plano_contas: { select: { nome: true } } },
      orderBy: { data_pagamento: "asc" },
    }),
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO", "PARCIAL"] }, data_vencimento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor: true, valor_pago: true, data_vencimento: true, cliente: { select: { nome: true } }, plano_contas: { select: { nome: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, fornecedor: true, plano_contas: { select: { nome: true } } },
      orderBy: { data_pagamento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO", "PARCIAL"] }, data_vencimento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor: true, valor_pago: true, data_vencimento: true, fornecedor: true, plano_contas: { select: { nome: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaBancaria.aggregate({ where: { empresa_id: empresaId, ativo: true }, _sum: { saldo_inicial: true } }),
    prisma.recebivel.aggregate({ where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { lt: inicio } }, _sum: { valor_pago: true } }),
    prisma.contaPagar.aggregate({ where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { lt: inicio } }, _sum: { valor_pago: true } }),
  ]);

  const saldoAnterior =
    Number(somaSaldosIniciais._sum.saldo_inicial ?? 0) +
    Number(recebAnterior._sum.valor_pago ?? 0) -
    Number(pagarAnterior._sum.valor_pago ?? 0);

  const lancamentos: Lancamento[] = [
    ...recebiveisPagos.map((r) => ({
      id: r.id, tipo: "ENTRADA" as const,
      descricao: r.plano_contas?.nome ?? r.descricao,
      referencia: r.cliente?.nome ?? "—",
      valor: Number(r.valor_pago ?? 0),
      data: r.data_pagamento!.toISOString().split("T")[0],
      projetado: false,
    })),
    ...recebiveisPendentes.map((r) => ({
      id: `p-${r.id}`, tipo: "ENTRADA" as const,
      descricao: r.plano_contas?.nome ?? r.descricao,
      referencia: r.cliente?.nome ?? "—",
      valor: saldoRecebivel(r),
      data: r.data_vencimento.toISOString().split("T")[0],
      projetado: true,
    })),
    ...contasPagarPagas.map((c) => ({
      id: c.id, tipo: "SAIDA" as const,
      descricao: c.plano_contas?.nome ?? c.descricao,
      referencia: c.fornecedor ?? "—",
      valor: Number(c.valor_pago ?? 0),
      data: c.data_pagamento!.toISOString().split("T")[0],
      projetado: false,
    })),
    ...contasPagarPendentes.map((c) => ({
      id: `p-${c.id}`, tipo: "SAIDA" as const,
      descricao: c.plano_contas?.nome ?? c.descricao,
      referencia: c.fornecedor ?? "—",
      valor: saldoContaPagar(c),
      data: c.data_vencimento.toISOString().split("T")[0],
      projetado: true,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  return { lancamentos, saldoAnterior };
}
