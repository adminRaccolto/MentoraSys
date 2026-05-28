"use client";

import { useRouter } from "next/navigation";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Lancamento {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
  referencia: string; valor: number; data: Date; projetado: boolean;
}

interface Props {
  lancamentos: Lancamento[];
  anoMes: string;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FluxoCaixaClient({ lancamentos, anoMes }: Props) {
  const router = useRouter();
  const [ano, mes] = anoMes.split("-").map(Number);

  const navMes = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    const novoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/financeiro/fluxo-de-caixa?mes=${novoMes}`);
  };

  const nomeMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const realizados = lancamentos.filter((l) => !l.projetado);
  const projetados = lancamentos.filter((l) => l.projetado);

  const totalEntradasRealizadas = realizados.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
  const totalSaidasRealizadas = realizados.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
  const totalEntradasProjetadas = projetados.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
  const totalSaidasProjetadas = projetados.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);

  const totalEntradas = totalEntradasRealizadas + totalEntradasProjetadas;
  const totalSaidas = totalSaidasRealizadas + totalSaidasProjetadas;
  const saldo = totalEntradas - totalSaidas;

  let acumulado = 0;
  const linhas = lancamentos.map((l) => {
    acumulado += l.tipo === "ENTRADA" ? l.valor : -l.valor;
    return { ...l, saldoAcumulado: acumulado };
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Fluxo de Caixa</h1>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{nomeMes}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Entradas</p>
          <p className="text-xl font-bold text-primary">{formatBRL(totalEntradas)}</p>
          {totalEntradasProjetadas > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatBRL(totalEntradasRealizadas)} realizado · {formatBRL(totalEntradasProjetadas)} projetado
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Saídas</p>
          <p className="text-xl font-bold text-orange-600">{formatBRL(totalSaidas)}</p>
          {totalSaidasProjetadas > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatBRL(totalSaidasRealizadas)} realizado · {formatBRL(totalSaidasProjetadas)} projetado
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Saldo do Período</p>
          <p className={`text-xl font-bold ${saldo >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatBRL(saldo)}
          </p>
        </div>
      </div>

      {/* Tabela de lançamentos */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Saldo Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum lançamento neste mês
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.id} className={l.projetado ? "opacity-60" : ""}>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(l.data).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {l.tipo === "ENTRADA" ? (
                      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">ENTRADA</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">SAÍDA</Badge>
                    )}
                    {l.projetado && (
                      <span className="text-xs text-muted-foreground italic">projetado</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{l.descricao}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{l.referencia}</TableCell>
                <TableCell className={`text-right font-medium ${l.tipo === "ENTRADA" ? "text-primary" : "text-orange-600"}`}>
                  {l.tipo === "ENTRADA" ? "+" : "-"}{formatBRL(l.valor)}
                </TableCell>
                <TableCell className={`text-right font-medium ${l.saldoAcumulado >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatBRL(l.saldoAcumulado)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
