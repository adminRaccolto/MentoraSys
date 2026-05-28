import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ContasBancariasClient from "./contas-bancarias-client";

export default async function ContasBancariasPage() {
  const empresaId = await obterEmpresaAtiva();

  const contas = await prisma.contaBancaria.findMany({
    where: { empresa_id: empresaId },
    include: {
      recebiveis: { where: { status: "PAGO" }, select: { valor_pago: true } },
      contas_pagar: { where: { status: "PAGO" }, select: { valor_pago: true } },
    },
    orderBy: { criado_em: "asc" },
  });

  const contasComSaldo = contas.map((c) => {
    const entradas = c.recebiveis.reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
    const saidas = c.contas_pagar.reduce((s, cp) => s + Number(cp.valor_pago ?? 0), 0);
    return {
      id: c.id,
      nome: c.nome,
      banco: c.banco,
      agencia: c.agencia,
      conta: c.conta,
      tipo: c.tipo,
      saldo_inicial: Number(c.saldo_inicial),
      saldo_atual: Number(c.saldo_inicial) + entradas - saidas,
      ativo: c.ativo,
    };
  });

  return <ContasBancariasClient contas={contasComSaldo} />;
}
