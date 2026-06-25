"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// ─── Types ──────────────────────────────────────────────────────────────────

type Recebivel = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number | null;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  cliente: { id: string; nome: string } | null;
};

type ContaPagar = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  valor_pago: number | null;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
};

type Lead = {
  id: string;
  nome: string;
  etapa_chave: string;
  valor_estimado: number | null;
  criado_em: string;
};

type Proposta = {
  id: string;
  titulo: string;
  status: string;
  valor_total: number;
  criado_em: string;
  cliente: { nome: string };
};

type Projeto = {
  id: string;
  titulo: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  tarefas: { status: string }[];
};

interface Props {
  ano: number;
  recebiveis: Recebivel[];
  contasPagar: ContaPagar[];
  leads: Lead[];
  propostas: Proposta[];
  projetos: Projeto[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function exportarCSV(linhas: Record<string, unknown>[], nome: string) {
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  const csv = [
    cols.join(";"),
    ...linhas.map((r) =>
      cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(";")
    ),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className={`rounded-lg border p-4 space-y-1 ${cor}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{fmt.format(valor)}</p>
    </div>
  );
}

// ─── Tab Financeiro ──────────────────────────────────────────────────────────

function TabFinanceiro({
  recebiveis,
  contasPagar,
  ano,
}: {
  recebiveis: Recebivel[];
  contasPagar: ContaPagar[];
  ano: number;
}) {
  const totalReceber = recebiveis.reduce((s, r) => s + r.valor, 0);
  const totalRecebido = recebiveis
    .filter((r) => r.status === "PAGO")
    .reduce((s, r) => s + (r.valor_pago ?? r.valor), 0);
  const totalPagar = contasPagar.reduce((s, c) => s + c.valor, 0);
  const totalPago = contasPagar
    .filter((c) => c.status === "PAGO")
    .reduce((s, c) => s + (c.valor_pago ?? c.valor), 0);

  const mensal = MESES.map((mes, i) => {
    const rec = recebiveis.filter((r) => new Date(r.data_vencimento).getMonth() === i);
    const cp = contasPagar.filter((c) => new Date(c.data_vencimento).getMonth() === i);
    return {
      mes,
      recebivel: rec.reduce((s, r) => s + r.valor, 0),
      recebido: rec.filter((r) => r.status === "PAGO").reduce((s, r) => s + (r.valor_pago ?? r.valor), 0),
      pagar: cp.reduce((s, c) => s + c.valor, 0),
      pago: cp.filter((c) => c.status === "PAGO").reduce((s, c) => s + (c.valor_pago ?? c.valor), 0),
    };
  });

  function exportar() {
    exportarCSV(
      recebiveis.map((r) => ({
        Descrição: r.descricao,
        Cliente: r.cliente?.nome ?? "",
        Valor: r.valor.toFixed(2),
        "Valor Pago": r.valor_pago?.toFixed(2) ?? "",
        Status: r.status,
        Vencimento: formatarData(r.data_vencimento),
        "Data Pagamento": r.data_pagamento ? formatarData(r.data_pagamento) : "",
      })),
      `recebiveis_${ano}.csv`
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="A Receber" valor={totalReceber - totalRecebido} cor="border-blue-200 bg-blue-50/50" />
        <KpiCard label="Recebido" valor={totalRecebido} cor="border-emerald-200 bg-emerald-50/50" />
        <KpiCard label="A Pagar" valor={totalPagar - totalPago} cor="border-rose-200 bg-rose-50/50" />
        <KpiCard label="Pago" valor={totalPago} cor="border-slate-200 bg-slate-50/50" />
      </div>

      {/* Resumo mensal */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Resumo mensal</h3>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Prev. Receita</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Prev. Despesa</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mensal.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{m.mes}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt.format(m.recebivel)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmt.format(m.recebido)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt.format(m.pagar)}</TableCell>
                  <TableCell className="text-right text-rose-600">{fmt.format(m.pago)}</TableCell>
                  <TableCell className={`text-right font-medium ${m.recebido - m.pago >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {fmt.format(m.recebido - m.pago)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Top clientes */}
      {(() => {
        const porCliente = recebiveis
          .filter((r) => r.status === "PAGO" && r.cliente)
          .reduce<Record<string, { nome: string; total: number }>>((acc, r) => {
            const id = r.cliente!.id;
            if (!acc[id]) acc[id] = { nome: r.cliente!.nome, total: 0 };
            acc[id].total += r.valor_pago ?? r.valor;
            return acc;
          }, {});
        const lista = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 5);
        if (!lista.length) return null;
        return (
          <div>
            <h3 className="text-sm font-semibold mb-2">Top 5 clientes (receita recebida)</h3>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((c, i) => (
                    <TableRow key={c.nome}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmt.format(c.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tab CRM ─────────────────────────────────────────────────────────────────

const STATUS_LEAD: { key: string; label: string; cor: string }[] = [
  { key: "NOVO", label: "Novo", cor: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "QUALIFICADO", label: "Qualificado", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "PROPOSTA", label: "Proposta", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "GANHO", label: "Ganho", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "PERDIDO", label: "Perdido", cor: "bg-rose-50 text-rose-700 border-rose-200" },
];

const STATUS_PROPOSTA: { key: string; label: string; cor: string }[] = [
  { key: "RASCUNHO", label: "Rascunho", cor: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "ENVIADA", label: "Enviada", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "VISUALIZADA", label: "Visualizada", cor: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "ACEITA", label: "Aceita", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "RECUSADA", label: "Recusada", cor: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "EXPIRADA", label: "Expirada", cor: "bg-amber-50 text-amber-700 border-amber-200" },
];

function TabCrm({ leads, propostas, ano }: { leads: Lead[]; propostas: Proposta[]; ano: number }) {
  const totalLeads = leads.length;
  const ganhos = leads.filter((l) => l.etapa_chave === "GANHO").length;
  const perdidos = leads.filter((l) => l.etapa_chave === "PERDIDO").length;
  const conversoLeads = totalLeads ? Math.round((ganhos / totalLeads) * 100) : 0;

  const totalPropostas = propostas.length;
  const aceitas = propostas.filter((p) => p.status === "ACEITA").length;
  const conversaoPropostas = totalPropostas ? Math.round((aceitas / totalPropostas) * 100) : 0;

  function exportar() {
    exportarCSV(
      leads.map((l) => ({
        Nome: l.nome,
        Status: l.etapa_chave,
        "Valor Estimado": l.valor_estimado?.toFixed(2) ?? "",
        "Criado em": formatarData(l.criado_em),
      })),
      `leads_${ano}.csv`
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total de Leads" valor={totalLeads} cor="border-slate-200 bg-slate-50/50" />
        <KpiCard label="Leads Ganhos" valor={ganhos} cor="border-emerald-200 bg-emerald-50/50" />
        <KpiCard label="Leads Perdidos" valor={perdidos} cor="border-rose-200 bg-rose-50/50" />
        <KpiCard label="Propostas Aceitas" valor={aceitas} cor="border-blue-200 bg-blue-50/50" />
      </div>

      {/* Taxas de conversão */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Taxa de conversão — Leads</p>
          <p className="text-2xl font-bold mt-1">{conversoLeads}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ganhos} ganhos de {totalLeads} leads</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Taxa de conversão — Propostas</p>
          <p className="text-2xl font-bold mt-1">{conversaoPropostas}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">{aceitas} aceitas de {totalPropostas} enviadas</p>
        </div>
      </div>

      {/* Funil de leads */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Funil de Leads</h3>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STATUS_LEAD.map((s) => {
            const grupo = leads.filter((l) => l.etapa_chave === s.key);
            const valor = grupo.reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0);
            return (
              <div key={s.key} className={`rounded-lg border p-3 ${s.cor}`}>
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{grupo.length}</p>
                {valor > 0 && <p className="text-[10px] mt-0.5 opacity-70">{fmt.format(valor)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status de propostas */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Propostas por Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STATUS_PROPOSTA.map((s) => {
            const grupo = propostas.filter((p) => p.status === s.key);
            const valor = grupo.reduce((sum, p) => sum + p.valor_total, 0);
            return (
              <div key={s.key} className={`rounded-lg border p-3 ${s.cor}`}>
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{grupo.length}</p>
                {valor > 0 && <p className="text-[10px] mt-0.5 opacity-70">{fmt.format(valor)}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Projetos ────────────────────────────────────────────────────────────

const STATUS_PROJETO: { key: string; label: string; cor: string; badge: string }[] = [
  { key: "PLANEJAMENTO", label: "Planejamento", cor: "bg-slate-50 border-slate-200", badge: "bg-slate-100 text-slate-700" },
  { key: "EM_ANDAMENTO", label: "Em Andamento", cor: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700" },
  { key: "CONCLUIDO", label: "Concluído", cor: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  { key: "CANCELADO", label: "Cancelado", cor: "bg-rose-50 border-rose-200", badge: "bg-rose-100 text-rose-700" },
];

function TabProjetos({ projetos }: { projetos: Projeto[] }) {
  const todasTarefas = projetos.flatMap((p) => p.tarefas);
  const tarefasConcluidas = todasTarefas.filter((t) => t.status === "CONCLUIDA").length;
  const tarefasPendentes = todasTarefas.filter((t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO").length;
  const pctConcluido = todasTarefas.length
    ? Math.round((tarefasConcluidas / todasTarefas.length) * 100)
    : 0;

  function exportar() {
    exportarCSV(
      projetos.map((p) => ({
        Título: p.titulo,
        Status: p.status,
        "Data Início": p.data_inicio ? formatarData(p.data_inicio) : "",
        "Data Fim": p.data_fim ? formatarData(p.data_fim) : "",
        "Total Tarefas": p.tarefas.length,
        "Tarefas Concluídas": p.tarefas.filter((t) => t.status === "CONCLUIDA").length,
      })),
      "projetos.csv"
    );
  }

  return (
    <div className="space-y-6">
      {/* Projetos por status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_PROJETO.map((s) => {
          const count = projetos.filter((p) => p.status === s.key).length;
          return (
            <div key={s.key} className={`rounded-lg border p-4 ${s.cor}`}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Tarefas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-4 bg-slate-50/50">
          <p className="text-xs text-muted-foreground">Total de Tarefas</p>
          <p className="text-2xl font-bold mt-1">{todasTarefas.length}</p>
        </div>
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground">Concluídas</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{tarefasConcluidas}</p>
        </div>
        <div className="rounded-lg border p-4 bg-amber-50/50">
          <p className="text-xs text-muted-foreground">Em Aberto</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{tarefasPendentes}</p>
        </div>
      </div>

      {/* Progresso geral */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Progresso geral de tarefas</p>
          <p className="text-sm font-bold">{pctConcluido}%</p>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${pctConcluido}%` }}
          />
        </div>
      </div>

      {/* Lista de projetos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Todos os projetos</h3>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tarefas</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos.map((p) => {
                const s = STATUS_PROJETO.find((x) => x.key === p.status);
                const concluidas = p.tarefas.filter((t) => t.status === "CONCLUIDA").length;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.titulo}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s?.badge ?? ""}`}>
                        {s?.label ?? p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{p.tarefas.length}</TableCell>
                    <TableCell className="text-right">{concluidas}</TableCell>
                  </TableRow>
                );
              })}
              {!projetos.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum projeto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ──────────────────────────────────────────────────────────

export default function RelatoriosClient({
  ano,
  recebiveis,
  contasPagar,
  leads,
  propostas,
  projetos,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function navAno(delta: number) {
    router.push(`${pathname}?ano=${ano + delta}`);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada por período</p>
        </div>
        <div className="flex items-center gap-1 no-print">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navAno(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium w-12 text-center">{ano}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navAno(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-2" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="financeiro">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4">
          <TabFinanceiro recebiveis={recebiveis} contasPagar={contasPagar} ano={ano} />
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <TabCrm leads={leads} propostas={propostas} ano={ano} />
        </TabsContent>

        <TabsContent value="projetos" className="mt-4">
          <TabProjetos projetos={projetos} />
        </TabsContent>
      </Tabs>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
