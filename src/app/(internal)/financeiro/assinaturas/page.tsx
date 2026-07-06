import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import AssinaturasClient from "./assinaturas-client";

interface Props {
  searchParams: Promise<{ canal?: string; status?: string }>;
}

export default async function AssinaturasPage({ searchParams }: Props) {
  const { canal, status } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const [assinaturas, clientes, servicos] = await Promise.all([
    prisma.assinatura.findMany({
      where: {
        empresa_id: empresaId,
        ...(canal && canal !== "TODOS" ? { canal } : {}),
        ...(status && status !== "TODOS" ? { status } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        servico: { select: { id: true, nome: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.servico.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, canal: true, plano: true, valor_base: true, tipo_cobranca: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  // KPIs
  const ativas = assinaturas.filter((a) => a.status === "ATIVA");
  const mrr = ativas.reduce((sum, a) => sum + Number(a.valor), 0);
  const inadimplentes = assinaturas.filter((a) => a.status === "INADIMPLENTE").length;

  const mrrPorCanal = {
    ARATO: ativas.filter((a) => a.canal === "ARATO").reduce((s, a) => s + Number(a.valor), 0),
    CONSELHO_AGRO: ativas.filter((a) => a.canal === "CONSELHO_AGRO").reduce((s, a) => s + Number(a.valor), 0),
    CONSULTORIA: ativas.filter((a) => a.canal === "CONSULTORIA").reduce((s, a) => s + Number(a.valor), 0),
  };

  return (
    <AssinaturasClient
      assinaturas={assinaturas.map((a) => ({
        ...a,
        valor: Number(a.valor),
        proximo_vencimento: a.proximo_vencimento?.toISOString() ?? null,
        data_inicio: a.data_inicio.toISOString(),
        data_cancelamento: a.data_cancelamento?.toISOString() ?? null,
        criado_em: a.criado_em.toISOString(),
      }))}
      clientes={clientes}
      servicos={servicos.map((s) => ({ ...s, valor_base: s.valor_base ? Number(s.valor_base) : null }))}
      kpis={{ mrr, ativas: ativas.length, inadimplentes, mrrPorCanal }}
      canalFiltro={canal ?? "TODOS"}
      statusFiltro={status ?? "TODOS"}
    />
  );
}
