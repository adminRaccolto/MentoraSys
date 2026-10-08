import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { buscarFluxoCaixa } from "@/lib/fluxo-caixa-query";
import FluxoCaixaPrintToolbar from "./print-button";

type Vista = "dia" | "mensal" | "prevreal";
type TipoFiltro = "ambos" | "previsto" | "realizado";

type Props = {
  searchParams: Promise<{ de?: string; ate?: string; vista?: string; tipo?: string }>;
};

const NOMES_MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const TIPO_LABEL: Record<TipoFiltro, string> = { ambos: "Previsto e Realizado", previsto: "Previsto", realizado: "Realizado" };
const VISTA_LABEL: Record<Vista, string> = { dia: "Dia a Dia", mensal: "DFC Mensal", prevreal: "Previsto × Realizado" };

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function FluxoCaixaPrintPage({ searchParams }: Props) {
  const sp = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const de = sp.de ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ate = sp.ate ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
  const vista: Vista = sp.vista === "dia" || sp.vista === "prevreal" ? sp.vista : "mensal";
  const tipoFiltro: TipoFiltro = sp.tipo === "previsto" || sp.tipo === "realizado" ? sp.tipo : "ambos";

  const inicio = new Date(`${de}T00:00:00`);
  const fim = new Date(`${ate}T23:59:59`);

  const [{ lancamentos, saldoAnterior }, empresa] = await Promise.all([
    buscarFluxoCaixa(empresaId, inicio, fim),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { nome: true, cnpj: true, logo_url: true } }),
  ]);
  if (!empresa) notFound();

  const lancFiltrados = lancamentos.filter((l) => {
    if (tipoFiltro === "previsto") return l.projetado;
    if (tipoFiltro === "realizado") return !l.projetado;
    return true;
  });

  const meses: { label: string; key: string }[] = [];
  {
    const cur = new Date(`${de}T00:00:00`);
    cur.setDate(1);
    const fimMes = new Date(`${ate}T00:00:00`);
    while (cur <= fimMes) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      meses.push({ label: `${NOMES_MES[m]}/${String(y).slice(2)}`, key: `${y}-${String(m + 1).padStart(2, "0")}` });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const somasMes = meses.map((m) => {
    const lMes = lancFiltrados.filter((l) => l.data.startsWith(m.key));
    return {
      key: m.key, label: m.label,
      entradas: lMes.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0),
      saidas: lMes.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0),
      entPrev: lMes.filter((l) => l.tipo === "ENTRADA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      entReal: lMes.filter((l) => l.tipo === "ENTRADA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
      saiPrev: lMes.filter((l) => l.tipo === "SAIDA" && l.projetado).reduce((s, l) => s + l.valor, 0),
      saiReal: lMes.filter((l) => l.tipo === "SAIDA" && !l.projetado).reduce((s, l) => s + l.valor, 0),
    };
  });

  // Entradas agrupadas por cliente; saídas por plano de contas (categoria de despesa)
  const dfcRows = (() => {
    const cats = new Map<string, { tipo: "ENTRADA" | "SAIDA"; nome: string; mes: Record<string, number> }>();
    for (const l of lancFiltrados) {
      const nome = l.tipo === "ENTRADA" ? l.referencia : l.descricao;
      const chave = `${l.tipo}:${nome}`;
      if (!cats.has(chave)) cats.set(chave, { tipo: l.tipo, nome, mes: {} });
      const e = cats.get(chave)!;
      e.mes[l.data.slice(0, 7)] = (e.mes[l.data.slice(0, 7)] ?? 0) + l.valor;
    }
    return Array.from(cats.values());
  })();

  const totalEntradas = somasMes.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = somasMes.reduce((s, m) => s + m.saidas, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  const diasOrdenados = [...new Set(lancFiltrados.map((l) => l.data))]
    .filter((d) => d >= de && d <= ate)
    .sort();

  const largo = vista !== "dia";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`@page { size: ${largo ? "A4 landscape" : "A4"}; margin: 12mm; }`}</style>
      <FluxoCaixaPrintToolbar title={`Fluxo de Caixa — ${VISTA_LABEL[vista]}`} />

      <div className={`${largo ? "max-w-[1200px]" : "max-w-[900px]"} mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none`}>
        <div className="p-10 print:p-8 space-y-6">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b-2 border-[#1B4F72]">
            <div className="flex-1">
              {empresa.logo_url && (
                <div className="mb-3">
                  <Image src={empresa.logo_url} alt={empresa.nome} width={160} height={60}
                    className="object-contain max-h-14 max-w-40" unoptimized />
                </div>
              )}
              <p className="text-lg font-bold text-[#1B4F72] leading-tight">{empresa.nome}</p>
              {empresa.cnpj && <p className="text-sm text-slate-500">CNPJ: {empresa.cnpj}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tracking-tight text-[#1B4F72]">FLUXO DE CAIXA</p>
              <p className="text-lg font-semibold text-slate-500 mt-1">{VISTA_LABEL[vista]}</p>
              <div className="mt-2 text-sm text-slate-600">
                <p>Período: {fmtData(de)} a {fmtData(ate)}</p>
                <p>Tipo: {TIPO_LABEL[tipoFiltro]}</p>
                <p>Emissão: {fmtData(new Date().toISOString().split("T")[0])}</p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Entradas</p>
              <p className="text-xl font-bold text-[#1B4F72]">{fmtBRL(totalEntradas)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Saídas</p>
              <p className="text-xl font-bold text-orange-600">{fmtBRL(totalSaidas)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Saldo do Período</p>
              <p className={`text-xl font-bold ${saldoPeriodo >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtBRL(saldoPeriodo)}</p>
            </div>
          </div>

          {/* ─── DFC MENSAL ─── */}
          {vista === "mensal" && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B4F72] text-white">
                  <th className="text-left px-3 py-2 font-medium min-w-[160px]">Conta / Descrição</th>
                  {meses.map((m) => <th key={m.key} className="text-right px-2 py-2 font-medium whitespace-nowrap">{m.label}</th>)}
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-100 font-bold">
                  <td className="px-3 py-1.5">▲ ENTRADAS (CR)</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1.5">{m.entradas > 0 ? fmtBRL(m.entradas) : "—"}</td>)}
                  <td className="text-right px-3 py-1.5">{fmtBRL(totalEntradas)}</td>
                </tr>
                {dfcRows.filter((r) => r.tipo === "ENTRADA").map((row) => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b border-slate-100">
                      <td className="px-3 py-1 pl-6 truncate max-w-[220px]">{row.nome}</td>
                      {meses.map((m) => {
                        const v = row.mes[m.key] ?? 0;
                        return <td key={m.key} className="text-right px-2 py-1 text-slate-700">{v > 0 ? fmtBRL(v) : "—"}</td>;
                      })}
                      <td className="text-right px-3 py-1 font-medium">{total > 0 ? fmtBRL(total) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-red-50 font-bold">
                  <td className="px-3 py-1.5">▼ SAÍDAS (CP)</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1.5">{m.saidas > 0 ? fmtBRL(m.saidas) : "—"}</td>)}
                  <td className="text-right px-3 py-1.5">{fmtBRL(totalSaidas)}</td>
                </tr>
                {dfcRows.filter((r) => r.tipo === "SAIDA").map((row) => {
                  const total = Object.values(row.mes).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row.nome} className="border-b border-slate-100">
                      <td className="px-3 py-1 pl-6 truncate max-w-[220px]">{row.nome}</td>
                      {meses.map((m) => {
                        const v = row.mes[m.key] ?? 0;
                        return <td key={m.key} className="text-right px-2 py-1 text-slate-700">{v > 0 ? fmtBRL(v) : "—"}</td>;
                      })}
                      <td className="text-right px-3 py-1 font-medium">{total > 0 ? fmtBRL(total) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="px-3 py-1.5">= Diferença</td>
                  {somasMes.map((m) => {
                    const d = m.entradas - m.saidas;
                    return <td key={m.key} className={`text-right px-2 py-1.5 ${d > 0 ? "text-green-700" : d < 0 ? "text-red-700" : ""}`}>{d !== 0 ? fmtBRL(d) : "—"}</td>;
                  })}
                  <td className={`text-right px-3 py-1.5 ${saldoPeriodo >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtBRL(saldoPeriodo)}</td>
                </tr>
                {(() => {
                  let acum = saldoAnterior;
                  return (
                    <tr className="bg-[#1B4F72] text-white font-bold">
                      <td className="px-3 py-1.5">Saldo Acumulado</td>
                      {somasMes.map((m) => { acum += m.entradas - m.saidas; return <td key={m.key} className="text-right px-2 py-1.5">{fmtBRL(acum)}</td>; })}
                      <td className="text-right px-3 py-1.5">{fmtBRL(acum)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          )}

          {/* ─── PREVISTO × REALIZADO ─── */}
          {vista === "prevreal" && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B4F72] text-white">
                  <th className="text-left px-3 py-2 font-medium min-w-[160px]">Linha</th>
                  {meses.map((m) => <th key={m.key} className="text-right px-2 py-2 font-medium whitespace-nowrap">{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-100"><td colSpan={meses.length + 1} className="px-3 py-1 font-bold">ENTRADAS (CR)</td></tr>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-1 pl-6">Pendentes (previstas)</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1">{m.entPrev > 0 ? fmtBRL(m.entPrev) : "—"}</td>)}
                </tr>
                <tr className="border-b-2 border-slate-200 font-semibold">
                  <td className="px-3 py-1 pl-6">Realizadas</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1">{m.entReal > 0 ? fmtBRL(m.entReal) : "—"}</td>)}
                </tr>
                <tr className="bg-red-50"><td colSpan={meses.length + 1} className="px-3 py-1 font-bold">SAÍDAS (CP)</td></tr>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-1 pl-6">Pendentes (previstas)</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1">{m.saiPrev > 0 ? fmtBRL(m.saiPrev) : "—"}</td>)}
                </tr>
                <tr className="border-b-2 border-slate-200 font-semibold">
                  <td className="px-3 py-1 pl-6">Realizadas</td>
                  {somasMes.map((m) => <td key={m.key} className="text-right px-2 py-1">{m.saiReal > 0 ? fmtBRL(m.saiReal) : "—"}</td>)}
                </tr>
                <tr className="font-bold">
                  <td className="px-3 py-1.5">Saldo Previsto</td>
                  {somasMes.map((m) => { const v = m.entPrev - m.saiPrev; return <td key={m.key} className={`text-right px-2 py-1.5 ${v >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtBRL(v)}</td>; })}
                </tr>
                <tr className="font-bold">
                  <td className="px-3 py-1.5">Saldo Realizado</td>
                  {somasMes.map((m) => { const v = m.entReal - m.saiReal; return <td key={m.key} className={`text-right px-2 py-1.5 ${v >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtBRL(v)}</td>; })}
                </tr>
              </tbody>
            </table>
          )}

          {/* ─── DIA A DIA ─── */}
          {vista === "dia" && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B4F72] text-white">
                  <th className="text-left px-3 py-2 font-medium">Data / Descrição</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Entradas</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Saídas</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Saldo dia</th>
                  <th className="text-right px-3 py-2 font-medium w-32">Saldo acum.</th>
                </tr>
              </thead>
              <tbody>
                {diasOrdenados.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">Nenhum lançamento neste período</td></tr>
                )}
                {(() => {
                  let acum = saldoAnterior;
                  return diasOrdenados.flatMap((dia) => {
                    const lDia = lancFiltrados.filter((l) => l.data === dia);
                    const cr = lDia.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
                    const cp = lDia.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
                    acum += cr - cp;
                    const acumulado = acum;
                    return [
                      <tr key={`r-${dia}`} className="bg-slate-50 border-b border-slate-200 font-semibold">
                        <td className="px-3 py-1">{fmtData(dia)}</td>
                        <td className="text-right px-3 py-1 text-[#1B4F72]">{cr > 0 ? fmtBRL(cr) : "—"}</td>
                        <td className="text-right px-3 py-1 text-orange-600">{cp > 0 ? fmtBRL(cp) : "—"}</td>
                        <td className="text-right px-3 py-1">{fmtBRL(cr - cp)}</td>
                        <td className={`text-right px-3 py-1 ${acumulado >= 0 ? "text-[#1B4F72]" : "text-red-700"}`}>{fmtBRL(acumulado)}</td>
                      </tr>,
                      ...lDia.map((l) => (
                        <tr key={l.id} className="border-b border-slate-100 text-slate-600">
                          <td className="px-3 py-1 pl-7">
                            {l.descricao} <span className="text-slate-400">— {l.referencia}</span>
                            {l.projetado && <span className="italic text-slate-400"> (previsto)</span>}
                          </td>
                          <td className="text-right px-3 py-1">{l.tipo === "ENTRADA" ? fmtBRL(l.valor) : ""}</td>
                          <td className="text-right px-3 py-1">{l.tipo === "SAIDA" ? fmtBRL(l.valor) : ""}</td>
                          <td /><td />
                        </tr>
                      )),
                    ];
                  });
                })()}
              </tbody>
            </table>
          )}

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p>{empresa.nome}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
