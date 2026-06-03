"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, X, Plus, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { moverTarefa, criarTarefa, concluirTarefa, excluirTarefa } from "@/actions/tarefas";

// ─── tipos ────────────────────────────────────────────────────────────────────

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

// ─── cores de prioridade ──────────────────────────────────────────────────────

const PRIO_BARRA: Record<string, string> = {
  URGENTE: "bg-red-500",
  ALTA:    "bg-orange-400",
  MEDIA:   "bg-blue-400",
  BAIXA:   "bg-slate-300",
};

// ─── card de tarefa sortable ──────────────────────────────────────────────────

function TarefaCard({
  tarefa, etapaId, projetoId, isDragging, onToggle, onRemover, onAbrir,
}: {
  tarefa: Tarefa; etapaId: string; projetoId: string;
  isDragging?: boolean;
  onToggle: (etapaId: string, tarefaId: string, concluida: boolean) => void;
  onRemover: (etapaId: string, tarefaId: string) => void;
  onAbrir: (tarefaId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver } =
    useSortable({ id: tarefa.id, data: { etapaId, type: "tarefa" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const vencida = tarefa.data_prazo && tarefa.status !== "CONCLUIDA" && new Date(tarefa.data_prazo) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background border rounded-lg p-3 space-y-2 shadow-sm group hover:shadow-md transition-shadow ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {/* handle de drag */}
        <button
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(etapaId, tarefa.id, tarefa.status !== "CONCLUIDA"); }}
          className={`size-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
            tarefa.status === "CONCLUIDA"
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary"
          }`}
        >
          {tarefa.status === "CONCLUIDA" && <Check className="size-2.5" />}
        </button>

        {/* título */}
        <button
          onClick={() => onAbrir(tarefa.id)}
          className={`flex-1 text-left text-sm leading-snug ${
            tarefa.status === "CONCLUIDA" ? "line-through text-muted-foreground" : "hover:text-primary"
          }`}
        >
          {tarefa.titulo}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onRemover(etapaId, tarefa.id); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-opacity"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* rodapé do card */}
      {(tarefa.responsavel || tarefa.data_prazo || tarefa.prioridade) && (
        <div className="flex items-center gap-2 pl-7">
          {tarefa.prioridade && tarefa.prioridade !== "MEDIA" && (
            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIO_BARRA[tarefa.prioridade]}`} />
          )}
          {tarefa.data_prazo && (
            <span className={`text-[10px] flex items-center gap-0.5 ${vencida ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              <Clock className="size-3" />
              {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
          {tarefa.responsavel && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <User className="size-3" /> {tarefa.responsavel.nome.split(" ")[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── coluna de etapa (droppable) ──────────────────────────────────────────────

function EtapaColuna({
  etapa, projetoId, draggingId, onToggle, onRemover, onAbrir, onNovaTarefa,
}: {
  etapa: Etapa; projetoId: string; draggingId: string | null;
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

  const concluidas = etapa.tarefas.filter((t) => t.status === "CONCLUIDA").length;

  const salvar = () => {
    if (!titulo.trim()) return;
    onNovaTarefa(etapa.id, titulo.trim());
    setTitulo("");
    setAdicionando(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 bg-muted/40 rounded-xl border transition-colors ${
        isOver ? "bg-primary/5 border-primary/30" : ""
      }`}
    >
      {/* cabeçalho da coluna */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[160px]">{etapa.titulo}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {etapa.tarefas.length}
          </Badge>
        </div>
        {etapa.tarefas.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{concluidas}/{etapa.tarefas.length}</span>
        )}
      </div>

      {/* lista de tarefas */}
      <div className="flex-1 p-2 space-y-2 min-h-[80px]">
        <SortableContext items={etapa.tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {etapa.tarefas.map((tarefa) => (
            <TarefaCard
              key={tarefa.id}
              tarefa={tarefa}
              etapaId={etapa.id}
              projetoId={projetoId}
              isDragging={draggingId === tarefa.id}
              onToggle={onToggle}
              onRemover={onRemover}
              onAbrir={onAbrir}
            />
          ))}
        </SortableContext>

        {/* área vazia visível para drop */}
        {etapa.tarefas.length === 0 && (
          <div className="h-16 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Solte aqui</span>
          </div>
        )}
      </div>

      {/* add tarefa */}
      <div className="p-2 border-t">
        {adicionando ? (
          <div className="space-y-1.5">
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
                if (e.key === "Escape") { setAdicionando(false); setTitulo(""); }
              }}
              placeholder="Título da tarefa..."
              className="h-7 text-xs"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs flex-1" onClick={salvar}>Adicionar</Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                onClick={() => { setAdicionando(false); setTitulo(""); }}>✕</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdicionando(true)}
            className="w-full flex items-center gap-1 text-xs text-muted-foreground hover:text-primary py-1 px-1 rounded transition-colors"
          >
            <Plus className="size-3" /> Nova tarefa
          </button>
        )}
      </div>
    </div>
  );
}

// ─── board principal ──────────────────────────────────────────────────────────

export default function ProjetoKanban({ projetoId, etapas: etapasIniciais, onChange, onAbrirTarefa }: Props) {
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingTarefa, setDraggingTarefa] = useState<Tarefa | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── encontrar etapa de uma tarefa ───────────────────────────────────────

  const encontrarEtapa = (tarefaId: string) =>
    etapas.find((e) => e.tarefas.some((t) => t.id === tarefaId));

  // ─── drag start ─────────────────────────────────────────────────────────

  const onDragStart = ({ active }: DragStartEvent) => {
    const etapa = encontrarEtapa(String(active.id));
    const tarefa = etapa?.tarefas.find((t) => t.id === active.id);
    if (tarefa) { setDraggingId(String(active.id)); setDraggingTarefa(tarefa); }
  };

  // ─── drag over (atualiza UI em tempo real) ───────────────────────────────

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;

    const etapaOrigem = encontrarEtapa(String(active.id));
    if (!etapaOrigem) return;

    // destino pode ser um card (over.data.current.etapaId) ou uma coluna (over.id começa com "etapa-")
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

  // ─── drag end (persiste) ─────────────────────────────────────────────────

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    setDraggingTarefa(null);
    if (!over) return;

    // encontrar onde o card caiu (estado já atualizado pelo onDragOver)
    const etapaDestino = etapas.find((e) => e.tarefas.some((t) => t.id === active.id));
    if (!etapaDestino) return;

    // reordenar dentro da mesma coluna se caiu em cima de outro card
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
        await moverTarefa({
          tarefaId: String(active.id),
          novaEtapaId: etapaDestino.id,
          novaOrdem,
          projetoId,
        });
        onChange(etapas);
      } catch {
        toast.error("Erro ao mover tarefa");
        // reverte para estado do servidor
        setEtapas(etapasIniciais);
      }
    });
  };

  // ─── ações nas tarefas ───────────────────────────────────────────────────

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
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1">
        {etapas.map((etapa) => (
          <EtapaColuna
            key={etapa.id}
            etapa={etapa}
            projetoId={projetoId}
            draggingId={draggingId}
            onToggle={toggleTarefa}
            onRemover={removerTarefa}
            onAbrir={onAbrirTarefa}
            onNovaTarefa={novaTarefa}
          />
        ))}

        {etapas.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground text-sm">
            Crie etapas na aba &quot;Lista&quot; para visualizar o Kanban.
          </div>
        )}
      </div>

      {/* overlay do card sendo arrastado */}
      <DragOverlay>
        {draggingTarefa && (
          <div className="bg-background border rounded-lg p-3 shadow-2xl w-72 opacity-95 rotate-1">
            <p className="text-sm font-medium">{draggingTarefa.titulo}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
