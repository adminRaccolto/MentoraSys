import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import RelatoriosClient from "./relatorios-client";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const { ano: anoParam } = await searchParams;
  const ano = anoParam ? parseInt(anoParam) : new Date().getFullYear();
  const empresaId = await obterEmpresaAtiva();

  const inicio = new Date(ano, 0, 1);
  const fim = new Date(ano, 11, 31, 23, 59, 59);

  const [recebiveis, contasPagar, leads, propostas, projetos] = await Promise.all([
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, data_vencimento: { gte: inicio, lte: fim } },
      select: {
        id: true,
        descricao: true,
        valor: true,
        valor_pago: true,
        status: true,
        data_vencimento: true,
        data_pagamento: true,
        cliente: { select: { id: true, nome: true } },
      },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, data_vencimento: { gte: inicio, lte: fim } },
      select: {
        id: true,
        descricao: true,
        fornecedor: true,
        valor: true,
        valor_pago: true,
        status: true,
        data_vencimento: true,
        data_pagamento: true,
      },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.lead.findMany({
      where: { empresa_id: empresaId, criado_em: { gte: inicio, lte: fim } },
      select: {
        id: true,
        nome: true,
        etapa_chave: true,
        valor_estimado: true,
        criado_em: true,
      },
    }),
    prisma.proposta.findMany({
      where: { empresa_id: empresaId, criado_em: { gte: inicio, lte: fim } },
      select: {
        id: true,
        titulo: true,
        status: true,
        valor_total: true,
        criado_em: true,
        cliente: { select: { nome: true } },
      },
    }),
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      select: {
        id: true,
        titulo: true,
        status: true,
        data_inicio: true,
        data_fim: true,
        tarefas: { select: { status: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
  ]);

  return (
    <RelatoriosClient
      ano={ano}
      recebiveis={recebiveis.map((r) => ({
        ...r,
        valor: Number(r.valor),
        valor_pago: r.valor_pago ? Number(r.valor_pago) : null,
        data_vencimento: r.data_vencimento.toISOString(),
        data_pagamento: r.data_pagamento?.toISOString() ?? null,
      }))}
      contasPagar={contasPagar.map((c) => ({
        ...c,
        valor: Number(c.valor),
        valor_pago: c.valor_pago ? Number(c.valor_pago) : null,
        data_vencimento: c.data_vencimento.toISOString(),
        data_pagamento: c.data_pagamento?.toISOString() ?? null,
      }))}
      leads={leads.map((l) => ({
        ...l,
        valor_estimado: l.valor_estimado ? Number(l.valor_estimado) : null,
        criado_em: l.criado_em.toISOString(),
      }))}
      propostas={propostas.map((p) => ({
        ...p,
        valor_total: Number(p.valor_total),
        criado_em: p.criado_em.toISOString(),
      }))}
      projetos={projetos.map((p) => ({
        ...p,
        data_inicio: p.data_inicio?.toISOString() ?? null,
        data_fim: p.data_fim?.toISOString() ?? null,
      }))}
    />
  );
}
