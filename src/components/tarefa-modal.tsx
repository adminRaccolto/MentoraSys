"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  X, MessageSquare, Paperclip, CheckSquare, Clock, User,
  Shield, Trash2, Plus, Check, Upload, Download,
  Loader2, AlertCircle, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  adicionarComentario, excluirComentario,
  adicionarItemChecklist, toggleItemChecklist, excluirItemChecklist,
  criarUrlUploadAnexo, confirmarUploadAnexo, excluirAnexoTarefa,
  solicitarAprovacao, decidirAprovacao, editarTarefa,
} from "@/actions/tarefas";
import { PrioridadeTarefa } from "@/lib/generated/prisma";

// ─── tipos ────────────────────────────────────────────────────────────────────

type Autor = { id: string; nome: string; avatar_url?: string | null };
type Comentario = { id: string; conteudo: string; criado_em: Date | string; autor: Autor | null };
type ItemChecklist = { id: string; texto: string; concluido: boolean; ordem: number };
type Anexo = { id: string; nome: string; arquivo_url: string; arquivo_tamanho: number; mime_type: string; criado_em: Date | string; criador: { id: string; nome: string } | null };
type Atividade = { id: string; descricao: string; criado_em: Date | string; autor: { id: string; nome: string } | null };
type Aprovacao = { id: string; status: "PENDENTE" | "APROVADO" | "REPROVADO"; comentario: string | null; criado_em: Date | string; decidido_em: Date | string | null; solicitante: Autor | null; aprovador: Autor | null };

export type TarefaCompleta = {
  id: string; titulo: string; descricao: string | null;
  status: string; prioridade: PrioridadeTarefa;
  data_prazo: Date | string | null; projeto_id: string;
  responsavel: Autor | null;
  etapa: { id: string; titulo: string };
  projeto: { id: string; titulo: string };
  comentarios: Comentario[];
  checklist: ItemChecklist[];
  anexos: Anexo[];
  atividades: Atividade[];
  aprovacoes: Aprovacao[];
  etiquetas: { etiqueta: { id: string; nome: string; cor: string } }[];
};

interface Props {
  tarefa: TarefaCompleta;
  membros: { id: string; nome: string }[];
  usuarioAtualId?: string;
  onClose: () => void;
  onUpdate: (tarefaId: string, campos: Partial<TarefaCompleta>) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: "PENDENTE",     label: "Pendente",     cor: "bg-slate-100 text-slate-700" },
  { value: "EM_ANDAMENTO", label: "Em Andamento", cor: "bg-blue-100 text-blue-700" },
  { value: "CONCLUIDA",    label: "Concluída",    cor: "bg-emerald-100 text-emerald-700" },
  { value: "CANCELADA",    label: "Cancelada",    cor: "bg-red-100 text-red-700" },
];

const PRIO_OPTS: { value: PrioridadeTarefa; label: string; cor: string }[] = [
  { value: "URGENTE", label: "⚡ Urgente", cor: "text-red-600" },
  { value: "ALTA",    label: "↑ Alta",    cor: "text-orange-500" },
  { value: "MEDIA",   label: "→ Média",   cor: "text-blue-600" },
  { value: "BAIXA",   label: "↓ Baixa",   cor: "text-slate-500" },
];

const PRIO_BADGE: Record<string, string> = {
  URGENTE: "bg-red-100 text-red-700 border-red-200",
  ALTA:    "bg-orange-100 text-orange-700 border-orange-200",
  MEDIA:   "bg-sky-100 text-sky-700 border-sky-200",
  BAIXA:   "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIO_LABEL: Record<string, string> = {
  URGENTE: "⚡ Urgente",
  ALTA:    "↑ Alta",
  MEDIA:   "→ Média",
  BAIXA:   "↓ Baixa",
};

const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;

const fmtFull = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const bytes = (b: number) =>
  b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

const ini = (n: string) => n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();

// ─── seção com título ─────────────────────────────────────────────────────────

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
        {acao}
      </div>
      {children}
    </div>
  );
}

// ─── campo de metadado ────────────────────────────────────────────────────────

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      {children}
    </div>
  );
}

// ─── modal principal ──────────────────────────────────────────────────────────

