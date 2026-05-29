"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Vista = "dia" | "mensal" | "prevreal";

interface Lancamento {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
  referencia: string; valor: number; data: string; projetado: boolean;
}

interface Simulacao {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string; data: string; valor: number;
}

interface Props {
  lancamentos: Lancamento[];
  de: string; ate: string;
  saldoAnterior: number;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const TODAY = new Date().toISOString().split("T")[0];
const NOMES_MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function FluxoCaixaClient({ lancamentos, de, ate, saldoAnterior }: Props) {
  const router = useRouter();
  const [filtroDe, setFiltroDe] = useState(de);
  const [filtroAte, setFiltroAte] = useState(ate);
  const [vista, setVista] = useState<Vista>("dia");
  const [diasExp, setDiasExp] = useState<Set<string>>(new Set());
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [modalSim, setModalSim] = useState(false);
  const [novaSim, setNovaSim] = useState({ tipo: "SAIDA" as "ENTRADA" | "SAIDA", descricao: "", data: TODAY, valor: "" });

  const aplicar = () => router.push(`/financeiro/fluxo-de-caixa?de=${filtroDe}&ate=${filtroAte}`);

  const meses = useMemo(() => {
    const arr: { label: string; key: string }[] = [];
    const cur = new Date(de + "T00:00:00"); cur.setDate(1);
    const fim = new Date(ate + "T00:00:00");
    while (cur <= fim) {
      const y = cur.getFullYear(); const m = cur.getMonth();
      arr.push({ label: `${NOMES_MES[m]}/${String(y).slice(2)}`, key: `${y}-${String(m + 1).padStart(2, "0")}` });
      cur.setMonth(cur.getMonth() + 1);
    }
    return arr;
  }, [de, ate]);

  const toggleDia = (d: string) => setDiasExp(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const diasOrdenados = useMemo(() => {
    const s = new Set([...lancamentos.map(l => l.data), ...simulacoes.map(s => s.data)]);
    if (TODAY >= de && TODAY <= ate) s.add(TODAY);
    return Array.from(s).filter(d => d >= de && d <= ate).sort();
  }, [lancamentos, simulacoes, de, ate]);

  const somasMes = useMemo(() => meses.map(m => {
    const lMes = lancamentos.filter(l => l.data.startsWith(m.key));
    return {
      key: m.key, label: m.label,
      entradas: lMes.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0),
      saidas:   lMes.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0),
      entPrev:  lMes.filter(l => l.tipo === "ENTRADA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      entReal:  lMes.filter(l => l.tipo === "ENTRADA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
      saiPrev:  lMes.filter(l => l.tipo === "SAIDA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      saiReal:  lMes.filter(l => l.tipo === "SAIDA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
      isFuturo: m.key > TODAY.slice(0, 7),
    };
  }), [lancamentos, meses]);

  const dfcRows = useMemo(() => {
    const cats = new Map<string, { tipo: "ENTRADA" | "SAIDA"; mes: Record<string, number> }>();
    for (const l of lancamentos) {
      if (!cats.has(l.descricao)) cats.set(l.descricao, { tipo: l.tipo, mes: {} });
      const e = cats.get(l.descricao)!;
      e.mes[l.data.slice(0, 7)] = (e.mes[l.data.slice(0, 7)] ?? 0) + l.valor;
    }
    return Array.from(cats.entries()).map(([nome, v]) => ({ nome, ...v }));
  }, [lancamentos]);

  const totalEntradas = lancamentos.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
  const totalSaidas   = lancamentos.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
  const saldoPeriodo  = totalEntradas - totalSaidas;

  const adicionarSim = () => {
    if (!novaSim.descricao || !novaSim.valor || !novaSim.data) return;
    setSimulacoes(prev => [...prev, { id: crypto.randomUUID(), tipo: novaSim.tipo, descricao: novaSim.descricao, data: novaSim.data, valor: Number(novaSim.valor) }]);
    setNovaSim({ tipo: "SAIDA", descricao: "", data: TODAY, valor: "" });
    setModalSim(false);
  };

  const pct = (real: number, prev: number) => prev === 0 ? null : ((real - prev) / Math.abs(prev)) * 100;
  const fmtPct = (v: number | null) => {
    if (v === null) return null;
    const cor = Math.abs(v) < 5 ? "text-green-600" : v < 0 ? "text-destructive" : "text-amber-600";
    return <span className={`text-[10px] font-medium ${cor}`}>{v > 0 ? "+" : ""}{v.toFixed(0)}%</span>;
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Fluxo de Caixa</h1>
      </div>

      {/* Filtro + saldo anterior */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">De</span>
        <Input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} className="h-8 w-36 text-sm" />
        <span className="text-sm text-muted-foreground">Até</span>
        <Input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} className="h-8 w-36 text-sm" />
        <Button size="sm" variant="outline" className="h-8" onClick={aplicar}>Aplicar</Button>
        {saldoAnterior !== 0 && (
          <span className="text-sm text-muted-foreground ml-2">
            Saldo anterior:{" "}
            <span className={`font-semibold ${saldoAnterior >= 0 ? "text-primary" : "text-destructive"}`}>
              {fmtBRL(saldoAnterior)}
            </span>
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Entradas</p>
          <p className="text-xl font-bold text-primary">{fmtBRL(totalEntradas)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Saídas</p>
          <p className="text-xl font-bold text-orange-600">{fmtBRL(totalSaidas)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Saldo do Período</p>
          <p className={`text-xl font-bold ${saldoPeriodo >= 0 ? "text-green-600" : "text-destructive"}`}>
            {fmtBRL(saldoPeriodo)}
          </p>
        </div>
      </div>

      {/* Painel principal */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Sub-abas */}
        <div className="flex items-center border-b">
          {([
            { key: "dia",      label: "Dia a dia" },
            { key: "mensal",   label: "DFC Mensal" },
            { key: "prevreal", label: "Previsto × Realizado" },
          ] as { key: Vista; label: string }[]).map(v => (
            <button
              key={v.key}
              onClick={() => setVista(v.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${vista === v.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {v.label}
            </button>
          ))}
          <div className="flex-1" />
          {vista === "dia" && (
            <div className="flex items-center gap-2 px-4">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDiasExp(new Set(diasOrdenados))}>Expandir tudo</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDiasExp(new Set())}>Recolher</Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => setModalSim(true)}
              >
                + Simulação
              </Button>
            </div>
          )}
        </div>

        {/* ─── DIA A DIA ─────────────────────────────────── */}
        {vista === "dia" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground border-b">Data / Descrição</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-primary border-b w-32">Entradas</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-orange-600 border-b w-32">Saídas</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-amber-600 border-b w-24">Simulação</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b w-28">Saldo dia</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-primary border-b w-32">Saldo acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {diasOrdenados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">Nenhum lançamento neste período</td>
                    </tr>
                  )}
                  {(() => {
                    let acum = saldoAnterior;
                    return diasOrdenados.map(dia => {
                      const lDia = lancamentos.filter(l => l.data === dia);
                      const sDia = simulacoes.filter(s => s.data === dia);
                      const cr  = lDia.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
                      const cp  = lDia.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
                      const sim = sDia.reduce((s, x) => s + (x.tipo === "ENTRADA" ? x.valor : -x.valor), 0);
                      const saldoDia = cr - cp + sim;
                      acum += saldoDia;
                      const acumulado = acum;
                      const exp = diasExp.has(dia);
                      const temEventos = lDia.length > 0 || sDia.length > 0;
                      const isHoje = dia === TODAY;

                      return (
                        <>
                          <tr
                            key={dia}
                            className={`border-b cursor-pointer transition-colors
                              ${isHoje ? "bg-primary/5 border-l-2 border-l-primary" : ""}
                              ${exp ? "bg-muted/20" : "hover:bg-muted/30"}`}
                            onClick={() => temEventos && toggleDia(dia)}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {temEventos
                                  ? (exp ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />)
                                  : <span className="w-3" />}
                                <span className={`font-medium text-sm ${isHoje ? "text-primary" : ""}`}>{fmtData(dia)}</span>
                                {isHoje && <Badge variant="outline" className="text-[10px] h-4 px-1.5">hoje</Badge>}
                                {lDia.length > 0 && <span className="text-xs text-muted-foreground">{lDia.length} lançamento{lDia.length > 1 ? "s" : ""}</span>}
                                {sDia.length > 0 && <span className="text-xs text-amber-600">{sDia.length} sim.</span>}
                              </div>
                            </td>
                            <td className={`text-right px-3 py-2 text-sm font-medium w-32 ${cr > 0 ? "text-primary" : "text-muted-foreground"}`}>
                              {cr > 0 ? `+ ${fmtBRL(cr)}` : "—"}
                            </td>
                            <td className={`text-right px-3 py-2 text-sm font-medium w-32 ${cp > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                              {cp > 0 ? `− ${fmtBRL(cp)}` : "—"}
                            </td>
                            <td className={`text-right px-3 py-2 text-sm font-medium w-24 ${sim !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {sim !== 0 ? `${sim > 0 ? "+" : "−"} ${fmtBRL(Math.abs(sim))}` : "—"}
                            </td>
                            <td className={`text-right px-3 py-2 text-sm font-medium w-28 ${!temEventos ? "text-muted-foreground" : saldoDia >= 0 ? "" : "text-destructive"}`}>
                              {temEventos ? fmtBRL(saldoDia) : "—"}
                            </td>
                            <td className={`text-right px-3 py-2 text-sm font-bold w-32 ${acumulado >= 0 ? "text-primary" : "text-destructive"}`}>
                              {fmtBRL(acumulado)}
                            </td>
                          </tr>

                          {exp && (
                            <>
                              {lDia.map(l => (
                                <tr key={l.id} className="border-b bg-muted/10 text-xs">
                                  <td className="px-4 py-1.5 pl-9">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={l.tipo === "ENTRADA" ? "default" : "destructive"}
                                        className="text-[10px] h-4 px-1"
                                      >
                                        {l.tipo === "ENTRADA" ? "CR" : "CP"}
                                      </Badge>
                                      {l.projetado && <span className="text-muted-foreground italic">projetado</span>}
                                      <span className="truncate max-w-xs" title={l.descricao}>{l.descricao}</span>
                                      <span className="text-muted-foreground shrink-0">{l.referencia}</span>
                                    </div>
                                  </td>
                                  <td className={`text-right px-3 py-1.5 w-32 ${l.tipo === "ENTRADA" ? "text-primary font-medium" : ""}`}>
                                    {l.tipo === "ENTRADA" ? fmtBRL(l.valor) : ""}
                                  </td>
                                  <td className={`text-right px-3 py-1.5 w-32 ${l.tipo === "SAIDA" ? "text-orange-600 font-medium" : ""}`}>
                                    {l.tipo === "SAIDA" ? fmtBRL(l.valor) : ""}
                                  </td>
                                  <td className="w-24" /><td className="w-28" /><td className="w-32" />
                                </tr>
                              ))}
                              {sDia.map(s => (
                                <tr key={s.id} className="border-b bg-amber-50/50 text-xs">
                                  <td className="px-4 py-1.5 pl-9">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">SIM</span>
                                      <span className="truncate max-w-xs">{s.descricao}</span>
                                      <button
                                        className="ml-auto text-muted-foreground hover:text-destructive"
                                        onClick={e => { e.stopPropagation(); setSimulacoes(p => p.filter(x => x.id !== s.id)); }}
                                      >
                                        <X className="size-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="w-32" /><td className="w-32" />
                                  <td className={`text-right px-3 py-1.5 w-24 font-medium ${s.tipo === "ENTRADA" ? "text-primary" : "text-orange-600"}`}>
                                    {s.tipo === "ENTRADA" ? `+ ${fmtBRL(s.valor)}` : `− ${fmtBRL(s.valor)}`}
                                  </td>
                                  <td className="w-28" /><td className="w-32" />
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── DFC MENSAL ─────────────────────────────────── */}
        {vista === "mensal" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 500 }}>
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground border-b sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                    Conta / Descrição
                  </th>
                  {meses.map(m => (
                    <th key={m.key} className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b whitespace-nowrap min-w-[110px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b whitespace-nowrap w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Entradas */}
                <tr className="bg-primary">
                  <td className="px-4 py-2 text-xs font-bold text-primary-foreground sticky left-0 bg-primary z-10">▲ ENTRADAS (CR)</td>
                  {somasMes.map(m => (
                    <td key={m.key} className="text-right px-3 py-2 text-xs font-bold text-primary-foreground">
                      {m.entradas > 0 ? fmtBRL(m.entradas) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 text-xs font-bold text-primary-foreground">
                    {fmtBRL(somasMes.reduce((s, m) => s + m.entradas, 0))}
                  </td>
                </tr>
                {dfcRows.filter(r => r.tipo === "ENTRADA").map(row => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-1.5 text-xs pl-8 sticky left-0 bg-card z-10 truncate max-w-[200px]" title={row.nome}>
                        {row.nome}
                      </td>
                      {meses.map(m => {
                        const v = row.mes[m.key] ?? 0;
                        return (
                          <td key={m.key} className={`text-right px-3 py-1.5 text-xs ${v > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                            {v > 0 ? fmtBRL(v) : "—"}
                          </td>
                        );
                      })}
                      <td className={`text-right px-3 py-1.5 text-xs font-medium ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {total > 0 ? fmtBRL(total) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Saídas */}
                <tr className="bg-destructive/80">
                  <td className="px-4 py-2 text-xs font-bold text-white sticky left-0 bg-destructive/80 z-10">▼ SAÍDAS (CP)</td>
                  {somasMes.map(m => (
                    <td key={m.key} className="text-right px-3 py-2 text-xs font-bold text-white">
                      {m.saidas > 0 ? fmtBRL(m.saidas) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 text-xs font-bold text-white">
                    {fmtBRL(somasMes.reduce((s, m) => s + m.saidas, 0))}
                  </td>
                </tr>
                {dfcRows.filter(r => r.tipo === "SAIDA").map(row => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-1.5 text-xs pl-8 sticky left-0 bg-card z-10 truncate max-w-[200px]" title={row.nome}>
                        {row.nome}
                      </td>
                      {meses.map(m => {
                        const v = row.mes[m.key] ?? 0;
                        return (
                          <td key={m.key} className={`text-right px-3 py-1.5 text-xs ${v > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                            {v > 0 ? fmtBRL(v) : "—"}
                          </td>
                        );
                      })}
                      <td className={`text-right px-3 py-1.5 text-xs font-medium ${total > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                        {total > 0 ? fmtBRL(total) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Diferença */}
                <tr className="border-t-2 bg-muted/30">
                  <td className="px-4 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10">= Diferença</td>
                  {somasMes.map(m => {
                    const d = m.entradas - m.saidas;
                    return (
                      <td key={m.key} className={`text-right px-3 py-2 text-xs font-semibold ${d > 0 ? "text-green-600" : d < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {d !== 0 ? fmtBRL(d) : "—"}
                      </td>
                    );
                  })}
                  <td className={`text-right px-3 py-2 text-xs font-bold ${saldoPeriodo >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {fmtBRL(saldoPeriodo)}
                  </td>
                </tr>

                {/* Saldo acumulado */}
                {(() => {
                  let acum = saldoAnterior;
                  return (
                    <tr className="bg-primary">
                      <td className="px-4 py-2 text-xs font-bold text-primary-foreground sticky left-0 bg-primary z-10">Saldo Acumulado</td>
                      {somasMes.map(m => {
                        acum += m.entradas - m.saidas;
                        const v = acum;
                        return (
                          <td key={m.key} className={`text-right px-3 py-2 text-xs font-bold ${v >= 0 ? "text-blue-200" : "text-red-300"}`}>
                            {fmtBRL(v)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 text-xs font-bold text-primary-foreground">{fmtBRL(acum)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── PREVISTO × REALIZADO ──────────────────────── */}
        {vista === "prevreal" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 500 }}>
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground border-b sticky left-0 bg-muted/50 z-10 min-w-[180px]">Linha</th>
                  {meses.map(m => {
                    const fut = somasMes.find(s => s.key === m.key)?.isFuturo;
                    return (
                      <th key={m.key} className={`text-right px-3 py-2 text-xs font-semibold border-b whitespace-nowrap min-w-[110px] ${fut ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                        {m.label}
                        {fut && <div className="text-[9px] font-normal">futuro</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* ENTRADAS */}
                <tr className="bg-primary/5">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-primary tracking-wide border-b">▲ ENTRADAS (CR)</td>
                </tr>
                {(["entPrev", "entReal"] as const).map(k => (
                  <tr key={k} className={`border-b ${k === "entReal" ? "border-b-2" : ""}`}>
                    <td className="px-4 py-2 text-xs sticky left-0 bg-card z-10 text-muted-foreground">
                      {k === "entPrev" ? "Pendentes (previstas)" : "Realizadas"}
                    </td>
                    {somasMes.map(m => {
                      const v = m[k];
                      return (
                        <td key={m.key} className={`text-right px-3 py-2 text-xs ${v > 0 ? "text-primary" : "text-muted-foreground"} ${k === "entReal" ? "font-semibold" : ""}`}>
                          {v > 0 ? fmtBRL(v) : "—"}
                          {k === "entReal" && !m.isFuturo && m.entPrev > 0 && (
                            <div>{fmtPct(pct(m.entReal, m.entPrev))}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* SAÍDAS */}
                <tr className="bg-destructive/5">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-destructive tracking-wide border-b">▼ SAÍDAS (CP)</td>
                </tr>
                {(["saiPrev", "saiReal"] as const).map(k => (
                  <tr key={k} className={`border-b ${k === "saiReal" ? "border-b-2" : ""}`}>
                    <td className="px-4 py-2 text-xs sticky left-0 bg-card z-10 text-muted-foreground">
                      {k === "saiPrev" ? "Pendentes (previstas)" : "Realizadas"}
                    </td>
                    {somasMes.map(m => {
                      const v = m[k];
                      return (
                        <td key={m.key} className={`text-right px-3 py-2 text-xs ${v > 0 ? "text-orange-600" : "text-muted-foreground"} ${k === "saiReal" ? "font-semibold" : ""}`}>
                          {v > 0 ? fmtBRL(v) : "—"}
                          {k === "saiReal" && !m.isFuturo && m.saiPrev > 0 && (
                            <div>{fmtPct(pct(m.saiReal, m.saiPrev))}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* SALDO */}
                <tr className="bg-muted/20">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground tracking-wide border-b">⇄ SALDO DO PERÍODO</td>
                </tr>
                {(["saldoPrev", "saldoReal"] as const).map(k => (
                  <tr key={k} className="border-b">
                    <td className="px-4 py-2 text-xs font-semibold sticky left-0 bg-card z-10">
                      {k === "saldoPrev" ? "Saldo Previsto" : "Saldo Realizado"}
                    </td>
                    {somasMes.map(m => {
                      const v = k === "saldoPrev" ? m.entPrev - m.saiPrev : m.entReal - m.saiReal;
                      return (
                        <td key={m.key} className={`text-right px-3 py-2 text-xs font-semibold ${v >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {fmtBRL(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground px-4 py-3 border-t">
              Pendentes = lançamentos com vencimento no período ainda não baixados · Realizados = baixados por data de pagamento · % = desvio realizado vs previsto
            </p>
          </div>
        )}
      </div>

      {/* Modal de simulação */}
      <Dialog open={modalSim} onOpenChange={v => !v && setModalSim(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova simulação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={novaSim.tipo} onValueChange={v => setNovaSim(p => ({ ...p, tipo: v as "ENTRADA" | "SAIDA" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                value={novaSim.descricao}
                onChange={e => setNovaSim(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex.: Recebimento estimado cliente X"
              />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={novaSim.data} onChange={e => setNovaSim(p => ({ ...p, data: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={novaSim.valor}
                onChange={e => setNovaSim(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSim(false)}>Cancelar</Button>
            <Button onClick={adicionarSim} disabled={!novaSim.descricao || !novaSim.valor}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
