import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ContratosClient from "./contratos-client";

export default async function ContratosPage() {
  const empresaId = await obterEmpresaAtiva();

  const [contratos, clientes, propostasAceitas, propostasParaBanner, modelosContrato, usuarios, empresa] = await Promise.all([
    prisma.contrato.findMany({
      where: { empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true } },
        proposta: { select: { id: true, titulo: true } },
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { recebiveis: true } },
      },
      orderBy: { criado_em: "desc" },
    }).then((rows) => rows.map((r) => ({
      ...r,
      valor_total: Number(r.valor_total),
      juros_ao_mes_percentual: r.juros_ao_mes_percentual != null ? Number(r.juros_ao_mes_percentual) : null,
      multa_percentual: r.multa_percentual != null ? Number(r.multa_percentual) : null,
      reembolso_valor_km: r.reembolso_valor_km != null ? Number(r.reembolso_valor_km) : null,
      reembolso_distancia_km: r.reembolso_distancia_km != null ? Number(r.reembolso_distancia_km) : null,
      reembolso_limite_alimentacao: r.reembolso_limite_alimentacao != null ? Number(r.reembolso_limite_alimentacao) : null,
      reembolso_limite_hospedagem: r.reembolso_limite_hospedagem != null ? Number(r.reembolso_limite_hospedagem) : null,
      recebiveis_count: r._count.recebiveis,
    }))),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, nome: true, cpf_cnpj: true, contato_principal: true, email: true, telefone: true, preco_km: true, distancia_km: true },
      orderBy: { nome: "asc" },
    }).then((rows) => rows.map((c) => ({
      ...c,
      preco_km: c.preco_km != null ? Number(c.preco_km) : null,
      distancia_km: c.distancia_km != null ? Number(c.distancia_km) : null,
    }))),
    prisma.proposta.findMany({
      where: {
        empresa_id: empresaId,
        status: "ACEITA",
      },
      select: {
        id: true,
        titulo: true,
        cliente_id: true,
        valor_total: true,
        numero_parcelas: true,
        primeiro_vencimento: true,
        forma_pagamento: true,
        periodicidade: true,
        parcelas_json: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { criado_em: "desc" },
    }).then((rows) => rows.map((r) => ({ ...r, valor_total: Number(r.valor_total) }))),
    prisma.proposta.findMany({
      where: {
        empresa_id: empresaId,
        status: "ACEITA",
        contrato: null,
      },
      select: {
        id: true,
        titulo: true,
        cliente_id: true,
        valor_total: true,
        numero_parcelas: true,
        primeiro_vencimento: true,
        forma_pagamento: true,
        periodicidade: true,
        parcelas_json: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { criado_em: "desc" },
    }).then((rows) => rows.map((r) => ({ ...r, valor_total: Number(r.valor_total) }))),
    prisma.modeloDocumento.findMany({
      where: { empresa_id: empresaId, tipo: "CONTRATO", ativo: true },
      select: { id: true, nome: true, cliente_assina: true },
      orderBy: { nome: "asc" },
    }),
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId },
      select: { usuario: { select: { id: true, nome: true } } },
      orderBy: { usuario: { nome: "asc" } },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    }),
  ]);

  const cfg = (empresa?.configuracoes as Record<string, string>) ?? {};

  return (
    <ContratosClient
      contratos={contratos}
      clientes={clientes}
      propostasAceitas={propostasAceitas}
      propostasParaBanner={propostasParaBanner}
      modelosContrato={modelosContrato}
      usuarios={usuarios.map((m) => m.usuario)}
      empresaConfig={{ email: cfg.email_contato ?? "", representante: cfg.representante ?? "", cidade: cfg.cidade ?? "", estado: cfg.estado ?? "" }}
    />
  );
}
