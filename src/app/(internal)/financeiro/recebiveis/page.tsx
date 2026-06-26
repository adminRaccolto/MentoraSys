import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import RecebiveisClient from "./recebiveis-client";

interface Props {
  searchParams: Promise<{ status?: string; de?: string; ate?: string }>;
}

export default async function RecebiveisPage({ searchParams }: Props) {
  const { status, de, ate } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const deStr = de ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ateStr = ate ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
  const inicio = new Date(`${deStr}T00:00:00`);
  const fim = new Date(`${ateStr}T23:59:59`);

  const [recebiveis, clientes, contratos, categorias, contasBancarias, modelosRecibo, centrosCusto] = await Promise.all([
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        data_vencimento: { gte: inicio, lte: fim },
        // "VENCIDO" não é um status fixo no banco — itens vencidos têm status PENDENTE com data passada
        ...(status === "VENCIDO"
          ? { OR: [{ status: "VENCIDO" }, { status: "PENDENTE", data_vencimento: { lt: new Date() } }] }
          : status === "PENDENTE"
          ? { status: "PENDENTE", data_vencimento: { gte: new Date() } }
          : status && status !== "TODOS"
          ? { status: status as never }
          : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, titulo: true, numero_contrato: true, juros_ao_mes_percentual: true, multa_percentual: true } },
        plano_contas: { select: { id: true, nome: true } },
        boleto: { select: { id: true, status: true, linha_digitavel: true, url_boleto: true, url_fatura: true } },
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
    prisma.centroCusto.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, codigo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <RecebiveisClient
      key={`${deStr}_${ateStr}_${status ?? "TODOS"}`}
      recebiveis={recebiveis.map((r) => ({
        ...r,
        valor: Number(r.valor),
        valor_pago: r.valor_pago != null ? Number(r.valor_pago) : null,
        contrato: r.contrato ? {
          ...r.contrato,
          juros_ao_mes_percentual: r.contrato.juros_ao_mes_percentual != null ? Number(r.contrato.juros_ao_mes_percentual) : null,
          multa_percentual: r.contrato.multa_percentual != null ? Number(r.contrato.multa_percentual) : null,
        } : null,
      }))}
      clientes={clientes}
      contratos={contratos.map((c) => ({ ...c, valor_total: Number(c.valor_total) }))}
      categorias={categorias}
      contasBancarias={contasBancarias}
      de={deStr}
      ate={ateStr}
      statusFiltro={status ?? "TODOS"}
      modelosRecibo={modelosRecibo}
      centrosCusto={centrosCusto}
    />
  );
}
