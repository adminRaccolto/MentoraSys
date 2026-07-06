"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Settings, List, Kanban, Trash2, ArrowRightLeft, X,
  ChevronRight, MessageSquare, Send, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  criarLead, editarLead, excluirLead, moverLead,
  adicionarComentario, converterLead,
} from "@/actions/crm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EtapaCrm {
  id: string;
  chave: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface ComentarioCrm {
  id: string;
  autor_nome: string;
  mensagem: string;
  criado_em: string;
}

interface Lead {
  id: string;
  nome: string;
  empresa_nome: string | null;
  contato_nome: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  etapa_chave: string;
  etapa_id: string | null;
  valor_estimado: number | null;
  probabilidade: number;
  previsao_fechamento: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  origem: string | null;
  observacoes: string | null;
  motivo_perda: string | null;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  cliente: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
  servico: { id: string; nome: string } | null;
  comentarios: ComentarioCrm[];
}

interface Props {
  etapasIniciais: EtapaCrm[];
  leadsIniciais: Lead[];
  clientes: { id: string; nome: string }[];
  servicos: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
}

type ViewMode = "KANBAN" | "LISTA";

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(1, "Título obrigatório"),
  empresa_nome: z.string().min(1, "Empresa obrigatória"),
  contato_nome: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  origem: z.string().optional(),
  servico_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  cliente_id: z.string().optional(),
  valor_estimado: z.string().optional(),
  etapa_chave: z.string().default("NOVO"),
  etapa_id: z.string().optional(),
  probabilidade: z.coerce.number().min(0).max(100).default(10),
  previsao_fechamento: z.string().optional(),
  proxima_acao: z.string().optional(),
  data_proxima_acao: z.string().optional(),
  motivo_perda: z.string().optional(),
  observacoes: z.string().optional(),
  tags_input: z.string().optional(),
});

type FormData = z.input<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoeda(v: number | null | undefined) {
  if (!v) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("pt-BR");
}

