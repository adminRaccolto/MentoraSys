import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import TesourariaClient from "./tesouraria-client";

interface Props {
  searchParams: Promise<{ conta_id?: string }>;
}

export default async function TesourariaPage({ searchParams }: Props) {
  const { conta_id } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const [contas, transferencias] = await Promise.all([
    prisma.contaBancaria.findMany({
      where: { empresa_id: empresaId, ativo: true },
      include: {
        recebiveis:   { where: { status: "PAGO" }, select: { valor_pago: true } },
        contas_pagar: { where: { status: "PAGO" }, select: { valor_pago: true } },
        transferencias_origem:  { select: { valor: true } },
        transferencias_destino: { select: { valor: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.transferenciaTesouraria.findMany({
      where: { empresa_id: empresaId },
      include: {
        conta_origem:  { select: { id: true, nome: true } },
        conta_destino: { select: { id: true, nome: true } },
      },
      orderBy: { data: "desc" },
      take: 100,
    }),
  ]);

  const contasComSaldo = contas.map((c) => {
    const entradas   = c.recebiveis.reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
    const saidas     = c.contas_pagar.reduce((s, p) => s + Number(p.valor_pago ?? 0), 0);
    const transOut   = c.transferencias_origem.reduce((s, t) => s + Number(t.valor), 0);
    const transIn    = c.transferencias_destino.reduce((s, t) => s + Number(t.valor), 0);
    return {
      id:           c.id,
      nome:         c.nome,
      tipo:         c.tipo,
      saldo_inicial: Number(c.saldo_inicial),
      saldo_atual:  Number(c.saldo_inicial) + entradas - saidas - transOut + transIn,
    };
  });

  // Extrato da conta selecionada
  let extrato: ExtratoItem[] = [];
  if (conta_id) {
    const [recebidos, pagos, transOrig, transDest] = await Promise.all([
      prisma.recebivel.findMany({
        where: { empresa_id: empresaId, conta_bancaria_id: conta_id, status: "PAGO" },
        select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, cliente: { select: { nome: true } } },
        orderBy: { data_pagamento: "asc" },
      }),
      prisma.contaPagar.findMany({
        where: { empresa_id: empresaId, conta_bancaria_id: conta_id, status: "PAGO" },
        select: { id: true, descricao: true, valor_pago: true, data_pagamento: true, fornecedor: true },
        orderBy: { data_pagamento: "asc" },
      }),
      prisma.transferenciaTesouraria.findMany({
        where: { empresa_id: empresaId, conta_origem_id: conta_id },
        select: { id: true, descricao: true, valor: true, data: true, conta_destino: { select: { nome: true } } },
        orderBy: { data: "asc" },
      }),
      prisma.transferenciaTesouraria.findMany({
        where: { empresa_id: empresaId, conta_destino_id: conta_id },
        select: { id: true, descricao: true, valor: true, data: true, conta_origem: { select: { nome: true } } },
        orderBy: { data: "asc" },
      }),
    ]);

    extrato = [
      ...recebidos.map(r => ({
        id: r.id, tipo: "CREDITO" as const,
        descricao: r.descricao, referencia: r.cliente?.nome ?? "—",
        valor: Number(r.valor_pago ?? 0),
        data: r.data_pagamento!.toISOString().split("T")[0],
        origem: "recebivel" as const,
      })),
      ...pagos.map(p => ({
        id: p.id, tipo: "DEBITO" as const,
        descricao: p.descricao, referencia: p.fornecedor ?? "—",
        valor: Number(p.valor_pago ?? 0),
        data: p.data_pagamento!.toISOString().split("T")[0],
        origem: "conta_pagar" as const,
      })),
      ...transOrig.map(t => ({
        id: `to-${t.id}`, tipo: "DEBITO" as const,
        descricao: t.descricao ?? "Transferência", referencia: `→ ${t.conta_destino.nome}`,
        valor: Number(t.valor),
        data: t.data.toISOString().split("T")[0],
        origem: "transferencia" as const,
      })),
      ...transDest.map(t => ({
        id: `td-${t.id}`, tipo: "CREDITO" as const,
        descricao: t.descricao ?? "Transferência", referencia: `← ${t.conta_origem.nome}`,
        valor: Number(t.valor),
        data: t.data.toISOString().split("T")[0],
        origem: "transferencia" as const,
      })),
    ].sort((a, b) => a.data.localeCompare(b.data));
  }

  const saldoInicialConta = conta_id
    ? (contasComSaldo.find(c => c.id === conta_id)?.saldo_inicial ?? 0)
    : 0;

  return (
    <TesourariaClient
      contas={contasComSaldo}
      transferencias={transferencias.map(t => ({
        id: t.id,
        conta_origem_id:   t.conta_origem_id,
        conta_origem_nome: t.conta_origem.nome,
        conta_destino_id:  t.conta_destino_id,
        conta_destino_nome: t.conta_destino.nome,
        valor:     Number(t.valor),
        data:      t.data.toISOString().split("T")[0],
        descricao: t.descricao,
      }))}
      extrato={extrato}
      contaIdSelecionada={conta_id ?? null}
      saldoInicialConta={saldoInicialConta}
    />
  );
}

export type ExtratoItem = {
  id: string; tipo: "CREDITO" | "DEBITO";
  descricao: string; referencia: string;
  valor: number; data: string;
  origem: "recebivel" | "conta_pagar" | "transferencia";
};
