"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, X, Plus, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { moverTarefa, criarTarefa, concluirTarefa, excluirTarefa } from "@/actions/tarefas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatusTarefa = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
type PrioridadeTarefa = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
type Responsavel = { id: string; nome: string };

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade?: PrioridadeTarefa;
  data_prazo: Date | null;
  concluida_em: Date | null;
  responsavel: Responsavel | null;
  responsaveis?: { usuario: Responsavel }[];
  etiquetas?: { etiqueta: { id: string; nome: string; cor: string } }[];
};

type Etapa = {
  id: string;
  titulo: string;
  status: string;
  tarefas: Tarefa[];
};

interface Props {
  projetoId: string;
  etapas: Etapa[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (etapas: any[]) => void;
  onAbrirTarefa: (tarefaId: string) => void;
}

// ─── Prioridade → borda esquerda colorida ─────────────────────────────────────

const PRIO_BORDER: Record<string, string> = {
  URGENTE: "border-l-red-500",
  ALTA:    "border-l-orange-400",
  MEDIA:   "border-l-sky-400",
  BAIXA:   "border-l-transparent",
};

// ─── Status da etapa → cor do ponto no cabeçalho ─────────────────────────────

const ETAPA_DOT: Record<string, string> = {
  PENDENTE:    "bg-slate-400",
  EM_ANDAMENTO:"bg-blue-500",
  CONCLUIDA:   "bg-emerald-500",
  CANCELADA:   "bg-red-400",
};

// ─── Avatar com iniciais ──────────────────────────────────────────────────────

function Avatar({ nome }: { nome: string }) {
  const iniciais = nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return (
    <div
      className="size-6 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 ring-2 ring-background"
      title={nome}
    >
      {iniciais}
    </div>
  );
}

// ─── Card de tarefa ───────────────────────────────────────────────────────────

function TarefaCard({
  tarefa, etapaId, isDragging, onToggle, onRemover, onAbrir,
}: {
  tarefa: Tarefa; etapaId: string;
  isDragging?: boolean;
  onToggle: (etapaId: string, tarefaId: string, concluida: boolean) => void;
  onRemover: (etapaId: string, tarefaId: string) => void;
  onAbrir: (tarefaId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver } =
    useSortable({ id: tarefa.id, data: { etapaId, type: "tarefa" } });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const concluida = tarefa.status === "CONCLUIDA";
  const vencida = tarefa.data_prazo && !concluida && new Date(tarefa.data_prazo) < new Date();
  const prioBorder = PRIO_BORDER[tarefa.prioridade ?? "BAIXA"] ?? "border-l-transparent";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-card rounded-xl border border-l-[3px] ${prioBorder}
        p-3 shadow-sm hover:shadow-md hover:-translate-y-px
        transition-all duration-150 cursor-pointer select-none
        ${isDragging ? "opacity-30 scale-[0.97]" : ""}
        ${isOver ? "ring-2 ring-primary/30 ring-offset-1" : ""}
      `}
      onClick={() => onAbrir(tarefa.id)}
    >
      {/* Etiquetas — barras coloridas estilo Trello */}
      {tarefa.etiquetas && tarefa.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {tarefa.etiquetas.map(({ etiqueta }) => (
            <span
              key={etiqueta.id}
              className="h-2 rounded-full min-w-[32px] max-w-[64px] flex-shrink-0"
              style={{ backgroundColor: etiqueta.cor }}
              title={etiqueta.nome}
            />
          ))}
        </div>
      )}

      {/* Linha principal: checkbox + título + drag handle + delete */}
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(etapaId, tarefa.id, !concluida); }}
          className={`
            mt-0.5 size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${concluida
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary"}
          `}
        >
          {concluida && <Check className="size-2.5" />}
        </button>

        {/* Título */}
        <p className={`flex-1 text-sm leading-snug ${
          concluida ? "line-through text-muted-foreground" : "font-medium text-foreground"
        }`}>
          {tarefa.titulo}
        </p>

        {/* Drag handle (hover) */}
        <button
          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0 mt-0.5 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <svg className="size-3.5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7" cy="5" r="1.5"/><circle cx="13" cy="5" r="1.5"/>
            <circle cx="7" cy="10" r="1.5"/><circle cx="13" cy="10" r="1.5"/>
            <circle cx="7" cy="15" r="1.5"/><circle cx="13" cy="15" r="1.5"/>
          </svg>
        </button>

        {/* Deletar */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemover(etapaId, tarefa.id); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-opacity shrink-0 mt-0.5"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Rodapé: prazo + responsáveis */}
      {(() => {
        const resps = tarefa.responsaveis?.length
          ? tarefa.responsaveis.map(r => r.usuario)
          : tarefa.responsavel ? [tarefa.responsavel] : [];
        return (tarefa.data_prazo || resps.length > 0) ? (
          <div className="flex items-center justify-between mt-2.5 pl-6 gap-2">
            {tarefa.data_prazo ? (
              <span className={`
                inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md font-medium leading-none
                ${vencida
                  ? "bg-red-100 text-red-600"
                  : concluida
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"}
              `}>
                <Clock className="size-3 shrink-0" />
                {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
            ) : <span />}

            {resps.length > 0 && (
              <div className="flex -space-x-1.5">
                {resps.slice(0, 3).map(r => <Avatar key={r.id} nome={r.nome} />)}
                {resps.length > 3 && (
                  <div className="size-6 rounded-full bg-muted border-2 border-background text-[9px] font-bold text-muted-foreground flex items-center justify-center">
                    +{resps.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Coluna Kanban ────────────────────────────────────────────────────────────

function EtapaColuna({
  etapa, draggingId, filtroResponsavelId, onToggle, onRemover, onAbrir, onNovaTarefa,
}: {
  etapa: Etapa; draggingId: string | null;
  filtroResponsavelId: string | null;
  onToggle: (etapaId: string, tarefaId: string, concluida: boolean) => void;
  onRemover: (etapaId: string, tarefaId: string) => void;
  onAbrir: (tarefaId: string) => void;
  onNovaTarefa: (etapaId: string, titulo: string) => void;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [titulo, setTitulo] = useState("");

  const { setNodeRef, isOver } = useSortable({
    id: `etapa-${etapa.id}`,
    data: { etapaId: etapa.id, type: "etapa" },
  });

  const salvar = () => {
    if (!titulo.trim()) return;
    onNovaTarefa(etapa.id, titulo.trim());
    setTitulo("");
    setAdicionando(false);
  };

  // Tarefas visíveis (filtradas) — SortableContext sempre usa o conjunto completo
  const tarefasVisiveis = filtroResponsavelId
    ? etapa.tarefas.filter((t) =>
        t.responsavel?.id === filtroResponsavelId ||
        t.responsaveis?.some(r => r.usuario.id === filtroResponsavelId)
      )
    : etapa.tarefas;

  const concluidas = tarefasVisiveis.filter((t) => t.status === "CONCLUIDA").length;
  const dotCor = ETAPA_DOT[etapa.status] ?? "bg-slate-400";

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col w-[272px] shrink-0 rounded-2xl
        bg-slate-100/90 border border-slate-200/60
        transition-all duration-150
        ${isOver ? "bg-primary/5 border-primary/30 ring-2 ring-primary/15" : ""}
      `}
    >
      {/* Cabeçalho da coluna */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
        <div className={`size-2.5 rounded-full shrink-0 ${dotCor}`} />
        <span className="font-semibold text-sm flex-1 truncate">{etapa.titulo}</span>
        <div className="flex items-center gap-1.5">
          {tarefasVisiveis.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {concluidas}/{tarefasVisiveis.length}
            </span>
          )}
          <span className="size-6 rounded-full bg-white/80 border border-slate-200 text-xs font-bold text-muted-foreground flex items-center justify-center">
            {tarefasVisiveis.length}
          </span>
        </div>
      </div>

      {/* Barra de progresso da coluna */}
      {tarefasVisiveis.length > 0 && (
        <div className="mx-4 mb-2 h-0.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((concluidas / etapa.tarefas.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Lista de cards — SortableContext sempre usa IDs completos para DnD funcionar */}
      <div className="flex-1 px-2 pb-1 space-y-2 min-h-[48px]">
        <SortableContext items={etapa.tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tarefasVisiveis.map((tarefa) => (
            <TarefaCard
              key={tarefa.id}
              tarefa={tarefa}
              etapaId={etapa.id}
              isDragging={draggingId === tarefa.id}
              onToggle={onToggle}
              onRemover={onRemover}
              onAbrir={onAbrir}
            />
          ))}
        </SortableContext>

        {tarefasVisiveis.length === 0 && !adicionando && (
          <div className="h-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/50">Arraste cartões aqui</span>
          </div>
        )}
      </div>

      {/* Adicionar cartão — estilo Trello */}
      <div className="p-2">
        {adicionando ? (
          <div className="bg-card rounded-xl border shadow-sm p-2.5 space-y-2">
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
                if (e.key === "Escape") { setAdicionando(false); setTitulo(""); }
              }}
              placeholder="Título do cartão..."
              className="h-8 text-sm border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent"
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={salvar}>
                Adicionar cartão
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => { setAdicionando(false); setTitulo(""); }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdicionando(true)}
            className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:bg-white/60 hover:text-foreground py-2 px-3 rounded-xl transition-colors"
          >
            <Plus className="size-4 shrink-0" />
            Adicionar cartão
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Filtro por responsável ───────────────────────────────────────────────────

function FiltroPorResponsavel({
  responsaveis,
  selecionado,
  onSelecionar,
}: {
  responsaveis: Responsavel[];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
}) {
  if (responsaveis.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-2 pb-2 flex-wrap shrink-0">
      <span className="text-xs text-muted-foreground font-medium mr-1">Filtrar:</span>
      <button
        onClick={() => onSelecionar(null)}
        className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
          selecionado === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Todos
      </button>
      {responsaveis.map((r) => {
        const iniciais = r.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
        const ativo = selecionado === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onSelecionar(ativo ? null : r.id)}
            title={r.nome}
            className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs font-medium transition-colors ${
              ativo
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <div className={`size-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${
              ativo ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
            }`}>
              {iniciais}
            </div>
            {r.nome.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}

// ─── Board principal ──────────────────────────────────────────────────────────

export default function ProjetoKanban({ projetoId, etapas: etapasIniciais, onChange, onAbrirTarefa }: Props) {
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingTarefa, setDraggingTarefa] = useState<Tarefa | null>(null);
  const [filtroResponsavelId, setFiltroResponsavelId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Extrai responsáveis únicos de todas as tarefas (join table + campo legado)
  const responsaveisUnicos: Responsavel[] = Object.values(
    etapas.flatMap((e) => e.tarefas).reduce<Record<string, Responsavel>>((acc, t) => {
      if (t.responsaveis?.length) {
        t.responsaveis.forEach(r => { acc[r.usuario.id] = r.usuario; });
      } else if (t.responsavel) {
        acc[t.responsavel.id] = t.responsavel;
      }
      return acc;
    }, {})
  );


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const encontrarEtapa = (tarefaId: string) =>
    etapas.find((e) => e.tarefas.some((t) => t.id === tarefaId));

  const onDragStart = ({ active }: DragStartEvent) => {
    const etapa = encontrarEtapa(String(active.id));
    const tarefa = etapa?.tarefas.find((t) => t.id === active.id);
    if (tarefa) { setDraggingId(String(active.id)); setDraggingTarefa(tarefa); }
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;
    const etapaOrigem = encontrarEtapa(String(active.id));
    if (!etapaOrigem) return;
    const etapaDestinoId = String(over.id).startsWith("etapa-")
      ? String(over.id).replace("etapa-", "")
      : (over.data.current as { etapaId?: string })?.etapaId ?? String(over.id).replace("etapa-", "");
    if (!etapaDestinoId || etapaOrigem.id === etapaDestinoId) return;
    setEtapas((prev) => {
      const tarefa = etapaOrigem.tarefas.find((t) => t.id === active.id)!;
      return prev.map((e) => {
        if (e.id === etapaOrigem.id) return { ...e, tarefas: e.tarefas.filter((t) => t.id !== active.id) };
        if (e.id === etapaDestinoId) return { ...e, tarefas: [...e.tarefas, tarefa] };
        return e;
      });
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    setDraggingTarefa(null);
    if (!over) return;
    const etapaDestino = etapas.find((e) => e.tarefas.some((t) => t.id === active.id));
    if (!etapaDestino) return;
    const overEhCard = !String(over.id).startsWith("etapa-");
    if (overEhCard && etapaDestino.tarefas.some((t) => t.id === over.id)) {
      const oldIdx = etapaDestino.tarefas.findIndex((t) => t.id === active.id);
      const newIdx = etapaDestino.tarefas.findIndex((t) => t.id === over.id);
      if (oldIdx !== newIdx) {
        const reordenadas = arrayMove(etapaDestino.tarefas, oldIdx, newIdx);
        setEtapas((prev) => prev.map((e) => e.id === etapaDestino.id ? { ...e, tarefas: reordenadas } : e));
      }
    }
    const novaOrdem = etapaDestino.tarefas.findIndex((t) => t.id === active.id);
    startTransition(async () => {
      try {
        await moverTarefa({ tarefaId: String(active.id), novaEtapaId: etapaDestino.id, novaOrdem, projetoId });
        onChange(etapas);
      } catch {
        toast.error("Erro ao mover tarefa");
        setEtapas(etapasIniciais);
      }
    });
  };

  const toggleTarefa = (etapaId: string, tarefaId: string, concluida: boolean) => {
    setEtapas((prev) => prev.map((e) =>
      e.id !== etapaId ? e : {
        ...e,
        tarefas: e.tarefas.map((t) =>
          t.id !== tarefaId ? t : { ...t, status: concluida ? "CONCLUIDA" as StatusTarefa : "PENDENTE" as StatusTarefa, concluida_em: concluida ? new Date() : null }
        ),
      }
    ));
    startTransition(async () => {
      try { await concluirTarefa(tarefaId, projetoId, concluida); }
      catch { toast.error("Erro ao atualizar tarefa"); }
    });
  };

  const removerTarefa = (etapaId: string, tarefaId: string) => {
    setEtapas((prev) => prev.map((e) =>
      e.id !== etapaId ? e : { ...e, tarefas: e.tarefas.filter((t) => t.id !== tarefaId) }
    ));
    startTransition(async () => {
      try { await excluirTarefa(tarefaId, projetoId); }
      catch { toast.error("Erro ao remover tarefa"); }
    });
  };

  const novaTarefa = (etapaId: string, titulo: string) => {
    startTransition(async () => {
      try {
        const res = await criarTarefa(etapaId, projetoId, { titulo });
        setEtapas((prev) => prev.map((e) =>
          e.id !== etapaId ? e : { ...e, tarefas: [...e.tarefas, res.data as unknown as Tarefa] }
        ));
      } catch { toast.error("Erro ao criar tarefa"); }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col h-full min-h-0">
        <FiltroPorResponsavel
          responsaveis={responsaveisUnicos}
          selecionado={filtroResponsavelId}
          onSelecionar={setFiltroResponsavelId}
        />

        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-2 flex-1 min-h-0 items-start">
          {etapas.map((etapa) => (
            <EtapaColuna
              key={etapa.id}
              etapa={etapa}
              draggingId={draggingId}
              filtroResponsavelId={filtroResponsavelId}
              onToggle={toggleTarefa}
              onRemover={removerTarefa}
              onAbrir={onAbrirTarefa}
              onNovaTarefa={novaTarefa}
            />
          ))}

          {etapas.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-24 text-muted-foreground text-sm">
              Crie etapas na aba &quot;Lista&quot; para visualizar o Kanban.
            </div>
          )}
        </div>
      </div>

      {/* Ghost card ao arrastar */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {draggingTarefa && (
          <div className="bg-card border rounded-xl p-3 shadow-2xl w-64 rotate-1 opacity-95">
            {draggingTarefa.etiquetas && draggingTarefa.etiquetas.length > 0 && (
              <div className="flex gap-1 mb-2">
                {draggingTarefa.etiquetas.map(({ etiqueta }) => (
                  <span key={etiqueta.id} className="h-2 rounded-full min-w-[28px]" style={{ backgroundColor: etiqueta.cor }} />
                ))}
              </div>
            )}
            <p className="text-sm font-medium">{draggingTarefa.titulo}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
