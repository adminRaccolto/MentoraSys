import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import RelatorioCCClient from "./relatorio-cc-client";

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

export default async function RelatorioCCPage({ searchParams }: Props) {
  const { de, ate } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const deStr = de ?? `${anoAtual}-01-01`;
  const ateStr = ate ?? `${anoAtual}-12-31`;
  const inicio = new Date(`${deStr}T00:00:00`);
  const fim = new Date(`${ateStr}T23:59:59`);

  const [centros, recebiveis, contasPagar] = await Promise.all([
    prisma.centroCusto.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, nome: true, codigo: true, ativo: true, projeto: { select: { titulo: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        data_vencimento: { gte: inicio, lte: fim },
        centro_custo_id: { not: null },
      },
      select: {
        centro_custo_id: true,
        valor: true,
        valor_pago: true,
        status: true,
      },
    }),
    prisma.contaPagar.findMany({
      where: {
        empresa_id: empresaId,
        data_vencimento: { gte: inicio, lte: fim },
        centro_custo_id: { not: null },
      },
      select: {
        centro_custo_id: true,
        valor: true,
        valor_pago: true,
        status: true,
      },
    }),
  ]);

  // Agrega por CC
  const mapa = new Map<string, { receita: number; despesa: number }>();

  for (const r of recebiveis) {
    if (!r.centro_custo_id) continue;
    const atual = mapa.get(r.centro_custo_id) ?? { receita: 0, despesa: 0 };
    atual.receita += Number(r.valor_pago ?? r.valor);
    mapa.set(r.centro_custo_id, atual);
  }

  for (const c of contasPagar) {
    if (!c.centro_custo_id) continue;
    const atual = mapa.get(c.centro_custo_id) ?? { receita: 0, despesa: 0 };
    atual.despesa += Number(c.valor_pago ?? c.valor);
    mapa.set(c.centro_custo_id, atual);
  }

  const linhas = centros.map((cc) => {
    const ag = mapa.get(cc.id) ?? { receita: 0, despesa: 0 };
    return {
      id: cc.id,
      nome: cc.nome,
      codigo: cc.codigo,
      ativo: cc.ativo,
      titulo_projeto: cc.projeto?.titulo ?? null,
      receita: ag.receita,
      despesa: ag.despesa,
      saldo: ag.receita - ag.despesa,
    };
  }).filter(l => l.receita !== 0 || l.despesa !== 0 || centros.length < 10);

  return (
    <RelatorioCCClient
      key={`${deStr}_${ateStr}`}
      linhas={linhas}
      de={deStr}
      ate={ateStr}
    />
  );
}
