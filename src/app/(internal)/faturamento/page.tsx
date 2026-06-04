import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import FaturamentoClient from "./faturamento-client";

export default async function FaturamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    cliente_id?: string;
    status?: string;
    mes?: string;
    ano?: string;
  }>;
}) {
  const empresaId = await obterEmpresaAtiva();
  const params = await searchParams;

  const hoje = new Date();
  const ano = params.ano ? parseInt(params.ano) : hoje.getFullYear();
  const mes = params.mes ? parseInt(params.mes) : hoje.getMonth();

  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);

  const where: Record<string, unknown> = {
    empresa_id: empresaId,
    competencia: { gte: inicioMes, lte: fimMes },
  };
  if (params.cliente_id) where.cliente_id = params.cliente_id;
  if (params.status) where.status = params.status;

  const [notas, clientes, contratos, kpis, empresa] = await Promise.all([
    prisma.notaFiscal.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, titulo: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
    prisma.notaFiscal.groupBy({
      by: ["status"],
      where: { empresa_id: empresaId, competencia: { gte: inicioMes, lte: fimMes } },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    }),
  ]);

  const kpiMap = Object.fromEntries(
    kpis.map((k) => [k.status, { valor: Number(k._sum.valor ?? 0), count: k._count.id }])
  );

  const config = (empresa?.configuracoes as Record<string, unknown>) ?? {};

  return (
    <FaturamentoClient
      notas={notas.map((n) => ({
        ...n,
        valor: Number(n.valor),
        aliquota_iss: n.aliquota_iss ? Number(n.aliquota_iss) : null,
        competencia: n.competencia.toISOString(),
        data_emissao: n.data_emissao?.toISOString() ?? null,
        data_vencimento: n.data_vencimento?.toISOString() ?? null,
        criado_em: n.criado_em.toISOString(),
        atualizado_em: n.atualizado_em.toISOString(),
        numero_nfse: n.numero_nfse ?? null,
        nfsio_id: n.nfsio_id ?? null,
        asaas_invoice_id: n.asaas_invoice_id ?? null,
        nfse_provider: n.nfse_provider ?? null,
        pdf_url: n.pdf_url ?? null,
        email_enviado: n.email_enviado,
      }))}
      clientes={clientes}
      contratos={contratos}
      kpis={kpiMap}
      mes={mes}
      ano={ano}
      filtros={{
        cliente_id: params.cliente_id ?? "",
        status: params.status ?? "",
      }}
      configFiscal={{
        codigo_servico_padrao: (config.codigo_servico_padrao as string) ?? "",
        aliquota_iss_padrao: config.aliquota_iss_padrao != null ? Number(config.aliquota_iss_padrao) : null,
      }}
    />
  );
}