function toDateInput(s: string | null | undefined) {
  if (!s) return "";
  return s.slice(0, 10);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CrmClient({ etapasIniciais, leadsIniciais, clientes, servicos, usuarios }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [leads, setLeads] = useState<Lead[]>(leadsIniciais);
  const [etapas] = useState<EtapaCrm[]>(etapasIniciais);

  // Rastreia IDs excluídos localmente para evitar que dados novos do servidor os restaurem
  const deletedIdsRef = useRef(new Set<string>());
  useEffect(() => {
    setLeads(prev => {
      const prevIds = new Set(prev.map(l => l.id));
      const novos = leadsIniciais.filter(l => !prevIds.has(l.id) && !deletedIdsRef.current.has(l.id));
      if (novos.length === 0) return prev;
      return [...novos, ...prev];
    });
  }, [leadsIniciais]);
  const [viewMode, setViewMode] = useState<ViewMode>("KANBAN");

  const [selectedId, setSelectedId] = useState<string | null>(leadsIniciais[0]?.id ?? null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [converterId, setConverterId] = useState<string | null>(null);
  const [convertOpcoes, setConvertOpcoes] = useState({ criarContrato: true, criarProjeto: true });

  const [novoComentario, setNovoComentario] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroServico, setFiltroServico] = useState("");

  const etapaMap = useMemo(() => Object.fromEntries(etapas.map((e) => [e.chave, e])), [etapas]);

  const leadsFiltrados = useMemo(() => leads.filter((l) => {
    if (filtroEtapa && l.etapa_chave !== filtroEtapa) return false;
    if (filtroResponsavel && l.responsavel?.id !== filtroResponsavel) return false;
    if (filtroServico && l.servico?.id !== filtroServico) return false;
    return true;
  }), [leads, filtroEtapa, filtroResponsavel, filtroServico]);

  const selected = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", empresa_nome: "", probabilidade: 10, etapa_chave: etapas[0]?.chave ?? "NOVO" },
  });

  const etapaWatch = form.watch("etapa_chave");

  // ─── Modal ────────────────────────────────────────────────────────────────

  function abrirNovo() {
    setEditandoId(null);
    form.reset({ nome: "", empresa_nome: "", probabilidade: 10, etapa_chave: etapas[0]?.chave ?? "NOVO", etapa_id: etapas[0]?.id });
    setModalAberto(true);
  }

  function abrirEditar(lead: Lead) {
    setEditandoId(lead.id);
    setSelectedId(lead.id);
    form.reset({
      nome: lead.nome,
      empresa_nome: lead.empresa_nome ?? "",
      contato_nome: lead.contato_nome ?? "",
      email: lead.email ?? "",
      telefone: lead.telefone ?? "",
      whatsapp: lead.whatsapp ?? "",
      origem: lead.origem ?? "",
      servico_id: lead.servico?.id ?? "",
      responsavel_id: lead.responsavel?.id ?? "",
      cliente_id: lead.cliente?.id ?? "",
      valor_estimado: lead.valor_estimado ? String(lead.valor_estimado) : "",
      etapa_chave: lead.etapa_chave,
      etapa_id: lead.etapa_id ?? "",
      probabilidade: lead.probabilidade,
      previsao_fechamento: toDateInput(lead.previsao_fechamento),
      proxima_acao: lead.proxima_acao ?? "",
      data_proxima_acao: toDateInput(lead.data_proxima_acao),
      motivo_perda: lead.motivo_perda ?? "",
      observacoes: lead.observacoes ?? "",
      tags_input: lead.tags.join(", "),
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
  }

  const handleSubmit = form.handleSubmit((data) => {
    const etapaSel = etapas.find((e) => e.chave === data.etapa_chave);
    const payload = {
      ...data,
      email: data.email || undefined,
      etapa_id: etapaSel?.id ?? null,
      valor_estimado: data.valor_estimado ? Number(data.valor_estimado) : null,
      tags: (data.tags_input ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      previsao_fechamento: data.previsao_fechamento || null,
      data_proxima_acao: data.data_proxima_acao || null,
      servico_id: data.servico_id || undefined,
      responsavel_id: data.responsavel_id || undefined,
      cliente_id: data.cliente_id || undefined,
    };

    startTransition(async () => {
      try {
        if (editandoId) {
          const updated = await editarLead(editandoId, payload);
          setLeads((prev) => prev.map((l) => l.id === editandoId ? {
            ...updated,
            valor_estimado: updated.valor_estimado ? Number(updated.valor_estimado) : null,
            criado_em: updated.criado_em.toISOString(),
            atualizado_em: updated.atualizado_em.toISOString(),
            previsao_fechamento: updated.previsao_fechamento?.toISOString() ?? null,
            data_proxima_acao: updated.data_proxima_acao?.toISOString() ?? null,
            comentarios: updated.comentarios.map((c) => ({ ...c, criado_em: c.criado_em.toISOString() })),
          } : l));
          toast.success("Lead atualizado");
        } else {
          const created = await criarLead(payload);
          setLeads((prev) => [{
            ...created,
            valor_estimado: created.valor_estimado ? Number(created.valor_estimado) : null,
            criado_em: created.criado_em.toISOString(),
            atualizado_em: created.atualizado_em.toISOString(),
            previsao_fechamento: created.previsao_fechamento?.toISOString() ?? null,
            data_proxima_acao: created.data_proxima_acao?.toISOString() ?? null,
            comentarios: [],
          }, ...prev]);
          setSelectedId(created.id);
          toast.success("Lead criado");
        }
        fecharModal();
      } catch (e) {
        toast.error((e as Error).message ?? "Erro ao salvar");
      }
    });
  });

  // ─── Drag-and-drop ────────────────────────────────────────────────────────

  function handleDrop(etapaChave: string, etapaId: string) {
    const lead = leads.find((l) => l.id === draggingId);
    if (!lead || lead.etapa_chave === etapaChave) { setDraggingId(null); return; }

    setLeads((prev) => prev.map((l) => l.id === draggingId ? { ...l, etapa_chave: etapaChave, etapa_id: etapaId } : l));
    setDraggingId(null);

    startTransition(async () => {
      try { await moverLead(lead.id, etapaChave, etapaId); }
      catch { toast.error("Erro ao mover lead"); router.refresh(); }
    });
  }

  // ─── Excluir ──────────────────────────────────────────────────────────────

  function handleExcluir() {
    if (!excluirId) return;
    const idParaExcluir = excluirId;
    startTransition(async () => {
      try {
        await excluirLead(idParaExcluir);
        deletedIdsRef.current.add(idParaExcluir);
        setLeads((prev) => prev.filter((l) => l.id !== idParaExcluir));
        if (selectedId === idParaExcluir) setSelectedId(null);
        setExcluirId(null);
        toast.success("Lead excluído");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  // ─── Comentário ───────────────────────────────────────────────────────────

  function handleComentario() {
    if (!selected || !novoComentario.trim()) return;
    startTransition(async () => {
      try {
        const c = await adicionarComentario(selected.id, novoComentario.trim());
        setLeads((prev) => prev.map((l) => l.id === selected.id
          ? { ...l, comentarios: [...l.comentarios, { ...c, criado_em: c.criado_em.toISOString() }] }
          : l));
        setNovoComentario("");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  // ─── Conversão ────────────────────────────────────────────────────────────

  function handleConverter() {
    if (!converterId) return;
    startTransition(async () => {
      try {
        const res = await converterLead(converterId, convertOpcoes);
        toast.success(`Convertido!${res.contratoId ? " Contrato criado." : ""}${res.projetoId ? " Projeto criado." : ""}`);
        setLeads((prev) => prev.map((l) => l.id === converterId ? { ...l, etapa_chave: "GANHO" } : l));
        setConverterId(null);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-b bg-background z-10">
        <div>
          <h1 className="text-xl font-bold">CRM</h1>
          <p className="text-xs text-muted-foreground">{leadsFiltrados.length} oportunidade(s)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filtroEtapa} onValueChange={(v) => setFiltroEtapa(v ?? "")}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as etapas</SelectItem>
              {etapas.map((e) => <SelectItem key={e.chave} value={e.chave}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroResponsavel} onValueChange={(v) => setFiltroResponsavel(v ?? "")}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Todos os responsáveis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os responsáveis</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroServico} onValueChange={(v) => setFiltroServico(v ?? "")}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Todos os serviços" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os serviços</SelectItem>
              {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex rounded-md border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${viewMode === "KANBAN" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Kanban className="size-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode("LISTA")}
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${viewMode === "LISTA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <List className="size-3.5" /> Lista
            </button>
          </div>

          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => router.push("/crm/configuracoes")}>
            <Settings className="size-3.5 mr-1" /> Etapas
          </Button>
          <Button size="sm" className="h-8 text-xs shrink-0" onClick={abrirNovo}>
            <Plus className="size-3.5 mr-1" /> Nova oportunidade
          </Button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden">

        {/* ── Kanban ── */}
        {viewMode === "KANBAN" && (
          <div className="flex h-full gap-0 overflow-x-auto p-4">
            {etapas.map((etapa) => {
              const itens = leadsFiltrados.filter((l) => l.etapa_chave === etapa.chave);
              const total = itens.reduce((s, l) => s + (l.valor_estimado ?? 0), 0);
              return (
                <div
                  key={etapa.chave}
                  className="shrink-0 w-64 flex flex-col rounded-xl border border-border bg-muted/30 mr-3 overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(etapa.chave, etapa.id)}
                >
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border/50" style={{ borderTopColor: etapa.cor, borderTopWidth: 3 }}>
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: etapa.cor }} />
                    <span className="text-xs font-semibold flex-1 truncate">{etapa.nome}</span>
                    <span className="text-[10px] text-muted-foreground bg-background border rounded-full px-1.5 py-0.5">{itens.length}</span>
                  </div>
                  {total > 0 && (
                    <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/30">
                      {fmtMoeda(total)}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {itens.length === 0 && (
                      <div className="text-center text-[11px] text-muted-foreground py-6 border-2 border-dashed border-border/40 rounded-lg">
                        Arraste ou adicione
                      </div>
                    )}
                    {itens.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onClick={() => setSelectedId(selectedId === lead.id ? null : lead.id)}
                        onDoubleClick={() => abrirEditar(lead)}
                        className={`group relative rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-all select-none ${selectedId === lead.id ? "ring-2 ring-primary shadow-md" : ""}`}
                      >
                        <button
                          className="absolute top-2 right-2 size-5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setExcluirId(lead.id); }}
                        >
                          <X className="size-3" />
                        </button>
                        <p className="font-medium text-xs leading-tight pr-5 truncate">{lead.nome}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{lead.empresa_nome}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          {lead.responsavel && <span className="text-[10px] text-muted-foreground truncate flex-1">{lead.responsavel.nome}</span>}
                          <span className="text-[10px] font-medium text-muted-foreground shrink-0">{lead.probabilidade}%</span>
                        </div>
                        {lead.valor_estimado ? <p className="text-[10px] font-semibold text-primary mt-1">{fmtMoeda(lead.valor_estimado)}</p> : null}
                        {lead.previsao_fechamento && <p className="text-[10px] text-muted-foreground">{fmtData(lead.previsao_fechamento)}</p>}
                        {lead.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1.5">
                            {lead.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[9px] bg-primary/10 text-primary rounded px-1 py-0.5">{tag}</span>
                            ))}
                          </div>
                        )}
                        {lead.comentarios.length > 0 && (
                          <div className="flex items-center gap-0.5 mt-1.5 text-[10px] text-muted-foreground">
                            <MessageSquare className="size-2.5" /> {lead.comentarios.length}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Lista ── */}
        {viewMode === "LISTA" && (
          <div className="h-full overflow-auto p-4">
            {leadsFiltrados.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma oportunidade encontrada.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    {["Oportunidade", "Etapa", "Tags", "Responsável", "Valor", "Previsão", ""].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leadsFiltrados.map((lead) => {
                    const etapa = etapaMap[lead.etapa_chave];
                    return (
                      <tr key={lead.id} className={`border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors ${selectedId === lead.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedId(lead.id)} onDoubleClick={() => abrirEditar(lead)}>
                        <td className="py-2 pr-4">
                          <p className="font-medium truncate max-w-52">{lead.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.empresa_nome}{lead.contato_nome ? ` · ${lead.contato_nome}` : ""}</p>
                        </td>
                        <td className="py-2 pr-4">
                          {etapa && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: etapa.cor + "22", color: etapa.cor }}>
                              {etapa.nome}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-0.5">
                            {lead.tags.slice(0, 2).map((t) => <span key={t} className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">{t}</span>)}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{lead.responsavel?.nome ?? "—"}</td>
                        <td className="py-2 pr-4 text-xs font-medium">{fmtMoeda(lead.valor_estimado) ?? "—"}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{fmtData(lead.previsao_fechamento) ?? "—"}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); abrirEditar(lead); }}><ChevronRight className="size-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setExcluirId(lead.id); }}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Painel do lead selecionado (kanban) */}
      {selected && viewMode === "KANBAN" && (
        <div className="shrink-0 border-t bg-card px-6 py-3 max-h-60 overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{selected.nome}</p>
                {etapaMap[selected.etapa_chave] && (
                  <Badge className="border-0 text-[10px]" style={{ background: etapaMap[selected.etapa_chave].cor + "22", color: etapaMap[selected.etapa_chave].cor }}>
                    {etapaMap[selected.etapa_chave].nome}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selected.empresa_nome}{selected.contato_nome ? ` · ${selected.contato_nome}` : ""}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                {selected.responsavel && <span>Resp: {selected.responsavel.nome}</span>}
                {selected.valor_estimado && <span className="font-medium text-primary">{fmtMoeda(selected.valor_estimado)}</span>}
                <span>{selected.probabilidade}%</span>
                {selected.previsao_fechamento && <span>Previsão: {fmtData(selected.previsao_fechamento)}</span>}
                <span>{selected.comentarios.length} comentário(s)</span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirEditar(selected)}>Editar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConverterId(selected.id)}>
                <ArrowRightLeft className="size-3.5 mr-1" /> Converter
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setExcluirId(selected.id)}>
                <Trash2 className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setSelectedId(null)}><X className="size-3.5" /></Button>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Adicionar comentário..."
              className="h-7 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComentario(); } }}
            />
            <Button size="icon" className="size-7 shrink-0" onClick={handleComentario} disabled={!novoComentario.trim() || isPending}>
              <Send className="size-3" />
            </Button>
          </div>
          {selected.comentarios.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {selected.comentarios.slice(-3).map((c) => (
                <div key={c.id} className="text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                  <span className="font-medium">{c.autor_nome}</span>
                  <span className="text-muted-foreground ml-2">{fmtData(c.criado_em)}</span>
                  <p className="mt-0.5">{c.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      <Dialog open={modalAberto} onOpenChange={(o) => { if (!o) fecharModal(); }}>
        <DialogContent className="max-w-5xl w-[95vw] p-8">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-8">
            {/* Formulário — grade 4 colunas generosas */}
            <form id="lead-form" onSubmit={handleSubmit} className="flex-1 min-w-0">
              <div className="grid grid-cols-4 gap-x-5 gap-y-4">

                {/* Linha 1: Título (col inteira) */}
                <div className="col-span-4 space-y-1.5">
                  <Label>Título *</Label>
                  <Input className="h-10" {...form.register("nome")} placeholder="Ex: Projeto de Gestão — Fazenda XYZ" />
                  {form.formState.errors.nome && <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>}
                </div>

                {/* Linha 2: Empresa (2 cols) | Contato | E-mail */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Empresa / Lead *</Label>
                  <Input className="h-10" {...form.register("empresa_nome")} placeholder="Nome da empresa ou do lead" />
                  {form.formState.errors.empresa_nome && <p className="text-xs text-destructive">{form.formState.errors.empresa_nome.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contato</Label>
                  <Input className="h-10" {...form.register("contato_nome")} placeholder="Nome do contato" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input className="h-10" type="email" {...form.register("email")} />
                  {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                </div>

                {/* Linha 3: Telefone | WhatsApp | Origem | Responsável */}
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input className="h-10" {...form.register("telefone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input className="h-10" {...form.register("whatsapp")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Origem</Label>
                  <Input className="h-10" {...form.register("origem")} placeholder="Indicação, site, evento..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Responsável</Label>
                  <Select value={form.watch("responsavel_id") ?? ""} onValueChange={(v) => form.setValue("responsavel_id", v ?? undefined)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Linha 4: Etapa | Valor estimado | Probabilidade | Serviço */}
                <div className="space-y-1.5">
                  <Label>Etapa</Label>
                  <Select value={etapaWatch} onValueChange={(v) => { if (!v) return; form.setValue("etapa_chave", v); form.setValue("etapa_id", etapas.find((e) => e.chave === v)?.id ?? undefined); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {etapas.map((e) => <SelectItem key={e.chave} value={e.chave}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor estimado (R$)</Label>
                  <Input className="h-10" type="number" step="0.01" {...form.register("valor_estimado")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Probabilidade (%)</Label>
                  <Input className="h-10" type="number" min={0} max={100} {...form.register("probabilidade", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Serviço</Label>
                  <Select value={form.watch("servico_id") ?? ""} onValueChange={(v) => form.setValue("servico_id", v ?? undefined)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Linha 5: Previsão | Próxima ação | Data próx. ação | Cliente */}
                <div className="space-y-1.5">
                  <Label>Previsão fechamento</Label>
                  <Input className="h-10" type="date" {...form.register("previsao_fechamento")} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Próxima ação</Label>
                  <Input className="h-10" {...form.register("proxima_acao")} placeholder="Ex: Enviar proposta, Ligar para cliente..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da próxima ação</Label>
                  <Input className="h-10" type="date" {...form.register("data_proxima_acao")} />
                </div>

                {/* Linha 6: Tags (3 cols) | Motivo de perda */}
                <div className="col-span-3 space-y-1.5">
                  <Label>Tags <span className="text-sm text-muted-foreground font-normal">(separadas por vírgula)</span></Label>
                  <Input className="h-10" {...form.register("tags_input")} placeholder="Ex: pecuária, soja, irrigação" />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo de perda</Label>
                  <Input className="h-10" {...form.register("motivo_perda")} />
                </div>

                {/* Linha 7: Cliente existente | Observações (3 cols) */}
                <div className="space-y-1.5">
                  <Label>Cliente existente</Label>
                  <Select value={form.watch("cliente_id") ?? ""} onValueChange={(v) => form.setValue("cliente_id", v ?? undefined)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Criar na conversão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Criar na conversão</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} {...form.register("observacoes")} className="resize-none" />
                </div>
              </div>
            </form>

            {/* Histórico de comentários (somente ao editar) */}
            {editandoId && selected && (
              <div className="w-72 shrink-0 flex flex-col gap-3 border-l border-border pl-6">
                <div>
                  <p className="text-sm font-semibold">Histórico de interações</p>
                  <p className="text-xs text-muted-foreground">Registro do lead.</p>
                </div>
                <div className="space-y-2 flex-1 max-h-80 overflow-y-auto pr-1">
                  {selected.comentarios.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
                  )}
                  {selected.comentarios.map((c) => (
                    <div key={c.id} className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.autor_nome}</span>
                        <span className="text-muted-foreground">{fmtData(c.criado_em)}</span>
                      </div>
                      <p className="mt-1">{c.mensagem}</p>
                    </div>
                  ))}
                </div>
                <Textarea
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Registre a interação, decisão ou próximo passo..."
                  rows={3}
                  className="resize-none text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleComentario} disabled={!novoComentario.trim() || isPending}>
                  <Send className="size-3.5 mr-1.5" /> Adicionar comentário
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" form="lead-form" disabled={isPending}>
              {editandoId ? "Salvar alterações" : "Criar oportunidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal converter ── */}
      <Dialog open={!!converterId} onOpenChange={(o) => { if (!o) setConverterId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Converter oportunidade</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Selecione o que deseja criar. Um cliente será criado automaticamente se necessário.</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={convertOpcoes.criarContrato} onCheckedChange={(v) => setConvertOpcoes((c) => ({ ...c, criarContrato: !!v }))} />
              <span className="text-sm">Criar contrato</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={convertOpcoes.criarProjeto} onCheckedChange={(v) => setConvertOpcoes((c) => ({ ...c, criarProjeto: !!v }))} />
              <span className="text-sm">Criar projeto</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverterId(null)}>Cancelar</Button>
            <Button onClick={handleConverter} disabled={isPending}>
              <RefreshCw className="size-3.5 mr-1.5" /> Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog excluir ── */}
      <AlertDialog open={!!excluirId} onOpenChange={(o) => { if (!o) setExcluirId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir oportunidade?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
