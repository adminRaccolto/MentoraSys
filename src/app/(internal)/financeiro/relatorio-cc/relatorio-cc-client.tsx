"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, TrendingUp, TrendingDown, Minus, FolderKanban, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Linha {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
  titulo_projeto: string | null;
  receita: number;
  despesa: number;
  saldo: number;
}

interface Props {
  linhas: Linha[];
  de: string;
  ate: string;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelatorioCCClient({ linhas, de, ate }: Props) {
  const router = useRouter();
  const [filtroDe, setFiltroDe] = useState(de);
  const [filtroAte, setFiltroAte] = useState(ate);

  const aplicar = () => router.push(`/financeiro/relatorio-cc?de=${filtroDe}&ate=${filtroAte}`);

  const totalReceita = linhas.reduce((s, l) => s + l.receita, 0);
  const totalDespesa = linhas.reduce((s, l) => s + l.despesa, 0);
  const totalSaldo   = totalReceita - totalDespesa;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Relatório por Centro de Custo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receitas, despesas e saldo por CC no período
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-3 p-4 border rounded-xl bg-card">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">De</p>
          <Input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} className="w-40 h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Até</p>
          <Input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} className="w-40 h-9 text-sm" />
        </div>
        <Button size="sm" onClick={aplicar}>Aplicar</Button>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total receitas", valor: totalReceita, icon: TrendingUp, cor: "text-emerald-600" },
          { label: "Total despesas", valor: totalDespesa, icon: TrendingDown, cor: "text-red-500" },
          { label: "Saldo líquido",  valor: totalSaldo,   icon: Minus,       cor: totalSaldo >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map(({ label, valor, icon: Icon, cor }) => (
          <div key={label} className="border rounded-xl p-4 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`size-4 ${cor}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className={`text-lg font-bold ${cor}`}>{brl(valor)}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {linhas.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart3 className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum lançamento com CC no período</p>
          <p className="text-xs mt-1">Atribua centros de custo nos lançamentos financeiros</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Centro de custo</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {l.titulo_projeto
                        ? <FolderKanban className="size-3.5 text-muted-foreground shrink-0" />
                        : <Tag className="size-3.5 text-muted-foreground shrink-0" />
                      }
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{l.nome}</span>
                          {l.codigo && <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{l.codigo}</span>}
                          {!l.ativo && <Badge variant="outline" className="text-[10px] py-0">Inativo</Badge>}
                        </div>
                        {l.titulo_projeto && (
                          <p className="text-xs text-muted-foreground">→ {l.titulo_projeto}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600">
                    {l.receita > 0 ? brl(l.receita) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-500">
                    {l.despesa > 0 ? brl(l.despesa) : "—"}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${l.saldo >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {brl(l.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
