import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ContasPagarClient from "./contas-pagar-client";

interface Props {
  searchParams: Promise<{ status?: string; de?: string; ate?: string }>;
}

export default async function ContasPagarPage({ searchParams }: Props) {
  const { status, de, ate } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const deStr = de ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ateStr = ate ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
  const inicio = new Date(`${deStr}T00:00:00`);
  const fim = new Date(`${ateStr}T23:59:59`);

  const [contas, categorias, contasBancarias, centrosCusto] = await Promise.all([
    prisma.contaPagar.findMany({
      where: {
        empresa_id: empresaId,
        data_vencimento: { gte: inicio, lte: fim },
        ...(status && status !== "TODOS" ? { status: status as never } : {}),
      },
      include: {
        plano_contas: { select: { id: true, nome: true } },
      },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.planoDeContas.findMany({
      where: { empresa_id: empresaId, tipo: "DESPESA", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contaBancaria.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.centroCusto.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, codigo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <ContasPagarClient
      key={`${deStr}_${ateStr}_${status ?? "TODOS"}`}
      contas={contas.map((c) => ({
        ...c,
        valor: Number(c.valor),
        valor_pago: c.valor_pago != null ? Number(c.valor_pago) : null,
      }))}
      categorias={categorias}
      contasBancarias={contasBancarias}
      centrosCusto={centrosCusto}
      de={deStr}
      ate={ateStr}
      statusFiltro={status ?? "TODOS"}
    />
  );
}
