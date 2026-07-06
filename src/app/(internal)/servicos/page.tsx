import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ServicosClient from "./servicos-client";

export default async function ServicosPage() {
  const empresaId = await obterEmpresaAtiva();

  const [servicos, contasReceita] = await Promise.all([
    prisma.servico.findMany({
      where: { empresa_id: empresaId },
      select: {
        id: true,
        nome: true,
        descricao: true,
        valor_base: true,
        plano_contas_id: true,
        canal: true,
        plano: true,
        tipo_cobranca: true,
        asaas_link_pagamento: true,
        ativo: true,
        plano_contas: { select: { nome: true, codigo: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.planoDeContas.findMany({
      where: { empresa_id: empresaId, tipo: "RECEITA", aceita_lancamento: true, ativo: true },
      select: { id: true, nome: true, codigo: true },
      orderBy: [{ codigo: "asc" }, { nome: "asc" }],
    }),
  ]);

  return (
    <ServicosClient
      servicos={servicos.map((s) => ({
        ...s,
        valor_base: s.valor_base != null ? Number(s.valor_base) : null,
        canal: s.canal ?? null,
        plano: s.plano ?? null,
        tipo_cobranca: s.tipo_cobranca ?? null,
        asaas_link_pagamento: s.asaas_link_pagamento ?? null,
      }))}
      contasReceita={contasReceita}
    />
  );
}
