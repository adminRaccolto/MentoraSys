"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, GitBranch, Minus, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { salvarConteudo } from "@/actions/diagnosticos";

interface Props {
  id: string;
  titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const NODE_COLORS = [
  "#dbeafe", "#dcfce7", "#fef9c3", "#fee2e2",
  "#ede9fe", "#fff7ed", "#e0f2fe", "#fce7f3",
  "#ecfdf5", "#fffbeb", "#1e3a5f", "#14532d",
  "#78350f", "#4c1d95", "#1e293b", "#ffffff",
];

function newMapData(titulo: string) {
  return {
    nodeData: {
      id: "me-root",
      topic: titulo,
      children: [],
    },
  };
}

export default function EditorMapaMental({ id, titulo, conteudo, cliente, projeto }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meRef = useRef<any>(null);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState<{
    child: { x: number; y: number };
    sib: { x: number; y: number };
  } | null>(null);
  const [showColors, setShowColors] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateOverlay() {
    const container = containerRef.current;
    if (!container) return;
    const sel = container.querySelector(".selected") as HTMLElement | null;
    if (!sel) { setOverlay(null); setShowColors(false); return; }
    const cr = container.getBoundingClientRect();
    const nr = sel.getBoundingClientRect();
    setOverlay({
      child: { x: nr.left - cr.left + nr.width / 2 - 12, y: nr.bottom - cr.top + 6 },
      sib:   { x: nr.right - cr.left + 6,                 y: nr.top - cr.top + nr.height / 2 - 12 },
    });
    setShowColors(true);
  }

  useEffect(() => {
    if (!containerRef.current) return;

    async function init() {
      const MindElixir = (await import("mind-elixir")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = new (MindElixir as any)({
        el: containerRef.current,
        direction: 2,
        draggable: true,
        editable: true,
        keypress: true,
      });

      const data = conteudo?.nodeData ? conteudo : newMapData(titulo);
      instance.init(data);
      meRef.current = instance;

      instance.bus.addListener("operation", () => {
        requestAnimationFrame(updateOverlay);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const snap = { ...instance.getData() };
          setSaving(true);
          salvarConteudo(id, snap)
            .catch(() => toast.error("Erro ao salvar"))
            .finally(() => setSaving(false));
        }, 1500);
      });

      instance.bus.addListener("selectNode", () => requestAnimationFrame(updateOverlay));

      const el = containerRef.current!;
      const handleInteraction = () => requestAnimationFrame(updateOverlay);
      el.addEventListener("click", handleInteraction);
      el.addEventListener("wheel", handleInteraction, { passive: true });
      el.addEventListener("mouseup", handleInteraction);
    }

    void init();

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      meRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function act(fn: () => void) {
    return (e: React.MouseEvent) => { e.preventDefault(); fn(); };
  }

  function setNodeBg(color: string) {
    const me = meRef.current;
    if (!me) return;
    const node = me.currentNode;
    if (!node) return;
    if (!node.style) node.style = {};
    node.style.background = color;
    node.style["border-color"] = color;
    const sel = containerRef.current?.querySelector(".selected") as HTMLElement | null;
    if (sel) { sel.style.backgroundColor = color; sel.style.borderColor = color; }
    const snap = { ...me.getData() };
    setSaving(true);
    salvarConteudo(id, snap)
      .catch(() => toast.error("Erro ao salvar"))
      .finally(() => setSaving(false));
  }

  const salvarManual = () => {
    const me = meRef.current;
    if (!me) return;
    startTransition(async () => {
      const snap = { ...me.getData() };
      try {
        await salvarConteudo(id, snap);
        toast.success("Mapa salvo!");
      } catch {
        toast.error("Erro ao salvar");
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* toolbar */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 border-b bg-background z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{titulo}</p>
          {(cliente || projeto) && (
            <p className="text-xs text-muted-foreground truncate">
              {cliente?.nome ?? projeto?.titulo}
            </p>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
          Mapa Mental
        </span>

        <span className="text-xs text-muted-foreground">
          {saving || isPending ? "Salvando…" : "Salvo"}
        </span>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={salvarManual} disabled={isPending}>
          <Save className="size-3.5 mr-1" />
          Salvar
        </Button>
      </header>

      {/* hint bar */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 bg-indigo-50 border-b text-xs text-indigo-700">
        <span>Clique num nó para selecioná-lo</span>
        <span className="text-indigo-300">·</span>
        <span>Duplo-clique para editar</span>
        <span className="text-indigo-300">·</span>
        <kbd className="bg-white px-1.5 py-0.5 rounded border text-[10px]">Tab</kbd><span>filho</span>
        <kbd className="bg-white px-1.5 py-0.5 rounded border text-[10px]">Enter</kbd><span>irmão</span>
        <kbd className="bg-white px-1.5 py-0.5 rounded border text-[10px]">Del</kbd><span>excluir</span>
      </div>

      {/* canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="w-full h-full mind-elixir-container" />

        {/* botões contextuais de adicionar nó */}
        {overlay && (
          <>
            <button
              className="mind-node-btn mind-node-btn--child"
              title="Adicionar filho (Tab)"
              style={{ position: "absolute", left: overlay.child.x, top: overlay.child.y }}
              onMouseDown={act(() => meRef.current?.addChild())}
            >
              <Plus className="size-3" />
            </button>
            <button
              className="mind-node-btn mind-node-btn--sib"
              title="Adicionar irmão (Enter)"
              style={{ position: "absolute", left: overlay.sib.x, top: overlay.sib.y }}
              onMouseDown={act(() => meRef.current?.insertSibling("after"))}
            >
              <GitBranch className="size-3" />
            </button>
          </>
        )}

        {/* paleta de cores do nó */}
        {showColors && overlay && (
          <div
            className="mind-color-palette"
            style={{ position: "absolute", left: overlay.child.x - 60, top: overlay.child.y + 34 }}
          >
            <div className="flex flex-wrap gap-1 p-2 bg-white border rounded-xl shadow-lg w-36">
              {NODE_COLORS.map((c) => (
                <button
                  key={c}
                  className="size-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                  style={{ background: c, borderColor: c === "#ffffff" ? "#e2e8f0" : c }}
                  onMouseDown={act(() => setNodeBg(c))}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        {/* toolbar flutuante */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur border rounded-xl shadow-lg px-3 py-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"
            onMouseDown={act(() => meRef.current?.addChild())}
            title="Tab"
          >
            <Plus className="size-3.5" />
            Filho
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"
            onMouseDown={act(() => meRef.current?.insertSibling("after"))}
            title="Enter"
          >
            <GitBranch className="size-3.5" />
            Irmão
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-red-50 text-red-600 transition-colors"
            onMouseDown={act(() => {
              const n = meRef.current?.currentNodes;
              if (n?.length) meRef.current.removeNodes(n);
            })}
            title="Del"
          >
            <Minus className="size-3.5" />
            Excluir nó
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            onMouseDown={act(() => setShowColors((v) => !v))}
          >
            <Palette className="size-3.5" />
            Cor
          </button>
        </div>
      </div>
    </div>
  );
}
