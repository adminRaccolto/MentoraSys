import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import Link from "next/link";
import { DollarSign, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function FinanceiroPage() {
  const empresaId = await obterEmpresaAtiva();
  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [recebiveis, contasPagar, contasBancarias] = await Promise.all([
    prisma.recebivel.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO"] } },
      include: { cliente: { select: { nome: true } }, contrato: { select: { titulo: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaPagar.findMany({
      where: { empresa_id: empresaId, status: { in: ["PENDENTE", "VENCIDO"] } },
      include: { plano_contas: { select: { nome: true } } },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.contaBancaria.findMany({
      where: { empresa_id: empresaId, ativo: true },
      include: {
        recebiveis: { where: { status: "PAGO" }, select: { valor_pago: true } },
        contas_pagar: { where: { status: "PAGO" }, select: { valor_pago: true } },
      },
    }),
  ]);

  const totalReceber = recebiveis.reduce((s, r) => s + Number(r.valor), 0);
  const totalVencidos = recebiveis
    .filter((r) => r.data_vencimento < hoje)
    .reduce((s, r) => s + Number(r.valor), 0);
  const totalPagar = contasPagar.reduce((s, c) => s + Number(c.valor), 0);

  const saldoContas = contasBancarias.reduce((s, c) => {
    const entradas = c.recebiveis.reduce((acc, r) => acc + Number(r.valor_pago ?? 0), 0);
    const saidas = c.contas_pagar.reduce((acc, cp) => acc + Number(cp.valor_pago ?? 0), 0);
    return s + Number(c.saldo_inicial) + entradas - saidas;
  }, 0);

  const proximosVencimentos = [
    ...recebiveis
      .filter((r) => r.data_vencimento <= em30dias)
      .map((r) => ({
        id: r.id,
        tipo: "recebivel" as const,
        descricao: r.descricao,
        referencia: r.cliente?.nome ?? r.contrato?.titulo ?? "—",
        valor: Number(r.valor),
        data: r.data_vencimento,
        vencido: r.data_vencimento < hoje,
      })),
    ...contasPagar
      .filter((c) => c.data_vencimento <= em30dias)
      .map((c) => ({
        id: c.id,
        tipo: "pagar" as const,
        descricao: c.descricao,
        referencia: c.fornecedor ?? c.plano_contas?.nome ?? "—",
        valor: Number(c.valor),
        data: c.data_vencimento,
        vencido: c.data_vencimento < hoje,
      })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <DollarSign className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Financeiro</h1>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/financeiro/recebiveis?status=PENDENTE" className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">A Receber</p>
          <p className="text-2xl font-bold text-primary">{formatBRL(totalReceber)}</p>
          <p className="text-xs text-muted-foreground mt-1">{recebiveis.length} títulos pendentes</p>
        </Link>

        <Link href="/financeiro/recebiveis?status=VENCIDO" className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">Vencidos</p>
          <p className={`text-2xl font-bold ${totalVencidos > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {formatBRL(totalVencidos)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {recebiveis.filter((r) => r.data_vencimento < hoje).length} em atraso
          </p>
        </Link>

        <Link href="/financeiro/contas-a-pagar?status=PENDENTE" className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">A Pagar</p>
          <p className="text-2xl font-bold text-orange-600">{formatBRL(totalPagar)}</p>
          <p className="text-xs text-muted-foreground mt-1">{contasPagar.length} contas pendentes</p>
        </Link>

        <Link href="/financeiro/contas-bancarias" className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">Saldo Contas</p>
          <p className={`text-2xl font-bold ${saldoContas >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatBRL(saldoContas)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{contasBancarias.length} contas cadastradas</p>
        </Link>
      </div>

      {/* Próximos vencimentos */}
      <div>
        <h2 className="font-medium mb-3">Vencimentos próximos (30 dias)</h2>
        {proximosVencimentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos 30 dias.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Referência</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Valor</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proximosVencimentos.map((item) => (
                  <tr key={`${item.tipo}-${item.id}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        {item.vencido && <AlertTriangle className="size-3.5 text-destructive shrink-0" />}
                        {item.descricao}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.referencia}</td>
                    <td className="px-4 py-2.5">
                      {item.tipo === "recebivel" ? (
                        <Badge variant="default" className="gap-1 text-xs">
                          <ArrowDownCircle className="size-3" /> Recebível
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <ArrowUpCircle className="size-3" /> A Pagar
                        </Badge>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${item.tipo === "recebivel" ? "text-primary" : "text-orange-600"}`}>
                      {formatBRL(item.valor)}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${item.vencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {item.data.toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
