import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import FluxoCaixaClient from "./fluxo-caixa-client";

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

export default async function FluxoCaixaPage({ searchParams }: Props) {
  const { de, ate } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const deStr = de ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ateStr = ate ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
  const inicio = new Date(`${deStr}T00:00:00`);
  const fim = new Date(`${ateStr}T23:59:59`);

  const [recebiveisPagos, recebiveisPendentes, contasPagarPagas, contasPagarPendentes] = await Promise.all([
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, cliente: { select: { nome: true } }, plano_contas: { select: { nome: true } } },
      orderBy: { data_pagamento: "asc" },
    }),
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO"] }, data_vencimento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor: true, data_vencimento: true, cliente: { select: { nome: true } }, plano_contas: { select: { nome: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, fornecedor: true, plano_contas: { select: { nome: true } } },
      orderBy: { data_pagamento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO"] }, data_vencimento: { gte: inicio, lte: fim } },
      select: { id: true, descricao: true, valor: true, data_vencimento: true, fornecedor: true, plano_contas: { select: { nome: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
  ]);

  type Lancamento = {
    id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
    referencia: string; valor: number; data: Date; projetado: boolean;
  };

  const lancamentos: Lancamento[] = [
    ...recebiveisPagos.map((r) => ({
      id: r.id, tipo: "ENTRADA" as const, descricao: r.plano_contas?.nome ?? r.descricao,
      referencia: r.cliente?.nome ?? "—", valor: Number(r.valor_pago ?? 0),
      data: r.data_pagamento!, projetado: false,
    })),
    ...recebiveisPendentes.map((r) => ({
      id: `p-${r.id}`, tipo: "ENTRADA" as const, descricao: r.plano_contas?.nome ?? r.descricao,
      referencia: r.cliente?.nome ?? "—", valor: Number(r.valor),
      data: r.data_vencimento, projetado: true,
    })),
    ...contasPagarPagas.map((c) => ({
      id: c.id, tipo: "SAIDA" as const, descricao: c.plano_contas?.nome ?? c.descricao,
      referencia: c.fornecedor ?? "—", valor: Number(c.valor_pago ?? 0),
      data: c.data_pagamento!, projetado: false,
    })),
    ...contasPagarPendentes.map((c) => ({
      id: `p-${c.id}`, tipo: "SAIDA" as const, descricao: c.plano_contas?.nome ?? c.descricao,
      referencia: c.fornecedor ?? "—", valor: Number(c.valor),
      data: c.data_vencimento, projetado: true,
    })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  return <FluxoCaixaClient key={`${deStr}_${ateStr}`} lancamentos={lancamentos} de={deStr} ate={ateStr} />;
}