export default function TarefaModal({ tarefa: ini_, membros, usuarioAtualId, onClose, onUpdate }: Props) {
  const [t, setT] = useState(ini_);
  const [isPending, startTransition] = useTransition();

  // edição inline
  const [editTitle, setEditTitle] = useState(false);
  const [titulo, setTitulo] = useState(ini_.titulo);
  const [editDesc, setEditDesc] = useState(false);
  const [descricao, setDescricao] = useState(ini_.descricao ?? "");

  // comentário
  const [novoComent, setNovoComent] = useState("");
  const [sendingComent, setSendingComent] = useState(false);

  // checklist
  const [novoItem, setNovoItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // anexo
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);

  // aprovação
  const [aprovadorId, setAprovadorId] = useState("");
  const [reprovModal, setReprovModal] = useState<string | null>(null);
  const [reprovComent, setReprovComent] = useState("");

  // aba direita
  const [aba, setAba] = useState<"comentarios" | "atividade" | "aprovacao">("comentarios");

  const checkTotal = t.checklist.length;
  const checkFeitos = t.checklist.filter(i => i.concluido).length;
  const statusCfg = STATUS_OPTS.find(s => s.value === t.status);
  const aprovPendente = t.aprovacoes.find(a => a.status === "PENDENTE");

  // ─── salvar campo ────────────────────────────────────────────────────────

  const salvarCampo = async (campos: Partial<{ titulo: string; descricao: string; status: string; prioridade: PrioridadeTarefa; responsavel_id: string; data_prazo: string }>) => {
    startTransition(async () => {
      try {
        await editarTarefa(t.id, t.projeto_id, {
          titulo: campos.titulo ?? t.titulo,
          descricao: campos.descricao ?? t.descricao ?? undefined,
          responsavel_id: campos.responsavel_id ?? t.responsavel?.id,
          data_prazo: campos.data_prazo ?? (t.data_prazo ? new Date(t.data_prazo).toISOString().split("T")[0] : undefined),
          status: campos.status ?? t.status,
          prioridade: campos.prioridade ?? t.prioridade,
        });

        const updates: Partial<TarefaCompleta> = {};
        if (campos.titulo)        { updates.titulo    = campos.titulo;    setTitulo(campos.titulo); }
        if (campos.descricao !== undefined) updates.descricao  = campos.descricao;
        if (campos.status)        updates.status    = campos.status;
        if (campos.prioridade)    updates.prioridade = campos.prioridade;
        if ("responsavel_id" in campos) {
          const m = membros.find(m => m.id === campos.responsavel_id);
          updates.responsavel = m ? { id: m.id, nome: m.nome } : null;
        }
        if ("data_prazo" in campos) updates.data_prazo = campos.data_prazo ? new Date(campos.data_prazo) : null;

        setT(prev => ({ ...prev, ...updates }));
        onUpdate(t.id, updates);
      } catch { toast.error("Erro ao salvar"); }
    });
  };

  // ─── comentários ─────────────────────────────────────────────────────────

  const enviarComent = async () => {
    if (!novoComent.trim()) return;
    setSendingComent(true);
    try {
      const res = await adicionarComentario(t.id, novoComent);
      setT(prev => ({ ...prev, comentarios: [...prev.comentarios, res.comentario] }));
      setNovoComent("");
    } catch { toast.error("Erro ao comentar"); } finally { setSendingComent(false); }
  };

  const removerComent = (id: string) =>
    startTransition(async () => {
      await excluirComentario(id);
      setT(prev => ({ ...prev, comentarios: prev.comentarios.filter(c => c.id !== id) }));
    });

  // ─── checklist ───────────────────────────────────────────────────────────

  const addItem = async () => {
    if (!novoItem.trim()) return;
    const res = await adicionarItemChecklist(t.id, novoItem);
    setT(prev => ({ ...prev, checklist: [...prev.checklist, res.item] }));
    setNovoItem(""); setAddingItem(false);
  };

  const toggleItem = async (id: string, c: boolean) => {
    await toggleItemChecklist(id, c);
    setT(prev => ({ ...prev, checklist: prev.checklist.map(i => i.id === id ? { ...i, concluido: c } : i) }));
  };

  const removerItem = async (id: string) => {
    await excluirItemChecklist(id);
    setT(prev => ({ ...prev, checklist: prev.checklist.filter(i => i.id !== id) }));
  };

  // ─── anexos ──────────────────────────────────────────────────────────────

  const handleAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAnexo(true);
    try {
      const { signedUrl, caminho } = await criarUrlUploadAnexo(file.name, file.type || "application/octet-stream");
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      const res = await confirmarUploadAnexo({ tarefaId: t.id, nome: file.name, caminho, tamanho: file.size, mimeType: file.type || "application/octet-stream" });
      setT(prev => ({ ...prev, anexos: [res.anexo, ...prev.anexos] }));
      toast.success("Anexo adicionado");
    } catch { toast.error("Erro ao anexar"); } finally {
      setUploadingAnexo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removerAnexo = (id: string) =>
    startTransition(async () => {
      await excluirAnexoTarefa(id);
      setT(prev => ({ ...prev, anexos: prev.anexos.filter(a => a.id !== id) }));
    });

  // ─── aprovação ───────────────────────────────────────────────────────────

  const pedirAprov = () => {
    if (!aprovadorId) return;
    startTransition(async () => {
      const res = await solicitarAprovacao(t.id, aprovadorId);
      setT(prev => ({ ...prev, aprovacoes: [res.aprovacao, ...prev.aprovacoes] }));
      setAprovadorId(""); setAba("aprovacao");
      toast.success("Solicitação enviada");
    });
  };

  const decidir = (aprovId: string, decisao: "APROVADO" | "REPROVADO") =>
    startTransition(async () => {
      await decidirAprovacao(aprovId, decisao, reprovComent || undefined);
      setT(prev => ({ ...prev, aprovacoes: prev.aprovacoes.map(a => a.id === aprovId ? { ...a, status: decisao, decidido_em: new Date(), comentario: reprovComent || null } : a) }));
      setReprovModal(null); setReprovComent("");
    });

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] h-[88vh] max-h-[88vh] p-0 gap-0 overflow-hidden flex flex-col">

        {/* ── barra superior ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
            {t.projeto.titulo} <span className="opacity-50">›</span> {t.etapa.titulo}
          </span>
          {/* Priority badge */}
          <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PRIO_BADGE[t.prioridade]}`}>
            {PRIO_LABEL[t.prioridade]}
          </span>
          {/* Status pill */}
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg?.cor}`}>
            {statusCfg?.label}
          </span>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors ml-1">
            <X className="size-4" />
          </button>
        </div>

        {/* ── corpo 3 colunas ──────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden divide-x w-full">

          {/* ══ COL 1 — Conteúdo principal ═══════════════════════════════ */}
          <div className="w-[45%] shrink-0 overflow-y-auto p-6 space-y-6 min-w-0">

            {/* título */}
            {editTitle ? (
              <Input
                autoFocus value={titulo}
                onChange={e => setTitulo(e.target.value)}
                onBlur={() => { salvarCampo({ titulo }); setEditTitle(false); }}
                onKeyDown={e => {
                  if (e.key === "Enter") { salvarCampo({ titulo }); setEditTitle(false); }
                  if (e.key === "Escape") { setTitulo(t.titulo); setEditTitle(false); }
                }}
                className="text-2xl font-bold h-auto py-1 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
              />
            ) : (
              <h2 className="text-2xl font-bold cursor-text hover:text-primary/80 transition-colors leading-tight"
                onClick={() => setEditTitle(true)}>
                {t.titulo}
              </h2>
            )}

            {/* Etiquetas */}
            {t.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {t.etiquetas.map(({ etiqueta }) => (
                  <span
                    key={etiqueta.id}
                    className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold text-white leading-none"
                    style={{ backgroundColor: etiqueta.cor }}
                  >
                    {etiqueta.nome}
                  </span>
                ))}
              </div>
            )}

            {/* descrição */}
            <Secao titulo="Descrição">
              {editDesc ? (
                <div className="space-y-2">
                  <Textarea autoFocus value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    rows={6} placeholder="Descreva a tarefa..."
                    className="resize-none text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { salvarCampo({ descricao }); setEditDesc(false); }} disabled={isPending}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescricao(t.descricao ?? ""); setEditDesc(false); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditDesc(true)}
                  className="min-h-20 text-sm text-muted-foreground cursor-text rounded-lg border border-transparent hover:border-border hover:bg-muted/30 p-3 transition-colors">
                  {t.descricao || <span className="italic">Clique para adicionar uma descrição...</span>}
                </div>
              )}
            </Secao>

            {/* checklist */}
            <Secao titulo={`Checklist${checkTotal > 0 ? ` (${checkFeitos}/${checkTotal})` : ""}`}
              acao={<button onClick={() => setAddingItem(true)} className="text-xs text-primary hover:underline">+ item</button>}>
              {checkTotal > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((checkFeitos / checkTotal) * 100)}%` }} />
                </div>
              )}
              <div className="space-y-1.5">
                {t.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleItem(item.id, !item.concluido)}
                      className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${item.concluido ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"}`}>
                      {item.concluido && <Check className="size-2.5" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.concluido ? "line-through text-muted-foreground" : ""}`}>{item.texto}</span>
                    <button onClick={() => removerItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {addingItem && (
                  <div className="flex gap-2 mt-1">
                    <Input autoFocus value={novoItem} onChange={e => setNovoItem(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAddingItem(false); setNovoItem(""); } }}
                      placeholder="Novo item..." className="h-7 text-sm" />
                    <Button size="sm" className="h-7" onClick={addItem}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingItem(false); setNovoItem(""); }}>✕</Button>
                  </div>
                )}
              </div>
            </Secao>

            {/* anexos */}
            <Secao titulo={`Anexos (${t.anexos.length})`}
              acao={
                <button onClick={() => fileRef.current?.click()}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  {uploadingAnexo ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                  {uploadingAnexo ? "Enviando…" : "Anexar arquivo"}
                </button>
              }>
              <input ref={fileRef} type="file" className="hidden" onChange={handleAnexo} disabled={uploadingAnexo} />
              {t.anexos.length === 0
                ? <p className="text-xs text-muted-foreground italic">Nenhum anexo</p>
                : (
                  <div className="space-y-1.5">
                    {t.anexos.map(a => (
                      <div key={a.id} className="flex items-center gap-2 p-2.5 border rounded-lg group hover:bg-muted/30">
                        <Paperclip className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{a.nome}</p>
                          <p className="text-xs text-muted-foreground">{bytes(a.arquivo_tamanho)}</p>
                        </div>
                        <a href={a.arquivo_url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="size-7"><Download className="size-3.5" /></Button>
                        </a>
                        <Button size="icon" variant="ghost"
                          className="size-7 text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={() => removerAnexo(a.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
            </Secao>
          </div>

          {/* ══ COL 2 — Metadados ════════════════════════════════════════ */}
          <div className="w-[22%] shrink-0 overflow-y-auto p-5 space-y-5 bg-muted/10 border-r">

            {/* Status */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Flag className="size-3" /> Status
              </p>
              <Select value={t.status} onValueChange={v => v && salvarCampo({ status: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${s.cor}`}>
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <AlertCircle className="size-3" /> Prioridade
              </p>
              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border mb-1 ${PRIO_BADGE[t.prioridade]}`}>
                {PRIO_LABEL[t.prioridade]}
              </span>
              <Select value={t.prioridade} onValueChange={(v: string | null) => v && salvarCampo({ prioridade: v as PrioridadeTarefa })}>
                <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIO_OPTS.map(p => <SelectItem key={p.value} value={p.value}><span className={p.cor}>{p.label}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Responsável */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="size-3" /> Responsável
              </p>
              {t.responsavel && (
                <div className="flex items-center gap-2 mb-1.5 p-2 bg-background rounded-lg border">
                  <div className="size-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {t.responsavel.nome.split(" ").slice(0,2).map(p => p[0]).join("").toUpperCase()}
                  </div>
                  <span className="text-xs font-medium truncate">{t.responsavel.nome.split(" ")[0]}</span>
                </div>
              )}
              <Select value={t.responsavel?.id ?? "none"}
                onValueChange={(v: string | null) => salvarCampo({ responsavel_id: !v || v === "none" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Atribuir…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Prazo */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Prazo
              </p>
              <Input type="date" className="h-9 text-xs"
                value={t.data_prazo ? new Date(t.data_prazo).toISOString().split("T")[0] : ""}
                onChange={e => salvarCampo({ data_prazo: e.target.value })} />
              {t.data_prazo && (
                <p className={`text-xs font-medium ${new Date(t.data_prazo) < new Date() && t.status !== "CONCLUIDA" ? "text-red-500" : "text-muted-foreground"}`}>
                  {new Date(t.data_prazo) < new Date() && t.status !== "CONCLUIDA" ? "⚠ " : ""}{fmt(t.data_prazo)}
                </p>
              )}
            </div>

            {/* Aprovação */}
            {!aprovPendente && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Shield className="size-3" /> Aprovação
                </p>
                <Select value={aprovadorId} onValueChange={(v: string | null) => setAprovadorId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar aprovador" /></SelectTrigger>
                  <SelectContent>
                    {membros.filter(m => m.id !== usuarioAtualId).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full h-8 text-xs" onClick={pedirAprov} disabled={!aprovadorId || isPending}>
                  Solicitar aprovação
                </Button>
              </div>
            )}
          </div>

          {/* ══ COL 3 — Comentários / Atividade / Aprovação ═════════════ */}
          <div className="w-[33%] shrink-0 flex flex-col overflow-hidden">

            {/* abas */}
            <div className="flex border-b shrink-0 bg-background">
              {([
                { id: "comentarios", label: "Comentários", badge: t.comentarios.length },
                { id: "atividade",   label: "Atividade",   badge: null },
                { id: "aprovacao",   label: "Aprovação",   badge: t.aprovacoes.filter(a => a.status === "PENDENTE").length || null },
              ] as const).map(a => (
                <button key={a.id} onClick={() => setAba(a.id)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${aba === a.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {a.label}
                  {a.badge ? <span className="ml-1 text-primary font-bold">{a.badge}</span> : null}
                </button>
              ))}
            </div>

            {/* conteúdo da aba */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* comentários */}
              {aba === "comentarios" && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex-1 space-y-4 overflow-y-auto">
                    {t.comentarios.length === 0
                      ? <p className="text-xs text-muted-foreground text-center pt-6 italic">Nenhum comentário ainda</p>
                      : t.comentarios.map(c => (
                        <div key={c.id} className="flex gap-3 group">
                          <Avatar className="size-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {c.autor ? ini(c.autor.nome) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold">{c.autor?.nome ?? "Usuário"}</span>
                              <span className="text-[10px] text-muted-foreground">{fmtFull(c.criado_em)}</span>
                            </div>
                            <p className="text-xs mt-0.5 whitespace-pre-wrap leading-relaxed">{c.conteudo}</p>
                          </div>
                          {c.autor?.id === usuarioAtualId && (
                            <button onClick={() => removerComent(c.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0">
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>

                  <div className="space-y-2 border-t pt-4 shrink-0">
                    <Textarea value={novoComent} onChange={e => setNovoComent(e.target.value)}
                      placeholder="Escreva um comentário… (Ctrl+Enter para enviar)"
                      rows={3} className="text-xs resize-none"
                      onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) enviarComent(); }} />
                    <Button size="sm" className="w-full h-8 text-xs"
                      onClick={enviarComent} disabled={!novoComent.trim() || sendingComent}>
                      {sendingComent ? <Loader2 className="size-3 animate-spin mr-1.5" /> : <MessageSquare className="size-3 mr-1.5" />}
                      Comentar
                    </Button>
                  </div>
                </div>
              )}

              {/* atividade */}
              {aba === "atividade" && (
                <div className="space-y-3">
                  {t.atividades.length === 0
                    ? <p className="text-xs text-muted-foreground text-center pt-6 italic">Nenhuma atividade registrada</p>
                    : t.atividades.map(a => (
                      <div key={a.id} className="flex items-start gap-2.5">
                        <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs leading-snug">
                            <span className="font-semibold">{a.autor?.nome ?? "Sistema"}</span>{" "}{a.descricao}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtFull(a.criado_em)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* aprovação */}
              {aba === "aprovacao" && (
                <div className="space-y-4">
                  {t.aprovacoes.length === 0
                    ? <p className="text-xs text-muted-foreground text-center pt-6 italic">Nenhuma aprovação solicitada</p>
                    : t.aprovacoes.map(ap => (
                      <div key={ap.id} className="border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ap.status === "APROVADO" ? "bg-green-100 text-green-700" : ap.status === "REPROVADO" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {ap.status === "APROVADO" ? "✓ Aprovado" : ap.status === "REPROVADO" ? "✕ Reprovado" : "⏳ Pendente"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{fmt(ap.criado_em)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Solicitado por <strong>{ap.solicitante?.nome ?? "—"}</strong> para <strong>{ap.aprovador?.nome ?? "—"}</strong>
                        </p>
                        {ap.comentario && <p className="text-xs bg-muted rounded-lg p-2">{ap.comentario}</p>}

                        {ap.status === "PENDENTE" && ap.aprovador?.id === usuarioAtualId && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => decidir(ap.id, "APROVADO")} disabled={isPending}>
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => setReprovModal(ap.id)}>
                              Reprovar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* modal de reprovação */}
        {reprovModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-background rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
              <p className="font-semibold">Motivo da reprovação</p>
              <Textarea autoFocus value={reprovComent} onChange={e => setReprovComent(e.target.value)}
                placeholder="Descreva o motivo..." rows={4} className="text-sm resize-none" />
              <div className="flex gap-2">
                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => decidir(reprovModal, "REPROVADO")} disabled={isPending}>
                  Confirmar reprovação
                </Button>
                <Button variant="outline" onClick={() => { setReprovModal(null); setReprovComent(""); }}>Cancelar</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
