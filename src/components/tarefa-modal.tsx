"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  X, MessageSquare, Paperclip, CheckSquare, Clock, User,
  Tag, Shield, Trash2, Plus, Check, Upload, Download,
  Loader2, ChevronDown, AlertCircle, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  adicionarComentario, excluirComentario,
  adicionarItemChecklist, toggleItemChecklist, excluirItemChecklist,
  criarUrlUploadAnexo, confirmarUploadAnexo, excluirAnexoTarefa,
  solicitarAprovacao, decidirAprovacao,
  editarTarefa,
} from "@/actions/tarefas";
import { PrioridadeTarefa } from "@/lib/generated/prisma";

// ─── tipos ────────────────────────────────────────────────────────────────────

type Autor = { id: string; nome: string; avatar_url?: string | null };

type Comentario = {
  id: string; conteudo: string; criado_em: Date | string;
  autor: Autor | null;
};

type ItemChecklist = {
  id: string; texto: string; concluido: boolean; ordem: number;
};

type Anexo = {
  id: string; nome: string; arquivo_url: string; arquivo_tamanho: number;
  mime_type: string; criado_em: Date | string;
  criador: { id: string; nome: string } | null;
};

type Atividade = {
  id: string; descricao: string; criado_em: Date | string;
  autor: { id: string; nome: string } | null;
};

type Aprovacao = {
  id: string;
  status: "PENDENTE" | "APROVADO" | "REPROVADO";
  comentario: string | null;
  criado_em: Date | string;
  decidido_em: Date | string | null;
  solicitante: Autor | null;
  aprovador: Autor | null;
};

export type TarefaCompleta = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: PrioridadeTarefa;
  data_prazo: Date | string | null;
  projeto_id: string;
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

const STATUS_TAREFA = [
  { value: "PENDENTE",      label: "Pendente",      cor: "bg-slate-100 text-slate-700" },
  { value: "EM_ANDAMENTO",  label: "Em Andamento",  cor: "bg-blue-100 text-blue-700" },
  { value: "CONCLUIDA",     label: "Concluída",     cor: "bg-green-100 text-green-700" },
  { value: "CANCELADA",     label: "Cancelada",     cor: "bg-red-100 text-red-700" },
];

const PRIORIDADE_CFG: Record<PrioridadeTarefa, { label: string; cor: string; icon: string }> = {
  BAIXA:   { label: "Baixa",   cor: "text-slate-500",  icon: "↓" },
  MEDIA:   { label: "Média",   cor: "text-blue-600",   icon: "→" },
  ALTA:    { label: "Alta",    cor: "text-orange-500", icon: "↑" },
  URGENTE: { label: "Urgente", cor: "text-red-600",    icon: "⚡" },
};

