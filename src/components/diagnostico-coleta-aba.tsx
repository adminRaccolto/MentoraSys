"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, CheckCircle, Clock, Eye, RefreshCw, Copy, BarChart3, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { criarAplicacaoDiagnostico, marcarDiagnosticoEnviado } from "@/actions/diagnostico-coleta";
import type { RespostasDiagnostico } from "@/actions/diagnostico-coleta";
import { MomentoDiagnostico, StatusAplicacaoDiagnostico } from "@/lib/generated/prisma";

// ─── tipos ────────────────────────────────────────────────────────────────────

type Aplicacao = {
  id: string;
  momento: MomentoDiagnostico;
  status: StatusAplicacaoDiagnostico;
  token: string;
  enviado_em: Date | null;
  respondido_em: Date | null;
  respostas: unknown;
};

interface Props {
  projetoId: string;
  aplicacoesIniciais: Aplicacao[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOMENTOS: { value: MomentoDiagnostico; label: string; descricao: string }[] = [
  { value: "PONTO_A", label: "Ponto A", descricao: "Perfil Inicial — início do projeto" },
  { value: "PONTO_B", label: "Ponto B", descricao: "Acompanhamento intermediário" },
  { value: "PONTO_C", label: "Ponto C", descricao: "Avaliação Final — encerramento" },
];

const STATUS_CFG: Record<StatusAplicacaoDiagnostico, { label: string; cor: string; icon: React.ReactNode }> = {
  PENDENTE:   { label: "Não criado",  cor: "bg-slate-100 text-slate-600", icon: <Clock className="size-3.5" /> },
  ENVIADO:    { label: "Enviado",     cor: "bg-yellow-100 text-yellow-700", icon: <Send className="size-3.5" /> },
  RESPONDIDO: { label: "Respondido",  cor: "bg-green-100 text-green-700", icon: <CheckCircle className="size-3.5" /> },
};

function fmt(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Visualizador de respostas ────────────────────────────────────────────────

function RespostasViewer({ respostas, momento }: { respostas: RespostasDiagnostico; momento: string }) {
  return (
    <div className="space-y-5 text-sm">
      {/* Fazendas */}
      {respostas.fazendas?.map((f, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="bg-primary/10 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-wide">
            Fazenda {i + 1} — {f.nome || "Sem nome"}
          </div>
          <div className="p-4 grid grid-cols-2 gap-3 text-sm">
            {f.area_arrendada != null && <div><span className="text-muted-foreground">Área Arrendada:</span> {f.area_arrendada} ha</div>}
            {f.valor_arrendamento != null && <div><span className="text-muted-foreground">Arrendamento:</span> {f.valor_arrendamento} {f.tipo_arrendamento}</div>}
            {f.area_plantio_propria != null && <div><span className="text-muted-foreground">Plantio Próprio:</span> {f.area_plantio_propria} ha</div>}
            {f.funcionarios_fixos != null && <div><span className="text-muted-foreground">Funcionários:</span> {f.funcionarios_fixos}</div>}
            {f.operacoes_terceirizadas?.length > 0 && <div className="col-span-2"><span className="text-muted-foreground">Terceirizadas:</span> {f.operacoes_terceirizadas.join(", ")}</div>}
            {f.culturas?.length > 0 && (
              <div className="col-span-2">
                <p className="text-muted-foreground mb-2">Culturas:</p>
                <table className="w-full text-xs border rounded">
                  <thead className="bg-muted/50"><tr>
                    <th className="px-2 py-1 text-left">Cultura</th>
                    <th className="px-2 py-1 text-right">Produt. Média</th>
                    <th className="px-2 py-1 text-right">Área Últ. Safra</th>
                  </tr></thead>
                  <tbody>{f.culturas.map((c, j) => (
                    <tr key={j} className={j % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-2 py-1 font-medium">{c.nome}</td>
                      <td className="px-2 py-1 text-right">{c.produtividade_media ?? "—"} sc/ha</td>
                      <td className="px-2 py-1 text-right">{c.area_ultima_safra ?? "—"} ha</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Custos */}
      {respostas.custos_por_cultura?.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-primary/10 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-wide">Custo por Hectare</div>
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr>
              <th className="px-3 py-2 text-left">Cultura</th>
              <th className="px-3 py-2 text-right">Insumos (sc/ha)</th>
              <th className="px-3 py-2 text-right">Operação (sc/ha)</th>
            </tr></thead>
            <tbody>{respostas.custos_por_cultura.map((c, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                <td className="px-3 py-2 font-medium">{c.cultura}</td>
                <td className="px-3 py-2 text-right">{c.insumos_sc_ha ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.operacao_sc_ha ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Financeiro */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-primary/10 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-wide">Financeiro e Administrativo</div>
        <div className="p-4 space-y-2">
          {[
            ["Fluxo de Caixa", respostas.fluxo_caixa_meses],
            ["Financiamento de Insumo", respostas.financiamento_insumo],
            ["Captação Safra", respostas.captacao_safra],
            ["Margem Custo Financeiro", respostas.margem_custo_financeiro],
            ["Renegociou Dívidas", respostas.renegociou_dividas],
            ["Sistema de Gestão", respostas.sistema_gestao],
            respostas.nome_sistema ? ["Nome do Sistema", respostas.nome_sistema] : null,
            respostas.confia_sistema ? ["Confia no Sistema", respostas.confia_sistema] : null,
          ].filter((x): x is string[] => x !== null).map(([label, valor], i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground min-w-0 shrink-0 w-48">{label}:</span>
              <span className="font-medium">{valor || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modelo de trabalho */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-primary/10 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-wide">Modelo de Trabalho</div>
        <div className="p-4 space-y-2">
          {[
            ["Executor Financeiro", respostas.executor_tarefas_admin],
            ["Comprador de Insumos", respostas.comprador_insumos?.join(", ")],
            ["Decisão de Compras", respostas.decisao_compras],
          ].map(([label, valor], i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground min-w-0 shrink-0 w-48">{label}:</span>
              <span className="font-medium">{valor || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Comparação A vs B vs C ───────────────────────────────────────────────────

function ComparacaoDiagnosticos({ aplicacoes }: { aplicacoes: Aplicacao[] }) {
  const respondidas = MOMENTOS
    .map(m => ({ ...m, aplic: aplicacoes.find(a => a.momento === m.value && a.status === "RESPONDIDO") }))
    .filter(m => !!m.aplic);

  if (respondidas.length < 2) return null;

  const resps = respondidas.map(m => m.aplic!.respostas as RespostasDiagnostico);

  // Campos de comparação financeira/administrativa
  const camposComparacao: { label: string; campo: keyof RespostasDiagnostico }[] = [
    { label: "Fluxo de Caixa", campo: "fluxo_caixa_meses" },
    { label: "Financiamento Insumo", campo: "financiamento_insumo" },
    { label: "Captação Safra", campo: "captacao_safra" },
    { label: "Margem Custo Financeiro", campo: "margem_custo_financeiro" },
    { label: "Renegociou Dívidas", campo: "renegociou_dividas" },
    { label: "Sistema de Gestão", campo: "sistema_gestao" },
    { label: "Confia no Sistema", campo: "confia_sistema" },
    { label: "Executor Financeiro", campo: "executor_tarefas_admin" },
    { label: "Decisão de Compras", campo: "decisao_compras" },
  ];

  const mudou = (campo: keyof RespostasDiagnostico) => {
    const vals = resps.map(r => String(r[campo] ?? ""));
    return new Set(vals).size > 1;
  };

  // Culturas únicas de todos os momentos
  const todasCulturas = Array.from(new Set(resps.flatMap(r => r.fazendas?.flatMap(f => f.culturas?.map(c => c.nome) ?? []) ?? [])));

  return (
    <div className="border-2 border-primary/20 rounded-2xl overflow-hidden">
      <div className="bg-primary/10 px-6 py-4 flex items-center gap-3">
        <BarChart3 className="size-5 text-primary" />
        <div>
          <h3 className="font-bold text-primary">Comparação — Evolução do Cliente</h3>
          <p className="text-xs text-muted-foreground">Mudanças destacadas em amarelo</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-52">Indicador</th>
              {respondidas.map(m => (
                <th key={m.value} className="px-4 py-3 text-center font-semibold text-primary">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Respostas gerais */}
            {camposComparacao.map(({ label, campo }) => {
              const alterou = mudou(campo);
              return (
                <tr key={campo} className={alterou ? "bg-yellow-50" : "bg-white even:bg-muted/20"}>
                  <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    {alterou && <span className="inline-block size-1.5 rounded-full bg-yellow-500 mr-1.5 align-middle" />}
                    {label}
                  </td>
                  {resps.map((r, i) => (
                    <td key={i} className="px-4 py-2.5 text-center text-xs">{String(r[campo] ?? "—")}</td>
                  ))}
                </tr>
              );
            })}

            {/* Custos por cultura */}
            {todasCulturas.length > 0 && (
              <>
                <tr className="bg-primary/5">
                  <td colSpan={respondidas.length + 1} className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wide">
                    Custo por Hectare (sc/ha)
                  </td>
                </tr>
                {todasCulturas.map(cultura => (
                  <>
                    {(["insumos_sc_ha", "operacao_sc_ha"] as const).map(campo => {
                      const vals = resps.map(r => r.custos_por_cultura?.find(c => c.cultura === cultura)?.[campo] ?? null);
                      const alterou = new Set(vals.map(String)).size > 1;
                      return (
                        <tr key={`${cultura}-${campo}`} className={alterou ? "bg-yellow-50" : "bg-white"}>
                          <td className="px-4 py-2 text-xs text-muted-foreground pl-8">
                            {alterou && <span className="inline-block size-1.5 rounded-full bg-yellow-500 mr-1.5 align-middle" />}
                            {cultura} — {campo === "insumos_sc_ha" ? "Insumos" : "Operação"}
                          </td>
                          {vals.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-center text-xs">{v ?? "—"}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </>
                ))}
              </>
            )}

            {/* Áreas das fazendas */}
            <tr className="bg-primary/5">
              <td colSpan={respondidas.length + 1} className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wide">
                Área Operacional (ha)
              </td>
            </tr>
            {(["area_arrendada_total", "area_propria_total"] as const).map(campo => {
              const vals = resps.map(r => {
                const fazendas = r.fazendas ?? [];
                return campo === "area_arrendada_total"
                  ? fazendas.reduce((s, f) => s + (f.area_arrendada ?? 0), 0)
                  : fazendas.reduce((s, f) => s + (f.area_plantio_propria ?? 0), 0);
              });
              const alterou = new Set(vals).size > 1;
              return (
                <tr key={campo} className={alterou ? "bg-yellow-50" : "bg-white"}>
                  <td className="px-4 py-2 text-xs text-muted-foreground pl-8">
                    {alterou && <span className="inline-block size-1.5 rounded-full bg-yellow-500 mr-1.5 align-middle" />}
                    {campo === "area_arrendada_total" ? "Área Arrendada Total" : "Área de Plantio Própria Total"}
                  </td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-4 py-2 text-center text-xs">{v > 0 ? `${v} ha` : "—"}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function DiagnosticoColetaAba({ projetoId, aplicacoesIniciais }: Props) {
  const [aplicacoes, setAplicacoes] = useState(aplicacoesIniciais);
  const [isPending, startTransition] = useTransition();
  const [visualizando, setVisualizando] = useState<string | null>(null);

  const getAplicacao = (momento: MomentoDiagnostico) =>
    aplicacoes.find(a => a.momento === momento);

  const criarEAbrir = (momento: MomentoDiagnostico) => {
    startTransition(async () => {
      try {
        const res = await criarAplicacaoDiagnostico(projetoId, momento);
        setAplicacoes(prev => [...prev, res.aplicacao as Aplicacao]);
        const url = `${window.location.origin}/diagnostico/${res.aplicacao.token}`;
        navigator.clipboard.writeText(url);
        toast.success("Diagnóstico criado! Link copiado para a área de transferência.");
      } catch { toast.error("Erro ao criar diagnóstico"); }
    });
  };

  const marcarEnviado = (aplicacaoId: string) => {
    startTransition(async () => {
      try {
        const res = await marcarDiagnosticoEnviado(aplicacaoId);
        setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, ...res.aplicacao } as Aplicacao : a));
        toast.success("Marcado como enviado");
      } catch { toast.error("Erro ao atualizar"); }
    });
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/diagnostico/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const todasRespondidas = aplicacoes.filter(a => a.status === "RESPONDIDO").length === 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileQuestion className="size-5 text-primary" />
          <h2 className="font-semibold">Diagnóstico de Coleta — Perfil do Cliente</h2>
        </div>
        {todasRespondidas && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <BarChart3 className="size-3 mr-1" /> 3/3 respondidos — comparação disponível
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOMENTOS.map(({ value, label, descricao }) => {
          const aplic = getAplicacao(value);
          const cfg = aplic ? STATUS_CFG[aplic.status] : STATUS_CFG.PENDENTE;

          return (
            <div key={value} className="border rounded-xl p-5 space-y-4 bg-background hover:shadow-md transition-shadow">
              {/* cabeçalho */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-base">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.cor}`}>
                  {cfg.icon}{cfg.label}
                </span>
              </div>

              {/* timestamps */}
              {aplic?.enviado_em && (
                <p className="text-xs text-muted-foreground">Enviado: {fmt(aplic.enviado_em)}</p>
              )}
              {aplic?.respondido_em && (
                <p className="text-xs text-green-700 font-medium">Respondido: {fmt(aplic.respondido_em)}</p>
              )}

              {/* ações */}
              <div className="space-y-2">
                {!aplic && (
                  <Button size="sm" className="w-full" onClick={() => criarEAbrir(value)} disabled={isPending}>
                    <Send className="size-3.5 mr-1.5" /> Criar e copiar link
                  </Button>
                )}

                {aplic && aplic.status !== "RESPONDIDO" && (
                  <>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => copiarLink(aplic.token)}>
                      <Copy className="size-3.5 mr-1.5" /> Copiar link
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="w-full text-xs text-muted-foreground"
                      onClick={() => window.open(`/diagnostico/${aplic.token}`, "_blank")}
                    >
                      <Eye className="size-3.5 mr-1.5" /> Pré-visualizar formulário
                    </Button>
                    {aplic.status === "PENDENTE" && (
                      <Button size="sm" variant="ghost" className="w-full text-xs text-yellow-700"
                        onClick={() => marcarEnviado(aplic.id)} disabled={isPending}>
                        <RefreshCw className="size-3.5 mr-1.5" /> Marcar como enviado
                      </Button>
                    )}
                  </>
                )}

                {aplic?.status === "RESPONDIDO" && (
                  <Button size="sm" variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setVisualizando(visualizando === aplic.id ? null : aplic.id)}>
                    <Eye className="size-3.5 mr-1.5" />
                    {visualizando === aplic.id ? "Fechar respostas" : "Ver respostas"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Respostas expandidas */}
      {aplicacoes.filter(a => a.status === "RESPONDIDO" && visualizando === a.id).map(aplic => (
        <div key={aplic.id} className="border rounded-xl p-6 space-y-4 bg-background">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-semibold">
              Respostas — {MOMENTOS.find(m => m.value === aplic.momento)?.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {fmt(aplic.respondido_em)}
              </span>
            </h3>
            <button onClick={() => setVisualizando(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <RespostasViewer respostas={aplic.respostas as RespostasDiagnostico} momento={aplic.momento} />
        </div>
      ))}

      {/* Comparação quando todas respondidas */}
      {todasRespondidas && <ComparacaoDiagnosticos aplicacoes={aplicacoes} />}
    </div>
  );
}
