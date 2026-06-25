"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { criarEtapa, editarEtapa, excluirEtapa, reordenarEtapas } from "@/actions/crm";

interface EtapaCrm {
  id: string;
  chave: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Props { etapasIniciais: EtapaCrm[] }

export default function ConfiguracoesClient({ etapasIniciais }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [etapas, setEtapas] = useState<EtapaCrm[]>(etapasIniciais);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cor: "#1B4F72" });
  const [novaForm, setNovaForm] = useState({ nome: "", cor: "#1B4F72" });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function iniciarEditar(e: EtapaCrm) {
    setEditandoId(e.id);
    setEditForm({ nome: e.nome, cor: e.cor });
  }

  function cancelarEditar() { setEditandoId(null); }

  function handleSalvarEditar(id: string) {
    if (!editForm.nome.trim()) return;
    startTransition(async () => {
      try {
        await editarEtapa(id, editForm);
        setEtapas((prev) => prev.map((e) => e.id === id ? { ...e, nome: editForm.nome.trim(), cor: editForm.cor } : e));
        setEditandoId(null);
        toast.success("Etapa atualizada");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleCriar() {
    if (!novaForm.nome.trim()) return;
    startTransition(async () => {
      try {
        const nova = await criarEtapa(novaForm);
        setEtapas((prev) => [...prev, nova]);
        setNovaForm({ nome: "", cor: "#1B4F72" });
        toast.success("Etapa criada");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleExcluir() {
    if (!excluirId) return;
    startTransition(async () => {
      try {
        await excluirEtapa(excluirId);
        setEtapas((prev) => prev.filter((e) => e.id !== excluirId));
        setExcluirId(null);
        toast.success("Etapa excluída");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...etapas];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setEtapas(reordered);
    setDragIdx(idx);
  }

  function handleDragEnd() {
    if (dragIdx === null) return;
    setDragIdx(null);
    startTransition(async () => {
      try {
        await reordenarEtapas(etapas.map((e) => e.id));
      } catch {
        toast.error("Erro ao reordenar");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/crm")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Configurações do CRM</h1>
          <p className="text-xs text-muted-foreground">Personalize as etapas do pipeline comercial</p>
        </div>
      </div>

      {/* Lista de etapas */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-sm font-semibold">Etapas do funil</p>
          <p className="text-xs text-muted-foreground">Arraste para reordenar. Duplo clique para editar.</p>
        </div>

        <div className="divide-y divide-border">
          {etapas.map((etapa, idx) => (
            <div
              key={etapa.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors"
            >
              <GripVertical className="size-4 text-muted-foreground cursor-grab shrink-0" />

              {editandoId === etapa.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={editForm.cor}
                    onChange={(e) => setEditForm((f) => ({ ...f, cor: e.target.value }))}
                    className="size-7 rounded border cursor-pointer shrink-0"
                  />
                  <Input
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSalvarEditar(etapa.id); if (e.key === "Escape") cancelarEditar(); }}
                  />
                  <Button size="icon" variant="default" className="size-7 shrink-0" onClick={() => handleSalvarEditar(etapa.id)} disabled={isPending}>
                    <Check className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={cancelarEditar}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="size-3 rounded-full shrink-0" style={{ background: etapa.cor }} />
                  <span className="text-sm font-medium truncate flex-1">{etapa.nome}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{etapa.chave}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => iniciarEditar(etapa)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => setExcluirId(etapa.id)} disabled={etapas.length <= 1}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Nova etapa */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold">Nova etapa</p>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Cor</Label>
            <input
              type="color"
              value={novaForm.cor}
              onChange={(e) => setNovaForm((f) => ({ ...f, cor: e.target.value }))}
              className="size-9 rounded border cursor-pointer block"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={novaForm.nome}
              onChange={(e) => setNovaForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Em análise, Follow-up..."
              className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") handleCriar(); }}
            />
          </div>
          <Button className="h-9 shrink-0" onClick={handleCriar} disabled={!novaForm.nome.trim() || isPending}>
            <Plus className="size-4 mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>

      <AlertDialog open={!!excluirId} onOpenChange={(o) => { if (!o) setExcluirId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">
            As oportunidades nesta etapa serão movidas para a primeira etapa disponível.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