function formatData(d: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHora(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function TarefaModal({ tarefa: inicial, membros, usuarioAtualId, onClose, onUpdate }: Props) {
  const [tarefa, setTarefa] = useState(inicial);
  const [isPending, startTransition] = useTransition();

  // edição inline de título e descrição
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [descricao, setDescricao] = useState(inicial.descricao ?? "");
  const [editandoDesc, setEditandoDesc] = useState(false);

  // comentário
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // checklist
  const [novoItem, setNovoItem] = useState("");
  const [adicionandoItem, setAdicionandoItem] = useState(false);

  // upload de anexo
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false);

  // aprovação
  const [aprovadorId, setAprovadorId] = useState("");
  const [comentarioReprovacao, setComentarioReprovacao] = useState("");
  const [modalReprovacao, setModalReprovacao] = useState<string | null>(null);

  // aba ativa no painel direito
  const [aba, setAba] = useState<"comentarios" | "atividade" | "aprovacao">("comentarios");

  // ─── salvar título ────────────────────────────────────────────────────────

  const salvarTitulo = () => {
    if (!titulo.trim() || titulo === tarefa.titulo) { setEditandoTitulo(false); return; }
    startTransition(async () => {
      await editarTarefa(tarefa.id, tarefa.projeto_id, { titulo, descricao: tarefa.descricao ?? undefined });
      setTarefa((t) => ({ ...t, titulo }));
      onUpdate(tarefa.id, { titulo });
      setEditandoTitulo(false);
    });
  };

  const salvarDescricao = () => {
    startTransition(async () => {
      await editarTarefa(tarefa.id, tarefa.projeto_id, { titulo: tarefa.titulo, descricao });
      setTarefa((t) => ({ ...t, descricao }));
      onUpdate(tarefa.id, { descricao });
      setEditandoDesc(false);
      toast.success("Descrição salva");
    });
  };

  // ─── status / prioridade / responsável / prazo ────────────────────────────

  const mudarCampo = (campo: string, valor: string) => {
    startTransition(async () => {
      try {
        await editarTarefa(tarefa.id, tarefa.projeto_id, {
          titulo: tarefa.titulo,
          descricao: tarefa.descricao ?? undefined,
          responsavel_id: campo === "responsavel_id" ? valor || undefined : tarefa.responsavel?.id,
          data_prazo: campo === "data_prazo" ? valor : tarefa.data_prazo ? new Date(tarefa.data_prazo).toISOString().split("T")[0] : undefined,
          status: campo === "status" ? valor : tarefa.status,
          prioridade: campo === "prioridade" ? (valor as PrioridadeTarefa) : tarefa.prioridade,
        });

        const updates: Partial<TarefaCompleta> = {};
        if (campo === "status") updates.status = valor;
        if (campo === "prioridade") updates.prioridade = valor as PrioridadeTarefa;
        if (campo === "responsavel_id") {
          const m = membros.find((m) => m.id === valor);
          updates.responsavel = m ? { id: m.id, nome: m.nome } : null;
        }
        if (campo === "data_prazo") updates.data_prazo = valor ? new Date(valor) : null;

        setTarefa((t) => ({ ...t, ...updates }));
        onUpdate(tarefa.id, updates);
      } catch {
        toast.error("Erro ao atualizar");
      }
    });
  };

  // ─── comentários ─────────────────────────────────────────────────────────

  const enviarComentario = async () => {
    if (!novoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      const res = await adicionarComentario(tarefa.id, novoComentario);
      setTarefa((t) => ({ ...t, comentarios: [...t.comentarios, res.comentario] }));
      setNovoComentario("");
    } catch { toast.error("Erro ao enviar comentário"); }
    finally { setEnviandoComentario(false); }
  };

  const removerComentario = (comentarioId: string) => {
    startTransition(async () => {
      await excluirComentario(comentarioId);
      setTarefa((t) => ({ ...t, comentarios: t.comentarios.filter((c) => c.id !== comentarioId) }));
    });
  };

  // ─── checklist ───────────────────────────────────────────────────────────

  const adicionarItem = async () => {
    if (!novoItem.trim()) return;
    const res = await adicionarItemChecklist(tarefa.id, novoItem);
    setTarefa((t) => ({ ...t, checklist: [...t.checklist, res.item] }));
    setNovoItem("");
    setAdicionandoItem(false);
  };

  const toggleItem = async (itemId: string, concluido: boolean) => {
    await toggleItemChecklist(itemId, concluido);
    setTarefa((t) => ({
      ...t,
      checklist: t.checklist.map((i) => i.id === itemId ? { ...i, concluido } : i),
    }));
  };

  const removerItem = async (itemId: string) => {
    await excluirItemChecklist(itemId);
    setTarefa((t) => ({ ...t, checklist: t.checklist.filter((i) => i.id !== itemId) }));
  };

  // ─── anexos ──────────────────────────────────────────────────────────────

  const handleAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadandoAnexo(true);
    try {
      const { signedUrl, caminho } = await criarUrlUploadAnexo(file.name, file.type || "application/octet-stream");
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      const res = await confirmarUploadAnexo({ tarefaId: tarefa.id, nome: file.name, caminho, tamanho: file.size, mimeType: file.type || "application/octet-stream" });
      setTarefa((t) => ({ ...t, anexos: [res.anexo, ...t.anexos] }));
      toast.success("Anexo adicionado");
    } catch { toast.error("Erro ao enviar anexo"); }
    finally { setUploadandoAnexo(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removerAnexo = (anexoId: string) => {
    startTransition(async () => {
      await excluirAnexoTarefa(anexoId);
      setTarefa((t) => ({ ...t, anexos: t.anexos.filter((a) => a.id !== anexoId) }));
    });
  };

  // ─── aprovação ───────────────────────────────────────────────────────────

  const pedirAprovacao = () => {
    if (!aprovadorId) return;
    startTransition(async () => {
      const res = await solicitarAprovacao(tarefa.id, aprovadorId);
      setTarefa((t) => ({ ...t, aprovacoes: [res.aprovacao, ...t.aprovacoes] }));
      setAprovadorId("");
      setAba("aprovacao");
      toast.success("Solicitação enviada");
    });
  };

  const decidir = (aprovacaoId: string, decisao: "APROVADO" | "REPROVADO") => {
    startTransition(async () => {
      const res = await decidirAprovacao(aprovacaoId, decisao, comentarioReprovacao || undefined);
      setTarefa((t) => ({
        ...t,
        aprovacoes: t.aprovacoes.map((a) => a.id === aprovacaoId ? { ...a, status: decisao, decidido_em: new Date(), comentario: comentarioReprovacao || null } : a),
        atividades: [res.aprovacao as unknown as Atividade, ...t.atividades],
      }));
      setModalReprovacao(null);
      setComentarioReprovacao("");
    });
  };

  // ─── progresso checklist ──────────────────────────────────────────────────
  const checkTotal = tarefa.checklist.length;
  const checkFeitos = tarefa.checklist.filter((i) => i.concluido).length;

  const statusCfg = STATUS_TAREFA.find((s) => s.value === tarefa.status);
  const prioCfg = PRIORIDADE_CFG[tarefa.prioridade];
  const aprovacaoPendente = tarefa.aprovacoes.find((a) => a.status === "PENDENTE");

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* ── barra superior ── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30 shrink-0">
          <span className="text-xs text-muted-foreground truncate">
            {tarefa.projeto.titulo} › {tarefa.etapa.titulo}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg?.cor}`}>
              {statusCfg?.label}
            </span>
            <button onClick={onClose} className="ml-2 p-1 rounded hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex overflow-hidden" style={{ maxHeight: "calc(90vh - 52px)" }}>
          {/* ── coluna esquerda ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r">

            {/* título */}
            {editandoTitulo ? (
              <Input
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={(e) => { if (e.key === "Enter") salvarTitulo(); if (e.key === "Escape") { setTitulo(tarefa.titulo); setEditandoTitulo(false); } }}
                className="text-xl font-bold h-auto py-1 px-2"
              />
            ) : (
              <h2
                className="text-xl font-bold cursor-text hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                onClick={() => setEditandoTitulo(true)}
              >
                {tarefa.titulo}
              </h2>
            )}

            {/* metadados em grade */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Flag className="size-3" /> Status</p>
                <Select value={tarefa.status} onValueChange={(v) => v && mudarCampo("status", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_TAREFA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><AlertCircle className="size-3" /> Prioridade</p>
                <Select value={tarefa.prioridade} onValueChange={(v) => v && mudarCampo("prioridade", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PRIORIDADE_CFG) as [PrioridadeTarefa, typeof PRIORIDADE_CFG[PrioridadeTarefa]][]).map(([v, cfg]) => (
                      <SelectItem key={v} value={v}>
                        <span className={cfg.cor}>{cfg.icon}</span> {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="size-3" /> Responsável</p>
                <Select value={tarefa.responsavel?.id ?? "none"} onValueChange={(v: string | null) => mudarCampo("responsavel_id", !v || v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="size-3" /> Prazo</p>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={tarefa.data_prazo ? new Date(tarefa.data_prazo).toISOString().split("T")[0] : ""}
                  onChange={(e) => mudarCampo("data_prazo", e.target.value)}
                />
              </div>
            </div>

            {/* descrição */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Descrição</p>
              {editandoDesc ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={5}
                    placeholder="Adicione uma descrição detalhada..."
                    className="text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={salvarDescricao} disabled={isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescricao(tarefa.descricao ?? ""); setEditandoDesc(false); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="min-h-[60px] rounded-md border border-transparent hover:border-border p-2 -mx-2 cursor-text text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setEditandoDesc(true)}
                >
                  {tarefa.descricao || <span className="italic">Clique para adicionar uma descrição...</span>}
                </div>
              )}
            </div>

            {/* checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <CheckSquare className="size-3" /> Checklist
                  {checkTotal > 0 && <span className="ml-1 text-primary">({checkFeitos}/{checkTotal})</span>}
                </p>
                <button onClick={() => setAdicionandoItem(true)} className="text-xs text-primary hover:underline">+ item</button>
              </div>
              {checkTotal > 0 && (
                <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((checkFeitos / checkTotal) * 100)}%` }} />
                </div>
              )}
              <div className="space-y-1.5">
                {tarefa.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleItem(item.id, !item.concluido)}
                      className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        item.concluido ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"
                      }`}
                    >
                      {item.concluido && <Check className="size-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.concluido ? "line-through text-muted-foreground" : ""}`}>
                      {item.texto}
                    </span>
                    <button
                      onClick={() => removerItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {adicionandoItem && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      autoFocus
                      value={novoItem}
                      onChange={(e) => setNovoItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") adicionarItem(); if (e.key === "Escape") { setAdicionandoItem(false); setNovoItem(""); } }}
                      placeholder="Texto do item..."
                      className="h-7 text-sm"
                    />
                    <Button size="sm" className="h-7" onClick={adicionarItem}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAdicionandoItem(false); setNovoItem(""); }}>✕</Button>
                  </div>
                )}
              </div>
            </div>

            {/* anexos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <Paperclip className="size-3" /> Anexos ({tarefa.anexos.length})
                </p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {uploadandoAnexo ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                  {uploadandoAnexo ? "Enviando…" : "Anexar"}
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleAnexo} disabled={uploadandoAnexo} />
              </div>
              <div className="space-y-1.5">
                {tarefa.anexos.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 border rounded-lg group hover:bg-muted/30">
                    <Paperclip className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(a.arquivo_tamanho)}</p>
                    </div>
                    <a href={a.arquivo_url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="size-6"><Download className="size-3" /></Button>
                    </a>
                    <Button size="icon" variant="ghost"
                      className="size-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => removerAnexo(a.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── coluna direita ── */}
          <div className="w-80 shrink-0 flex flex-col overflow-hidden">
            {/* abas */}
            <div className="flex border-b shrink-0">
              {([
                { id: "comentarios", label: "Comentários", count: tarefa.comentarios.length },
                { id: "atividade",   label: "Atividade",   count: null },
                { id: "aprovacao",   label: "Aprovação",   count: tarefa.aprovacoes.filter((a) => a.status === "PENDENTE").length || null },
              ] as const).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${aba === a.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {a.label}
                  {a.count ? <span className="ml-1 text-primary">{a.count}</span> : null}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">

              {/* ── comentários ── */}
              {aba === "comentarios" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {tarefa.comentarios.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
                    )}
                    {tarefa.comentarios.map((c) => (
                      <div key={c.id} className="group">
                        <div className="flex items-start gap-2">
                          <Avatar className="size-6 shrink-0">
                            <AvatarFallback className="text-[10px]">
                              {c.autor ? iniciais(c.autor.nome) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">{c.autor?.nome ?? "Usuário"}</span>
                              <span className="text-[10px] text-muted-foreground">{formatHora(c.criado_em)}</span>
                            </div>
                            <p className="text-xs mt-0.5 whitespace-pre-wrap">{c.conteudo}</p>
                          </div>
                          {c.autor?.id === usuarioAtualId && (
                            <button
                              onClick={() => removerComentario(c.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <Textarea
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      placeholder="Escreva um comentário..."
                      rows={3}
                      className="text-xs resize-none"
                      onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) enviarComentario(); }}
                    />
                    <Button
                      size="sm" className="w-full text-xs h-8"
                      onClick={enviarComentario}
                      disabled={!novoComentario.trim() || enviandoComentario}
                    >
                      {enviandoComentario ? <Loader2 className="size-3 animate-spin mr-1.5" /> : <MessageSquare className="size-3 mr-1.5" />}
                      Comentar
                    </Button>
                  </div>
                </div>
              )}

              {/* ── atividade ── */}
              {aba === "atividade" && (
                <div className="space-y-3">
                  {tarefa.atividades.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada</p>
                  )}
                  {tarefa.atividades.map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs">
                          <span className="font-medium">{a.autor?.nome ?? "Sistema"}</span>{" "}
                          {a.descricao}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatHora(a.criado_em)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── aprovação ── */}
              {aba === "aprovacao" && (
                <div className="space-y-4">
                  {/* solicitar nova aprovação */}
                  {!aprovacaoPendente && (
                    <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                      <p className="text-xs font-medium">Solicitar aprovação</p>
                      <Select value={aprovadorId} onValueChange={(v: string | null) => setAprovadorId(v ?? "")}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar aprovador" /></SelectTrigger>
                        <SelectContent>
                          {membros.filter((m) => m.id !== usuarioAtualId).map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm" className="w-full h-8 text-xs"
                        onClick={pedirAprovacao}
                        disabled={!aprovadorId || isPending}
                      >
                        <Shield className="size-3 mr-1.5" /> Solicitar aprovação
                      </Button>
                    </div>
                  )}

                  {/* lista de aprovações */}
                  {tarefa.aprovacoes.map((ap) => (
                    <div key={ap.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ap.status === "APROVADO"  ? "bg-green-100 text-green-700" :
                          ap.status === "REPROVADO" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {ap.status === "APROVADO" ? "✓ Aprovado" : ap.status === "REPROVADO" ? "✕ Reprovado" : "⏳ Pendente"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatData(ap.criado_em)}</span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Solicitado por <strong>{ap.solicitante?.nome ?? "—"}</strong> para <strong>{ap.aprovador?.nome ?? "—"}</strong>
                      </p>

                      {ap.comentario && (
                        <p className="text-xs bg-muted rounded p-2">{ap.comentario}</p>
                      )}

                      {ap.status === "PENDENTE" && ap.aprovador?.id === usuarioAtualId && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm" className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => decidir(ap.id, "APROVADO")}
                            disabled={isPending}
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="flex-1 h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => setModalReprovacao(ap.id)}
                          >
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
        {modalReprovacao && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-background rounded-xl p-5 w-80 space-y-3 shadow-xl">
              <p className="font-medium text-sm">Motivo da reprovação</p>
              <Textarea
                autoFocus
                value={comentarioReprovacao}
                onChange={(e) => setComentarioReprovacao(e.target.value)}
                placeholder="Descreva o motivo..."
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => decidir(modalReprovacao, "REPROVADO")}
                  disabled={isPending}
                >
                  Confirmar reprovação
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setModalReprovacao(null); setComentarioReprovacao(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
