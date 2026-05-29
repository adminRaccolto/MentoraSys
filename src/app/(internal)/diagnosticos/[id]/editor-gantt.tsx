"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Printer, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarConteudo } from "@/actions/diagnosticos";

interface TarefaGantt {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  responsavel: string;
  status: "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ATRASADO";
  grupo: string;
}

interface GanttConteudo { tarefas: TarefaGantt[]; }

interface Props {
  id: string; titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const uuid = () => Math.random().toString(36).slice(2, 10);
const hoje = new Date().toISOString().split("T")[0];
const em30 = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];

const STATUS_COR: Record<string, string> = {
  PLANEJADO: "bg-slate-400", EM_ANDAMENTO: "bg-blue-500",
  CONCLUIDO: "bg-green-500", ATRASADO: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  PLANEJADO: "Planejado", EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído", ATRASADO: "Atrasado",
};

function calcBars(tarefas: TarefaGantt[]) {
  if (tarefas.length === 0) return { inicio: hoje, totalDias: 30, barsData: [] };
  const datas = tarefas.flatMap(t => [t.inicio, t.fim]).filter(Boolean).sort();
  const inicioGlobal = datas[0];
  const fimGlobal = datas[datas.length - 1];
  const totalDias = Math.max(7, Math.ceil((new Date(fimGlobal).getTime() - new Date(inicioGlobal).getTime()) / 864e5) + 2);

  const barsData = tarefas.map(t => {
    if (!t.inicio || !t.fim) return { ...t, left: 0, width: 0 };
    const offsetDias = Math.max(0, Math.ceil((new Date(t.inicio).getTime() - new Date(inicioGlobal).getTime()) / 864e5));
    const duracaoDias = Math.max(1, Math.ceil((new Date(t.fim).getTime() - new Date(t.inicio).getTime()) / 864e5) + 1);
    return {
      ...t,
      left: (offsetDias / totalDias) * 100,
      width: (duracaoDias / totalDias) * 100,
    };
  });

  return { inicio: inicioGlobal, totalDias, barsData };
}

export default function EditorGantt({ id, titulo, conteudo, cliente }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaGantt[]>(() => {
    const c = conteudo as Partial<GanttConteudo>;
    return c.tarefas ?? [];
  });

  const addTarefa = () => setTarefas(prev => [...prev, { id: uuid(), nome: "", inicio: hoje, fim: em30, responsavel: "", status: "PLANEJADO", grupo: "" }]);
  const updateTarefa = (idx: number, field: keyof TarefaGantt, value: string) =>
    setTarefas(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  const deleteTarefa = (idx: number) => setTarefas(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try { await salvarConteudo(id, { tarefas }); router.refresh(); }
    finally { setSaving(false); }
  };

  const { inicio: inicioGlobal, barsData } = calcBars(tarefas);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/diagnosticos")}>
            <ArrowLeft className="size-4" />
          </Button>
          <CalendarDays className="size-5 text-primary" />
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

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Gráfico de Gantt */}
        {tarefas.length > 0 && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground">
              Cronograma — início em {new Date(inicioGlobal).toLocaleDateString("pt-BR")}
            </div>
            <div className="divide-y">
              {barsData.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2">
                  <div className="w-44 shrink-0">
                    <p className="text-xs font-medium truncate">{t.nome || "—"}</p>
                    {t.grupo && <p className="text-[10px] text-muted-foreground">{t.grupo}</p>}
                  </div>
                  <div className="flex-1 h-6 relative rounded bg-muted/30 overflow-hidden">
                    <div
                      className={`absolute h-full rounded ${STATUS_COR[t.status]} opacity-80 flex items-center px-1.5`}
                      style={{ left: `${t.left}%`, width: `${Math.max(t.width, 1)}%` }}
                    >
                      <span className="text-[10px] text-white font-medium truncate">{t.responsavel}</span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <span className="text-[10px] text-muted-foreground">{t.inicio && t.fim ? `${new Date(t.inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} → ${new Date(t.fim).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legenda */}
        {tarefas.length > 0 && (
          <div className="flex gap-3 flex-wrap text-xs">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded-sm ${STATUS_COR[k]}`} />
                {v}
              </div>
            ))}
          </div>
        )}

        {/* Editor de tarefas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tarefas / Atividades</h2>
            <Button size="sm" variant="outline" onClick={addTarefa}>
              <Plus className="size-3.5 mr-1.5" /> Adicionar tarefa
            </Button>
          </div>

          {tarefas.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma tarefa. Clique em "+ Adicionar tarefa" para começar.</p>
          )}

          {/* Header */}
          {tarefas.length > 0 && (
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-3 text-xs font-semibold text-muted-foreground">
              <span>Nome</span><span>Grupo / Fase</span><span>Início</span><span>Fim</span><span>Responsável</span><span />
            </div>
          )}

          {tarefas.map((t, idx) => (
            <div key={t.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center rounded-lg border bg-card p-3">
              <Input value={t.nome} onChange={e => updateTarefa(idx, "nome", e.target.value)} placeholder="Nome da tarefa" className="h-8 text-sm" />
              <Input value={t.grupo} onChange={e => updateTarefa(idx, "grupo", e.target.value)} placeholder="Fase/Grupo" className="h-8 text-sm" />
              <Input type="date" value={t.inicio} onChange={e => updateTarefa(idx, "inicio", e.target.value)} className="h-8 text-sm" />
              <Input type="date" value={t.fim} onChange={e => updateTarefa(idx, "fim", e.target.value)} className="h-8 text-sm" />
              <div className="flex gap-1">
                <Input value={t.responsavel} onChange={e => updateTarefa(idx, "responsavel", e.target.value)} placeholder="Responsável" className="h-8 text-sm" />
                <Select value={t.status} onValueChange={v => { if (v) updateTarefa(idx, "status", v); }}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COR[t.status]}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${STATUS_COR[k]}`} />
                          {v}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => deleteTarefa(idx)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
