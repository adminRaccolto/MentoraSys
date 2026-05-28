import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ContasPagarClient from "./contas-pagar-client";

interface Props {
  searchParams: Promise<{ status?: string; mes?: string }>;
}

export default async function ContasPagarPage({ searchParams }: Props) {
  const { status, mes } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const anoMes = mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [ano, mesNum] = anoMes.split("-").map(Number);
  const inicio = new Date(ano, mesNum - 1, 1);
  const fim = new Date(ano, mesNum, 0, 23, 59, 59);

  const [contas, categorias, contasBancarias] = await Promise.all([
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
  ]);

  return (
    <ContasPagarClient
      contas={contas.map((c) => ({
        ...c,
        valor: Number(c.valor),
        valor_pago: c.valor_pago != null ? Number(c.valor_pago) : null,
      }))}
      categorias={categorias}
      contasBancarias={contasBancarias}
      anoMes={anoMes}
      statusFiltro={status ?? "TODOS"}
    />
  );
}
