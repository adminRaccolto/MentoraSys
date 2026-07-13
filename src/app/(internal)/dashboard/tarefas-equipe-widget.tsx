"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ArrowRight, AlertTriangle, CheckCircle2, Clock, Circle } from "lucide-react";

export type KpiUsuarioDash = {
  id: string;
  nome: string;
  total: number;
  concluidas: number;
  atrasadas: number;
  naoIniciadas: number;
  emAndamento: number;
  porProjeto: {
    projetoId: string;
    titulo: string;
    total: number;
    concluidas: number;
    atrasadas: number;
    naoIniciadas: number;
    emAndamento: number;
  }[];
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function PctRing({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke="currentColor" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={pct >= 75 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-rose-500"}
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

function LinhaColaborador({ u }: { u: KpiUsuarioDash }) {
  const [aberto, setAberto] = useState(false);
  const pct = u.total > 0 ? Math.round((u.concluidas / u.total) * 100) : 0;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {iniciais(u.nome)}
        </div>

        {/* Nome + barra */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{u.nome}</span>
            <span className="text-xs text-muted-foreground tabular-nums ml-2">{u.concluidas}/{u.total}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Chips */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {u.atrasadas > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="size-2.5" />{u.atrasadas}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 className="size-2.5" />{u.concluidas}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
            <Circle className="size-2.5" />{u.naoIniciadas}
          </span>
        </div>

        {/* Anel */}
        <PctRing value={u.concluidas} total={u.total} />

        {/* Toggle */}
        <div className="text-muted-foreground">
          {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {/* Projetos expandidos */}
      {aberto && (
        <div className="bg-muted/20 border-t border-border">
          {u.porProjeto.map((p) => {
            const ppct = p.total > 0 ? Math.round((p.concluidas / p.total) * 100) : 0;
            return (
              <div key={p.projetoId} className="flex items-center gap-3 px-4 py-2 text-sm border-b border-border/50 last:border-0">
                <div className="w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-muted-foreground truncate">{p.titulo}</span>
                    <span className="text-xs tabular-nums text-muted-foreground ml-2">{p.concluidas}/{p.total}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ppct >= 75 ? "bg-emerald-400" : ppct >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                      style={{ width: `${ppct}%` }}
                    />
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {p.atrasadas > 0 && (
                    <span className="text-[10px] font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-full">
                      {p.atrasadas} atrasada{p.atrasadas > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{ppct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TarefasEquipeWidget({
  usuarios,
  totalGeral,
  concluidasGeral,
  atrasadasGeral,
  naoInidiadasGeral,
  emAndamentoGeral,
}: {
  usuarios: KpiUsuarioDash[];
  totalGeral: number;
  concluidasGeral: number;
  atrasadasGeral: number;
  naoInidiadasGeral: number;
  emAndamentoGeral: number;
}) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="font-semibold text-sm">Tarefas por Colaborador</h2>
        </div>
        <Link
          href="/relatorios"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          Relatório completo <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* KPIs sumário */}
      <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
        {[
          { label: "Total", value: totalGeral, cor: "text-foreground", bg: "" },
          { label: "Concluídas", value: concluidasGeral, cor: "text-emerald-600", bg: "bg-emerald-50/50 dark:bg-emerald-950/20" },
          { label: "Atrasadas", value: atrasadasGeral, cor: "text-rose-600", bg: "bg-rose-50/50 dark:bg-rose-950/20" },
          { label: "Não iniciadas", value: naoInidiadasGeral, cor: "text-amber-600", bg: "bg-amber-50/50 dark:bg-amber-950/20" },
        ].map((k) => (
          <div key={k.label} className={`flex flex-col items-center py-3 px-2 ${k.bg}`}>
            <span className={`text-xl font-bold tabular-nums ${k.cor}`}>{k.value}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Barra geral */}
      <div className="px-4 py-2 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
            {totalGeral > 0 && (
              <>
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(concluidasGeral / totalGeral) * 100}%` }} />
                <div className="h-full bg-blue-400 transition-all" style={{ width: `${(emAndamentoGeral / totalGeral) * 100}%` }} />
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${(atrasadasGeral / totalGeral) * 100}%` }} />
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {totalGeral > 0 ? Math.round((concluidasGeral / totalGeral) * 100) : 0}% concluído
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          {[
            { cor: "bg-emerald-500", label: "Concluídas" },
            { cor: "bg-blue-400", label: "Em andamento" },
            { cor: "bg-rose-500", label: "Atrasadas" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${l.cor}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Lista colaboradores */}
      <div>
        {usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma tarefa com responsável encontrada.
          </p>
        ) : (
          usuarios.map((u) => <LinhaColaborador key={u.id} u={u} />)
        )}
      </div>
    </div>
  );
}
