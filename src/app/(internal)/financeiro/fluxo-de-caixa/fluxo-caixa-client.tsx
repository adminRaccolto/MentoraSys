"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, ChevronDown, ChevronRight, Pencil, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Vista = "dia" | "mensal" | "prevreal";
type TipoFiltro = "ambos" | "previsto" | "realizado";

interface Lancamento {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string;
  referencia: string; valor: number; data: string; projetado: boolean;
}

interface Simulacao {
  id: string; tipo: "ENTRADA" | "SAIDA";
  descricao: string; referencia: string; data: string; valor: number; ativa: boolean;
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

const FORM_VAZIO = { tipo: "SAIDA" as "ENTRADA" | "SAIDA", descricao: "", referencia: "", data: TODAY, valor: "" };

export default function FluxoCaixaClient({ lancamentos, de, ate, saldoAnterior }: Props) {
  const router = useRouter();
  const [filtroDe, setFiltroDe] = useState(de);
  const [filtroAte, setFiltroAte] = useState(ate);
  const [vista, setVista] = useState<Vista>("dia");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("ambos");
  const [diasExp, setDiasExp] = useState<Set<string>>(new Set());

  // Simulações
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [simVisiveis, setSimVisiveis] = useState(true);
  const [modalGerenciar, setModalGerenciar] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const aplicar = () => router.push(`/financeiro/fluxo-de-caixa?de=${filtroDe}&ate=${filtroAte}`);
  const toggleDia = (d: string) => setDiasExp(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  // Lancamentos filtrados pelo tipo (ambos/previsto/realizado)
  const lancFiltrados = useMemo(() => lancamentos.filter(l => {
    if (tipoFiltro === "previsto") return l.projetado;
    if (tipoFiltro === "realizado") return !l.projetado;
    return true;
  }), [lancamentos, tipoFiltro]);

  // Simulações ativas visíveis
  const simsAtivas = useMemo(() =>
    simVisiveis ? simulacoes.filter(s => s.ativa) : [],
    [simulacoes, simVisiveis]
  );

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

  const diasOrdenados = useMemo(() => {
    const s = new Set([
      ...lancFiltrados.map(l => l.data),
      ...simsAtivas.map(s => s.data),
    ]);
    if (TODAY >= de && TODAY <= ate) s.add(TODAY);
    return Array.from(s).filter(d => d >= de && d <= ate).sort();
  }, [lancFiltrados, simsAtivas, de, ate]);

  const somasMes = useMemo(() => meses.map(m => {
    const lMes = lancFiltrados.filter(l => l.data.startsWith(m.key));
    const sMes = simsAtivas.filter(s => s.data.startsWith(m.key));
    return {
      key: m.key, label: m.label,
      entradas: lMes.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0) + sMes.filter(s => s.tipo === "ENTRADA").reduce((s, x) => s + x.valor, 0),
      saidas:   lMes.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0)   + sMes.filter(s => s.tipo === "SAIDA").reduce((s, x) => s + x.valor, 0),
      entPrev:  lMes.filter(l => l.tipo === "ENTRADA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      entReal:  lMes.filter(l => l.tipo === "ENTRADA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
      saiPrev:  lMes.filter(l => l.tipo === "SAIDA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      saiReal:  lMes.filter(l => l.tipo === "SAIDA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
      isFuturo: m.key > TODAY.slice(0, 7),
    };
  }), [lancFiltrados, simsAtivas, meses]);

  const dfcRows = useMemo(() => {
    const cats = new Map<string, { tipo: "ENTRADA" | "SAIDA"; mes: Record<string, number> }>();
    for (const l of lancFiltrados) {
      if (!cats.has(l.descricao)) cats.set(l.descricao, { tipo: l.tipo, mes: {} });
      const e = cats.get(l.descricao)!;
      e.mes[l.data.slice(0, 7)] = (e.mes[l.data.slice(0, 7)] ?? 0) + l.valor;
    }
    return Array.from(cats.entries()).map(([nome, v]) => ({ nome, ...v }));
  }, [lancFiltrados]);

  const totalEntradas = somasMes.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas   = somasMes.reduce((s, m) => s + m.saidas, 0);
  const saldoPeriodo  = totalEntradas - totalSaidas;

  // ── Gerenciar simulações ──
  const abrirEditar = (s: Simulacao) => {
    setEditandoId(s.id);
    setForm({ tipo: s.tipo, descricao: s.descricao, referencia: s.referencia, data: s.data, valor: String(s.valor) });
  };

  const salvarForm = () => {
    if (!form.descricao || !form.valor || !form.data) return;
    const valor = Number(form.valor);
    if (editandoId) {
      setSimulacoes(p => p.map(s => s.id === editandoId ? { ...s, ...form, valor } : s));
      setEditandoId(null);
    } else {
      setSimulacoes(p => [...p, { id: crypto.randomUUID(), ...form, valor, ativa: true }]);
    }
    setForm(FORM_VAZIO);
  };

  const cancelarEdicao = () => { setEditandoId(null); setForm(FORM_VAZIO); };

  const toggleSim = (id: string) => setSimulacoes(p => p.map(s => s.id === id ? { ...s, ativa: !s.ativa } : s));
  const excluirSim = (id: string) => { setSimulacoes(p => p.filter(s => s.id !== id)); if (editandoId === id) cancelarEdicao(); };
  const desativarTodas = () => setSimulacoes(p => p.map(s => ({ ...s, ativa: false })));
  const limparTudo = () => { setSimulacoes([]); cancelarEdicao(); };

  const impactoEntradas = simulacoes.filter(s => s.ativa && s.tipo === "ENTRADA").reduce((s, x) => s + x.valor, 0);
  const impactoSaidas   = simulacoes.filter(s => s.ativa && s.tipo === "SAIDA").reduce((s, x) => s + x.valor, 0);
  const qtdAtivas = simulacoes.filter(s => s.ativa).length;

  const pct = (real: number, prev: number) => prev === 0 ? null : ((real - prev) / Math.abs(prev)) * 100;
  const fmtPct = (v: number | null) => {
    if (v === null) return null;
    const cor = Math.abs(v) < 5 ? "text-green-600" : v < 0 ? "text-destructive" : "text-amber-600";
    return <span className={`text-[10px] font-medium ${cor}`}>{v > 0 ? "+" : ""}{v.toFixed(0)}%</span>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Fluxo de Caixa</h1>
      </div>

      {/* Filtro de período */}
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

      {/* Toolbar — tipo + simulações */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
        {([["ambos","Ambos"],["previsto","Previsto"],["realizado","Realizado"]] as [TipoFiltro, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTipoFiltro(k)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors
              ${tipoFiltro === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <button
          onClick={() => setSimVisiveis(!simVisiveis)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors
            ${simVisiveis && simulacoes.length > 0
              ? "bg-amber-50 border-amber-400 text-amber-700"
              : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
        >
          {simVisiveis && qtdAtivas > 0 ? "✓ " : ""}Simulações
        </button>
        <Button
          size="sm" variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={() => setModalGerenciar(true)}
        >
          <Settings2 className="size-3" />
          Gerenciar{simulacoes.length > 0 && ` (${simulacoes.length})`}
        </Button>
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
            <div className="flex items-center gap-1 px-4">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDiasExp(new Set(diasOrdenados))}>Expandir tudo</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDiasExp(new Set())}>Recolher</Button>
            </div>
          )}
        </div>

        {/* ─── DIA A DIA ─────────────────────────────────── */}
        {vista === "dia" && (
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
                    const lDia = lancFiltrados.filter(l => l.data === dia);
                    const sDia = simsAtivas.filter(s => s.data === dia);
                    const cr  = lDia.filter(l => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
                    const cp  = lDia.filter(l => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
                    const simE = sDia.filter(s => s.tipo === "ENTRADA").reduce((s, x) => s + x.valor, 0);
                    const simS = sDia.filter(s => s.tipo === "SAIDA").reduce((s, x) => s + x.valor, 0);
                    const simLiq = simE - simS;
                    const saldoDia = cr - cp + simLiq;
                    acum += saldoDia;
                    const acumulado = acum;
                    const exp = diasExp.has(dia);
                    const temEventos = lDia.length > 0 || sDia.length > 0;
                    const isHoje = dia === TODAY;

                    return (
                      <>
                        <tr
                          key={`r-${dia}`}
                          className={`border-b cursor-pointer transition-colors
                            ${isHoje ? "bg-primary/5 border-l-2 border-l-primary" : ""}
                            ${exp ? "bg-muted/20" : "hover:bg-muted/30"}`}
                          onClick={() => temEventos && toggleDia(dia)}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {temEventos
                                ? (exp ? <ChevronDown className="size-3 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3 text-muted-foreground shrink-0" />)
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
                          <td className={`text-right px-3 py-2 text-sm font-medium w-24 ${simLiq !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {simLiq !== 0 ? `${simLiq > 0 ? "+" : "−"} ${fmtBRL(Math.abs(simLiq))}` : "—"}
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
                                    <Badge variant={l.tipo === "ENTRADA" ? "default" : "destructive"} className="text-[10px] h-4 px-1">
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
                                    {s.referencia && <span className="text-muted-foreground shrink-0">{s.referencia}</span>}
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
        )}

        {/* ─── DFC MENSAL ─────────────────────────────────── */}
        {vista === "mensal" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 500 }}>
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground border-b sticky left-0 bg-muted/50 z-10 min-w-[200px]">Conta / Descrição</th>
                  {meses.map(m => (
                    <th key={m.key} className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b whitespace-nowrap min-w-[110px]">{m.label}</th>
                  ))}
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b whitespace-nowrap w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-primary">
                  <td className="px-4 py-2 text-xs font-bold text-primary-foreground sticky left-0 bg-primary z-10">▲ ENTRADAS (CR)</td>
                  {somasMes.map(m => (
                    <td key={m.key} className="text-right px-3 py-2 text-xs font-bold text-primary-foreground">
                      {m.entradas > 0 ? fmtBRL(m.entradas) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 text-xs font-bold text-primary-foreground">{fmtBRL(totalEntradas)}</td>
                </tr>
                {dfcRows.filter(r => r.tipo === "ENTRADA").map(row => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-1.5 text-xs pl-8 sticky left-0 bg-card z-10 truncate max-w-[200px]" title={row.nome}>{row.nome}</td>
                      {meses.map(m => {
                        const v = row.mes[m.key] ?? 0;
                        return <td key={m.key} className={`text-right px-3 py-1.5 text-xs ${v > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>{v > 0 ? fmtBRL(v) : "—"}</td>;
                      })}
                      <td className={`text-right px-3 py-1.5 text-xs font-medium ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>{total > 0 ? fmtBRL(total) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-destructive/80">
                  <td className="px-4 py-2 text-xs font-bold text-white sticky left-0 bg-destructive/80 z-10">▼ SAÍDAS (CP)</td>
                  {somasMes.map(m => (
                    <td key={m.key} className="text-right px-3 py-2 text-xs font-bold text-white">{m.saidas > 0 ? fmtBRL(m.saidas) : "—"}</td>
                  ))}
                  <td className="text-right px-3 py-2 text-xs font-bold text-white">{fmtBRL(totalSaidas)}</td>
                </tr>
                {dfcRows.filter(r => r.tipo === "SAIDA").map(row => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-1.5 text-xs pl-8 sticky left-0 bg-card z-10 truncate max-w-[200px]" title={row.nome}>{row.nome}</td>
                      {meses.map(m => {
                        const v = row.mes[m.key] ?? 0;
                        return <td key={m.key} className={`text-right px-3 py-1.5 text-xs ${v > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>{v > 0 ? fmtBRL(v) : "—"}</td>;
                      })}
                      <td className={`text-right px-3 py-1.5 text-xs font-medium ${total > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{total > 0 ? fmtBRL(total) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 bg-muted/30">
                  <td className="px-4 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10">= Diferença</td>
                  {somasMes.map(m => {
                    const d = m.entradas - m.saidas;
                    return <td key={m.key} className={`text-right px-3 py-2 text-xs font-semibold ${d > 0 ? "text-green-600" : d < 0 ? "text-destructive" : "text-muted-foreground"}`}>{d !== 0 ? fmtBRL(d) : "—"}</td>;
                  })}
                  <td className={`text-right px-3 py-2 text-xs font-bold ${saldoPeriodo >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtBRL(saldoPeriodo)}</td>
                </tr>
                {(() => {
                  let acum = saldoAnterior;
                  return (
                    <tr className="bg-primary">
                      <td className="px-4 py-2 text-xs font-bold text-primary-foreground sticky left-0 bg-primary z-10">Saldo Acumulado</td>
                      {somasMes.map(m => {
                        acum += m.entradas - m.saidas;
                        const v = acum;
                        return <td key={m.key} className={`text-right px-3 py-2 text-xs font-bold ${v >= 0 ? "text-blue-200" : "text-red-300"}`}>{fmtBRL(v)}</td>;
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
                        {m.label}{fut && <div className="text-[9px] font-normal">futuro</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-primary/5">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-primary tracking-wide border-b">▲ ENTRADAS (CR)</td>
                </tr>
                {(["entPrev","entReal"] as const).map(k => (
                  <tr key={k} className={`border-b ${k === "entReal" ? "border-b-2" : ""}`}>
                    <td className="px-4 py-2 text-xs sticky left-0 bg-card z-10 text-muted-foreground">{k === "entPrev" ? "Pendentes (previstas)" : "Realizadas"}</td>
                    {somasMes.map(m => {
                      const v = m[k];
                      return (
                        <td key={m.key} className={`text-right px-3 py-2 text-xs ${v > 0 ? "text-primary" : "text-muted-foreground"} ${k === "entReal" ? "font-semibold" : ""}`}>
                          {v > 0 ? fmtBRL(v) : "—"}
                          {k === "entReal" && !m.isFuturo && m.entPrev > 0 && <div>{fmtPct(pct(m.entReal, m.entPrev))}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-destructive/5">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-destructive tracking-wide border-b">▼ SAÍDAS (CP)</td>
                </tr>
                {(["saiPrev","saiReal"] as const).map(k => (
                  <tr key={k} className={`border-b ${k === "saiReal" ? "border-b-2" : ""}`}>
                    <td className="px-4 py-2 text-xs sticky left-0 bg-card z-10 text-muted-foreground">{k === "saiPrev" ? "Pendentes (previstas)" : "Realizadas"}</td>
                    {somasMes.map(m => {
                      const v = m[k];
                      return (
                        <td key={m.key} className={`text-right px-3 py-2 text-xs ${v > 0 ? "text-orange-600" : "text-muted-foreground"} ${k === "saiReal" ? "font-semibold" : ""}`}>
                          {v > 0 ? fmtBRL(v) : "—"}
                          {k === "saiReal" && !m.isFuturo && m.saiPrev > 0 && <div>{fmtPct(pct(m.saiReal, m.saiPrev))}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-muted/20">
                  <td colSpan={meses.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground tracking-wide border-b">⇄ SALDO DO PERÍODO</td>
                </tr>
                {(["saldoPrev","saldoReal"] as const).map(k => (
                  <tr key={k} className="border-b">
                    <td className="px-4 py-2 text-xs font-semibold sticky left-0 bg-card z-10">{k === "saldoPrev" ? "Saldo Previsto" : "Saldo Realizado"}</td>
                    {somasMes.map(m => {
                      const v = k === "saldoPrev" ? m.entPrev - m.saiPrev : m.entReal - m.saiReal;
                      return <td key={m.key} className={`text-right px-3 py-2 text-xs font-semibold ${v >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtBRL(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground px-4 py-3 border-t">
              Pendentes = lançamentos com vencimento no período não baixados · Realizados = baixados por data de pagamento · % = desvio realizado vs previsto
            </p>
          </div>
        )}
      </div>

      {/* ─── MODAL GERENCIAR SIMULAÇÕES ─────────────────── */}
      <Dialog open={modalGerenciar} onOpenChange={v => { if (!v) { setModalGerenciar(false); cancelarEdicao(); } }}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                Simulador de Cenários
                {simulacoes.length > 0 && (
                  <Badge className="text-xs">{simulacoes.length}</Badge>
                )}
              </DialogTitle>
              <div className="flex gap-2">
                {qtdAtivas > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={desativarTodas}>
                    Desativar todas
                  </Button>
                )}
                {simulacoes.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={limparTudo}>
                    Limpar tudo
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Formulário inline */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <p className="text-xs font-semibold text-primary">
              {editandoId ? "Editando simulação" : "+ Nova simulação"}
            </p>
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Recebimento Bunge"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor / Pagador</Label>
                <Input
                  value={form.referencia}
                  onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="Empresa ou pessoa"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.valor}
                  onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                  placeholder="0,00"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v as "ENTRADA" | "SAIDA" }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SAIDA">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1 self-end">
                <Button
                  className="h-9 px-5"
                  disabled={!form.descricao || !form.valor}
                  onClick={salvarForm}
                >
                  {editandoId ? "Salvar" : "+ Adicionar"}
                </Button>
                {editandoId && (
                  <Button variant="outline" className="h-9" onClick={cancelarEdicao}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Lista */}
          {simulacoes.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-10 px-3 py-2 border-b" />
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Data</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Fornecedor</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Descrição</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Tipo</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Valor</th>
                    <th className="w-16 border-b" />
                  </tr>
                </thead>
                <tbody>
                  {simulacoes.map((s, i) => (
                    <tr
                      key={s.id}
                      className={`border-b last:border-0 transition-colors
                        ${!s.ativa ? "opacity-50" : ""}
                        ${editandoId === s.id ? "bg-primary/5" : i % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={s.ativa}
                          onCheckedChange={() => toggleSim(s.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtData(s.data)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.referencia || "—"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{s.descricao}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={s.tipo === "ENTRADA" ? "default" : "destructive"}
                          className="text-[10px] px-2"
                        >
                          {s.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                      <td className={`px-3 py-2 text-xs font-semibold text-right ${s.tipo === "ENTRADA" ? "text-primary" : "text-orange-600"}`}>
                        {s.tipo === "ENTRADA" ? "+" : "−"} {fmtBRL(s.valor)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                            onClick={() => abrirEditar(s)}
                            title="Editar"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                            onClick={() => excluirSim(s.id)}
                            title="Excluir"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma simulação cadastrada ainda.</p>
          )}

          {/* Impacto */}
          {qtdAtivas > 0 && (
            <div className="flex items-center gap-3 text-sm border-t pt-3">
              <span className="text-muted-foreground font-medium">Impacto ({qtdAtivas} ativa{qtdAtivas > 1 ? "s" : ""}):</span>
              {impactoEntradas > 0 && <span className="text-primary font-semibold">+ {fmtBRL(impactoEntradas)}</span>}
              {impactoSaidas   > 0 && <span className="text-orange-600 font-semibold">− {fmtBRL(impactoSaidas)}</span>}
              <span className="font-bold">
                Líquido:{" "}
                <span className={impactoEntradas - impactoSaidas >= 0 ? "text-green-600" : "text-destructive"}>
                  {fmtBRL(impactoEntradas - impactoSaidas)}
                </span>
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
