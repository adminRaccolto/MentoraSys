"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Printer, GripVertical, ArrowRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarConteudo } from "@/actions/diagnosticos";

interface Etapa {
  id: string;
  nome: string;
  descricao: string;
  responsavel: string;
  tipo: "PROCESSO" | "DECISAO" | "INICIO" | "FIM" | "DOCUMENTO" | "SUBPROCESSO" | "TAREFA";
  cor: string;
}

interface MapaProcessoConteudo { etapas: Etapa[]; titulo_processo: string; }

interface Props {
  id: string; titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const uuid = () => Math.random().toString(36).slice(2, 10);

const TIPOS = [
  { value: "INICIO",      label: "Início",       cor: "bg-green-500",  shape: "rounded-full px-4 py-2" },
  { value: "PROCESSO",    label: "Processo",     cor: "bg-blue-500",   shape: "rounded px-4 py-2" },
  { value: "SUBPROCESSO", label: "Subprocesso",  cor: "bg-indigo-500", shape: "rounded px-4 py-2 border-b-2 border-white/50" },
  { value: "TAREFA",      label: "Tarefa",       cor: "bg-teal-500",   shape: "rounded px-4 py-2" },
  { value: "DECISAO",     label: "Decisão",      cor: "bg-amber-500",  shape: "rounded px-4 py-2" },
  { value: "DOCUMENTO",   label: "Documento",    cor: "bg-purple-500", shape: "rounded px-4 py-2" },
  { value: "FIM",         label: "Fim",          cor: "bg-red-500",    shape: "rounded-full px-4 py-2" },
] as const;

type TipoEtapa = typeof TIPOS[number]["value"];

const NOVA_ETAPA: Omit<Etapa, "id"> = { nome: "", descricao: "", responsavel: "", tipo: "PROCESSO", cor: "#3b82f6" };

export default function EditorMapaProcesso({ id, titulo, conteudo, cliente }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tituloProcesso, setTituloProcesso] = useState(() => {
    const c = conteudo as Partial<MapaProcessoConteudo>;
    return c.titulo_processo ?? "";
  });
  const [etapas, setEtapas] = useState<Etapa[]>(() => {
    const c = conteudo as Partial<MapaProcessoConteudo>;
    return c.etapas ?? [
      { id: uuid(), nome: "Início", descricao: "", responsavel: "", tipo: "INICIO", cor: "" },
      { id: uuid(), nome: "", descricao: "", responsavel: "", tipo: "PROCESSO", cor: "" },
      { id: uuid(), nome: "Fim", descricao: "", responsavel: "", tipo: "FIM", cor: "" },
    ];
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addEtapa = () => setEtapas(prev => [...prev, { id: uuid(), ...NOVA_ETAPA }]);

  const updateEtapa = (idx: number, field: keyof Etapa, value: string) => {
    setEtapas(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const deleteEtapa = (idx: number) => setEtapas(prev => prev.filter((_, i) => i !== idx));

  const moveUp   = (idx: number) => { if (idx === 0) return; setEtapas(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; }); };
  const moveDown = (idx: number) => { if (idx === etapas.length - 1) return; setEtapas(prev => { const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await salvarConteudo(id, { titulo_processo: tituloProcesso, etapas });
      router.refresh();
    } finally { setSaving(false); }
  };

  const tipoConfig = (tipo: TipoEtapa) => TIPOS.find(t => t.value === tipo) ?? TIPOS[1];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/diagnosticos")}>
            <ArrowLeft className="size-4" />
          </Button>
          <GitBranch className="size-5 text-primary" />
          <div>
            <h1 className="font-semibold text-sm">{titulo}</h1>
            {cliente && <p className="text-xs text-muted-foreground">{cliente.nome}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1.5" /> Exportar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Título do processo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Título do processo</label>
          <Input value={tituloProcesso} onChange={e => setTituloProcesso(e.target.value)} placeholder="Ex.: Onboarding de cliente" className="max-w-md" />
        </div>

        {/* Preview do fluxo */}
        <div className="rounded-lg border bg-card p-6 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
            {etapas.map((etapa, idx) => {
              const cfg = tipoConfig(etapa.tipo);
              return (
                <div key={etapa.id} className="flex items-center gap-0">
                  <div className="flex flex-col items-center gap-1 w-28">
                    <div className={`${cfg.shape} ${cfg.cor} text-white text-xs font-medium text-center min-w-[80px] max-w-[112px]`}
                      style={{ wordBreak: "break-word" }}>
                      {etapa.nome || cfg.label}
                    </div>
                    {etapa.responsavel && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[112px]">{etapa.responsavel}</span>
                    )}
                  </div>
                  {idx < etapas.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor de etapas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Etapas do processo</h2>
            <Button size="sm" variant="outline" onClick={addEtapa}>
              <Plus className="size-3.5 mr-1.5" /> Adicionar etapa
            </Button>
          </div>

          {etapas.map((etapa, idx) => (
            <div key={etapa.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
              {/* Número */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <GripVertical className="size-3 rotate-90" />
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === etapas.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <GripVertical className="size-3 -rotate-90" />
                </button>
              </div>

              {/* Badge do tipo */}
              <div className="pt-1">
                <Badge className={`${tipoConfig(etapa.tipo).cor} text-white text-[10px] h-5 px-1.5`}>
                  {tipoConfig(etapa.tipo).label}
                </Badge>
              </div>

              {/* Campos */}
              <div className="flex-1 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                  value={etapa.nome}
                  onChange={e => updateEtapa(idx, "nome", e.target.value)}
                  placeholder="Nome da etapa"
                  className="h-8 text-sm"
                />
                <Input
                  value={etapa.responsavel}
                  onChange={e => updateEtapa(idx, "responsavel", e.target.value)}
                  placeholder="Responsável / setor"
                  className="h-8 text-sm"
                />
                <Select value={etapa.tipo} onValueChange={v => { if (v) updateEtapa(idx, "tipo", v); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => deleteEtapa(idx)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {etapas.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma etapa adicionada. Clique em "+ Adicionar etapa" para começar.</p>
          )}
        </div>

        {/* Campo de descrição geral */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Observações do processo</label>
          <Textarea placeholder="Notas, restrições, métricas de performance..." rows={3} className="resize-none" />
        </div>
      </div>
    </div>
  );
}
