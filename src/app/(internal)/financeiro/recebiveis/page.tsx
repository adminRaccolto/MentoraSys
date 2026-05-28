import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import RecebiveisClient from "./recebiveis-client";

interface Props {
  searchParams: Promise<{ status?: string; mes?: string }>;
}

export default async function RecebiveisPage({ searchParams }: Props) {
  const { status, mes } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const anoMes = mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [ano, mesNum] = anoMes.split("-").map(Number);
  const inicio = new Date(ano, mesNum - 1, 1);
  const fim = new Date(ano, mesNum, 0, 23, 59, 59);

  // PENDENTE e VENCIDO mostram todos os meses (o usuário quer ver tudo em aberto)
  const filtrarPorMes = !status || status === "TODOS" || status === "PAGO" || status === "CANCELADO";

  const [recebiveis, clientes, contratos, categorias, contasBancarias, modelosRecibo] = await Promise.all([
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        ...(filtrarPorMes ? { data_vencimento: { gte: inicio, lte: fim } } : {}),
        ...(status && status !== "TODOS" ? { status: status as never } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, titulo: true } },
        plano_contas: { select: { id: true, nome: true } },
      },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresa_id: empresaId, status: "ASSINADO" },
      select: { id: true, titulo: true, cliente_id: true, valor_total: true, cliente: { select: { nome: true } } },
      orderBy: { criado_em: "desc" },
    }),
    prisma.planoDeContas.findMany({
      where: { empresa_id: empresaId, tipo: "RECEITA", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contaBancaria.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.modeloDocumento.findMany({
      where: { empresa_id: empresaId, tipo: "RECIBO", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <RecebiveisClient
      recebiveis={recebiveis.map((r) => ({
        ...r,
        valor: Number(r.valor),
        valor_pago: r.valor_pago != null ? Number(r.valor_pago) : null,
      }))}
      clientes={clientes}
      contratos={contratos.map((c) => ({ ...c, valor_total: Number(c.valor_total) }))}
      categorias={categorias}
      contasBancarias={contasBancarias}
      anoMes={anoMes}
      statusFiltro={status ?? "TODOS"}
      modelosRecibo={modelosRecibo}
    />
  );
}
