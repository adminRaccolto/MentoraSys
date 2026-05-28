import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import FluxoCaixaClient from "./fluxo-caixa-client";

interface Props {
  searchParams: Promise<{ mes?: string }>;
}

export default async function FluxoCaixaPage({ searchParams }: Props) {
  const { mes } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const anoMes = mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [ano, mesNum] = anoMes.split("-").map(Number);
  const inicio = new Date(ano, mesNum - 1, 1);
  const fim = new Date(ano, mesNum, 0, 23, 59, 59);

  const [recebiveis, contasPagar] = await Promise.all([
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        status: "PAGO",
        data_pagamento: { gte: inicio, lte: fim },
      },
      select: {
        id: true, descricao: true, valor_pago: true, data_pagamento: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { data_pagamento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: {
        empresa_id: empresaId,
        status: "PAGO",
        data_pagamento: { gte: inicio, lte: fim },
      },
      select: {
        id: true, descricao: true, valor_pago: true, data_pagamento: true, fornecedor: true,
      },
      orderBy: { data_pagamento: "asc" },
    }),
  ]);

  type Lancamento = {
    id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
    referencia: string; valor: number; data: Date;
  };

  const lancamentos: Lancamento[] = [
    ...recebiveis.map((r) => ({
      id: r.id, tipo: "ENTRADA" as const,
      descricao: r.descricao,
      referencia: r.cliente?.nome ?? "—",
      valor: Number(r.valor_pago ?? 0),
      data: r.data_pagamento!,
    })),
    ...contasPagar.map((c) => ({
      id: c.id, tipo: "SAIDA" as const,
      descricao: c.descricao,
      referencia: c.fornecedor ?? "—",
      valor: Number(c.valor_pago ?? 0),
      data: c.data_pagamento!,
    })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  return <FluxoCaixaClient lancamentos={lancamentos} anoMes={anoMes} />;
}
