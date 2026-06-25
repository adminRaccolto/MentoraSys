"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check,
  Upload, Download, FileText, Link as LinkIcon, Copy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { editarProjeto } from "@/actions/projetos";
import { criarEtapa, editarEtapa, excluirEtapa } from "@/actions/etapas";
import { criarTarefa, concluirTarefa, excluirTarefa, carregarTarefaCompleta } from "@/actions/tarefas";
import { criarDocumento, excluirDocumento } from "@/actions/documentos";
import { gerarLinkPortal } from "@/actions/portal";
import TarefaModal, { type TarefaCompleta } from "@/components/tarefa-modal";
import ProjetoKanban from "@/components/projeto-kanban";
import DiagnosticoColetaAba from "@/components/diagnostico-coleta-aba";
import ImportarTarefasModal from "@/components/importar-tarefas-modal";

type StatusProjeto = "PLANEJAMENTO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
type StatusEtapa = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

interface Responsavel { id: string; nome: string }
interface Tarefa {
  id: string; titulo: string; descricao: string | null;
  status: string; data_prazo: Date | null; concluida_em: Date | null;
  responsavel: Responsavel | null;
  etiquetas: { etiqueta: { id: string; nome: string; cor: string } }[];
}
interface Etapa {
  id: string; titulo: string; descricao: string | null;
  status: StatusEtapa; ordem: number;
  data_inicio: Date | null; data_fim: Date | null;
  tarefas: Tarefa[];
}
interface Documento {
  id: string; titulo: string; arquivo_url: string; arquivo_nome: string;
  arquivo_tamanho: number; mime_type: string; criado_em: Date;
  criador: Responsavel | null;
}
interface Projeto {
  id: string; titulo: string; descricao: string | null;
  status: StatusProjeto;
  data_inicio: Date | null; data_fim: Date | null;
  cliente: { id: string; nome: string; email: string | null } | null;
  contrato: { id: string; titulo: string } | null;
  etapas: Etapa[];
  documentos: Documento[];
}

interface Props {
  projeto: Projeto;
  membros: { usuario: Responsavel }[];
  usuarioAtualId?: string;
  diagnosticosColeta?: {
    id: string; momento: string; status: string; token: string;
    enviado_em: Date | null; respondido_em: Date | null; respostas: unknown;
  }[];
}

const STATUS_PROJETO: Record<StatusProjeto, string> = {
  PLANEJAMENTO: "Planejamento", EM_ANDAMENTO: "Em Andamento",
  CONCLUIDO: "Concluído", CANCELADO: "Cancelado",
};
const STATUS_ETAPA_CORES: Record<StatusEtapa, string> = {
  PENDENTE: "bg-gray-100 text-gray-700",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDA: "bg-green-100 text-green-700",
  CANCELADA: "bg-red-100 text-red-700",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjetoDetalheClient({ projeto: inicial, membros, usuarioAtualId, diagnosticosColeta = [] }: Props) {
  const router = useRouter();
  const [projeto, setProjeto] = useState(inicial);
  const [etapasAbertas, setEtapasAbertas] = useState<Set<string>>(
    new Set(inicial.etapas.map((e) => e.id))
  );
  const [novaEtapaTitulo, setNovaEtapaTitulo] = useState("");
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false);
  const [novaTarefaEtapaId, setNovaTarefaEtapaId] = useState<string | null>(null);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkPortalGerado, setLinkPortalGerado] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // modal de tarefa
  const [tarefaModal, setTarefaModal] = useState<TarefaCompleta | null>(null);
  const [carregandoTarefa, setCarregandoTarefa] = useState<string | null>(null);

  // modal de importação
  const [importarAberto, setImportarAberto] = useState(false);

  const abrirTarefa = async (tarefaId: string) => {
    setCarregandoTarefa(tarefaId);
    try {
      const dados = await carregarTarefaCompleta(tarefaId);
      setTarefaModal(dados as unknown as TarefaCompleta);
    } catch { toast.error("Erro ao carregar tarefa"); }
    finally { setCarregandoTarefa(null); }
  };

  const atualizarTarefaNaLista = (tarefaId: string, campos: Partial<TarefaCompleta>) => {
    setProjeto((p) => ({
      ...p,
      etapas: p.etapas.map((e) => ({
        ...e,
        tarefas: e.tarefas.map((t) =>
          t.id === tarefaId
            ? {
                ...t,
                ...(campos.titulo && { titulo: campos.titulo }),
                ...(campos.status && { status: campos.status }),
                ...(campos.responsavel !== undefined && { responsavel: campos.responsavel }),
                ...(campos.data_prazo !== undefined && { data_prazo: campos.data_prazo ? new Date(campos.data_prazo as string) : null }),
              }
            : t
        ),
      })),
    }));
  };

  // ─── Status do projeto ────────────────────────────────────────────────
  const mudarStatus = (status: string) => {
    startTransition(async () => {
      try {
        await editarProjeto(projeto.id, {
          cliente_id: projeto.cliente?.id,
          titulo: projeto.titulo,
          status,
        });
        setProjeto((p) => ({ ...p, status: status as StatusProjeto }));
        toast.success("Status atualizado");
      } catch { toast.error("Erro ao atualizar status"); }
    });
  };

  // ─── Etapas ───────────────────────────────────────────────────────────
  const toggleEtapa = (id: string) =>
    setEtapasAbertas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const salvarEtapa = () => {
    if (!novaEtapaTitulo.trim()) return;
    startTransition(async () => {
      try {
        const res = await criarEtapa(projeto.id, { titulo: novaEtapaTitulo.trim() });
        setProjeto((p) => ({ ...p, etapas: [...p.etapas, { ...res.data, tarefas: [] } as Etapa] }));
        setEtapasAbertas((prev) => new Set([...prev, res.data.id]));
        setNovaEtapaTitulo("");
        setAdicionandoEtapa(false);
        toast.success("Etapa criada");
      } catch { toast.error("Erro ao criar etapa"); }
    });
  };

  const mudarStatusEtapa = (etapaId: string, status: string) => {
    startTransition(async () => {
      try {
        const etapa = projeto.etapas.find((e) => e.id === etapaId)!;
        await editarEtapa(etapaId, projeto.id, { titulo: etapa.titulo, status });
        setProjeto((p) => ({
          ...p,
          etapas: p.etapas.map((e) => e.id === etapaId ? { ...e, status: status as StatusEtapa } : e),
        }));
      } catch { toast.error("Erro ao atualizar etapa"); }
    });
  };

  const removerEtapa = (etapaId: string) => {
    startTransition(async () => {
      try {
        await excluirEtapa(etapaId, projeto.id);
        setProjeto((p) => ({ ...p, etapas: p.etapas.filter((e) => e.id !== etapaId) }));
        toast.success("Etapa removida");
      } catch { toast.error("Erro ao remover etapa"); }
    });
  };

  // ─── Tarefas ──────────────────────────────────────────────────────────
  const salvarTarefa = (etapaId: string) => {
    if (!novaTarefaTitulo.trim()) return;
    startTransition(async () => {
      try {
        const res = await criarTarefa(etapaId, projeto.id, { titulo: novaTarefaTitulo.trim() });
        setProjeto((p) => ({
          ...p,
          etapas: p.etapas.map((e) =>
            e.id === etapaId ? { ...e, tarefas: [...e.tarefas, { ...res.data, etiquetas: [] } as Tarefa] } : e
          ),
        }));
        setNovaTarefaTitulo("");
        setNovaTarefaEtapaId(null);
      } catch { toast.error("Erro ao criar tarefa"); }
    });
  };

  const toggleTarefa = (etapaId: string, tarefaId: string, concluida: boolean) => {
    startTransition(async () => {
      try {
        await concluirTarefa(tarefaId, projeto.id, concluida);
        setProjeto((p) => ({
          ...p,
          etapas: p.etapas.map((e) =>
            e.id === etapaId
              ? {
                  ...e,
                  tarefas: e.tarefas.map((t) =>
                    t.id === tarefaId
                      ? { ...t, status: concluida ? "CONCLUIDA" : "PENDENTE", concluida_em: concluida ? new Date() : null }
                      : t
                  ),
                }
              : e
          ),
        }));
      } catch { toast.error("Erro ao atualizar tarefa"); }
    });
  };

  const removerTarefa = (etapaId: string, tarefaId: string) => {
    startTransition(async () => {
      try {
        await excluirTarefa(tarefaId, projeto.id);
        setProjeto((p) => ({
          ...p,
          etapas: p.etapas.map((e) =>
            e.id === etapaId ? { ...e, tarefas: e.tarefas.filter((t) => t.id !== tarefaId) } : e
          ),
        }));
      } catch { toast.error("Erro ao remover tarefa"); }
    });
  };

  // ─── Documentos ───────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${projeto.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(data.path);

      const res = await criarDocumento(projeto.id, {
        titulo: file.name,
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        mime_type: file.type || "application/octet-stream",
      });

      setProjeto((p) => ({ ...p, documentos: [{ ...res.data, criador: null } as Documento, ...p.documentos] }));
      toast.success("Documento enviado");
    } catch {
      toast.error("Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removerDocumento = (docId: string) => {
    startTransition(async () => {
      try {
        await excluirDocumento(docId);
        setProjeto((p) => ({ ...p, documentos: p.documentos.filter((d) => d.id !== docId) }));
        toast.success("Documento removido");
      } catch { toast.error("Erro ao remover documento"); }
    });
  };

  // ─── Portal ───────────────────────────────────────────────────────────
  const gerarLink = () => {
    startTransition(async () => {
      try {
        if (!projeto.cliente) return;
        const res = await gerarLinkPortal(projeto.cliente.id);
        const url = `${window.location.origin}/portal/acesso/${res.token}`;
        setLinkPortalGerado(url);
        navigator.clipboard.writeText(url);
        toast.success("Link copiado para a área de transferência!");
      } catch { toast.error("Erro ao gerar link"); }
    });
  };

  // ─── Progresso ────────────────────────────────────────────────────────
  const totalTarefas = projeto.etapas.reduce((acc, e) => acc + e.tarefas.length, 0);
  const tarefasConcluidas = projeto.etapas.reduce(
    (acc, e) => acc + e.tarefas.filter((t) => t.status === "CONCLUIDA").length, 0
  );
  const progresso = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

  return (
    <Tabs defaultValue="kanban" className="flex flex-col flex-1 min-h-0">
      {/* Header + TabsList — fundo azul petróleo */}
      <div className="bg-primary text-primary-foreground shrink-0">
        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button
                onClick={() => router.push("/projetos")}
                className="text-xs text-white/60 hover:text-white mb-0.5 block transition-colors"
              >
                ← Projetos
              </button>
              <h1 className="text-xl font-bold leading-tight text-white">{projeto.titulo}</h1>
              {projeto.cliente && <p className="text-sm text-white/70">{projeto.cliente.nome}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={projeto.status} onValueChange={(v) => v && mudarStatus(v)}>
                <SelectTrigger className="w-44 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_PROJETO).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalTarefas > 0 && (
            <div className="space-y-0.5 mt-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>Progresso</span>
                <span>{tarefasConcluidas}/{totalTarefas} ({progresso}%)</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-300" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            {[
              { value: "kanban", label: "Kanban" },
              { value: "etapas", label: "Lista" },
              { value: "diagnostico", label: null },
              { value: "documentos", label: `Documentos (${projeto.documentos.length})` },
              { value: "info", label: "Informações" },
            ].map((tab) => (
              tab.value === "diagnostico" ? (
                <TabsTrigger key="diagnostico" value="diagnostico"
                  className="rounded-none border-b-2 border-transparent text-white/70 hover:text-white data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent px-3 h-9">
                  Diagnóstico
                  {diagnosticosColeta.filter(d => d.status === "RESPONDIDO").length > 0 && (
                    <span className="ml-1 text-[10px] bg-green-400 text-white rounded-full px-1.5 py-0.5">
                      {diagnosticosColeta.filter(d => d.status === "RESPONDIDO").length}/3
                    </span>
                  )}
                </TabsTrigger>
              ) : (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="rounded-none border-b-2 border-transparent text-white/70 hover:text-white data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent px-3 h-9">
                  {tab.label}
                </TabsTrigger>
              )
            ))}
          </TabsList>
        </div>
      </div>

        {/* ── Tab Kanban — ocupa toda a área restante ── */}
        <TabsContent value="kanban" className="flex-1 min-h-0 overflow-auto p-4 mt-0 data-[state=inactive]:hidden">
          <ProjetoKanban
            projetoId={projeto.id}
            etapas={projeto.etapas as any}
            onChange={(etapasKanban: any[]) =>
              setProjeto((p) => ({
                ...p,
                etapas: p.etapas.map((e) => {
                  const atualizada = etapasKanban.find((k: any) => k.id === e.id);
                  if (!atualizada) return e;
                  return {
                    ...e,
                    tarefas: e.tarefas
                      .filter((t) => atualizada.tarefas.some((k: any) => k.id === t.id))
                      .sort((a, b) => {
                        const ia = atualizada.tarefas.findIndex((k: any) => k.id === a.id);
                        const ib = atualizada.tarefas.findIndex((k: any) => k.id === b.id);
                        return ia - ib;
                      }),
                  };
                }),
              }))
            }
            onAbrirTarefa={abrirTarefa}
          />
        </TabsContent>

        {/* ── Tab Lista ── */}
        <TabsContent value="etapas" className="flex-1 overflow-auto mt-0 p-6 data-[state=inactive]:hidden">
          <div className="max-w-3xl space-y-3">
          <div className="flex justify-end mb-1">
            <Button size="sm" variant="outline" onClick={() => setImportarAberto(true)}>
              <Upload className="size-4 mr-1.5" /> Importar tarefas
            </Button>
          </div>
          {projeto.etapas.map((etapa) => {
            const aberta = etapasAbertas.has(etapa.id);
            const concluidas = etapa.tarefas.filter((t) => t.status === "CONCLUIDA").length;
            return (
              <div key={etapa.id} className="border rounded-lg bg-card overflow-hidden">
                {/* Cabeçalho da etapa */}
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => toggleEtapa(etapa.id)}
                >
                  {aberta ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  <span className="font-medium flex-1 text-sm">{etapa.titulo}</span>
                  <span className="text-xs text-muted-foreground mr-2">
                    {concluidas}/{etapa.tarefas.length}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_ETAPA_CORES[etapa.status]}`}>
                    {etapa.status.replace("_", " ")}
                  </span>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Select value={etapa.status} onValueChange={(v) => v && mudarStatusEtapa(etapa.id, v)}>
                      <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent [&>svg:last-child]:hidden">
                        <Pencil className="size-3 text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as const).map((s) => (
                          <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                      onClick={() => removerEtapa(etapa.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>

                {aberta && (
                  <div className="border-t">
                    {etapa.tarefas.map((tarefa) => (
                      <div
                        key={tarefa.id}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 group cursor-pointer"
                        onClick={() => abrirTarefa(tarefa.id)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTarefa(etapa.id, tarefa.id, tarefa.status !== "CONCLUIDA"); }}
                          className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            tarefa.status === "CONCLUIDA"
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 hover:border-primary"
                          }`}
                        >
                          {tarefa.status === "CONCLUIDA" && <Check className="size-3" />}
                        </button>
                        <span className={`flex-1 text-sm ${tarefa.status === "CONCLUIDA" ? "line-through text-muted-foreground" : ""}`}>
                          {tarefa.titulo}
                          {carregandoTarefa === tarefa.id && (
                            <span className="ml-1.5 inline-block size-3 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle" />
                          )}
                        </span>
                        {tarefa.responsavel && (
                          <span className="text-xs text-muted-foreground hidden group-hover:inline">
                            {tarefa.responsavel.nome}
                          </span>
                        )}
                        {tarefa.data_prazo && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Button size="icon" variant="ghost"
                          className="size-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removerTarefa(etapa.id, tarefa.id); }}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Adicionar tarefa inline */}
                    {novaTarefaEtapaId === etapa.id ? (
                      <div className="flex items-center gap-2 px-4 py-2 border-t">
                        <Input
                          autoFocus
                          value={novaTarefaTitulo}
                          onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") salvarTarefa(etapa.id);
                            if (e.key === "Escape") { setNovaTarefaEtapaId(null); setNovaTarefaTitulo(""); }
                          }}
                          placeholder="Título da tarefa..."
                          className="h-7 text-sm"
                        />
                        <Button size="sm" className="h-7" onClick={() => salvarTarefa(etapa.id)} disabled={isPending}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7"
                          onClick={() => { setNovaTarefaEtapaId(null); setNovaTarefaTitulo(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNovaTarefaEtapaId(etapa.id); setNovaTarefaTitulo(""); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-primary w-full text-left border-t"
                      >
                        <Plus className="size-3" /> Nova tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Adicionar etapa */}
          {adicionandoEtapa ? (
            <div className="flex items-center gap-2 border rounded-lg p-3 bg-card">
              <Input
                autoFocus
                value={novaEtapaTitulo}
                onChange={(e) => setNovaEtapaTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarEtapa();
                  if (e.key === "Escape") { setAdicionandoEtapa(false); setNovaEtapaTitulo(""); }
                }}
                placeholder="Título da etapa..."
                className="h-8"
              />
              <Button size="sm" onClick={salvarEtapa} disabled={isPending}>Adicionar</Button>
              <Button size="sm" variant="ghost"
                onClick={() => { setAdicionandoEtapa(false); setNovaEtapaTitulo(""); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdicionandoEtapa(true)}>
              <Plus className="size-4 mr-1.5" /> Nova etapa
            </Button>
          )}
          </div>
        </TabsContent>

        {/* ── Tab Diagnóstico ── */}
        <TabsContent value="diagnostico" className="flex-1 overflow-auto mt-0 p-6 data-[state=inactive]:hidden">
          <DiagnosticoColetaAba
            projetoId={projeto.id}
            aplicacoesIniciais={diagnosticosColeta as any}
          />
        </TabsContent>

        {/* ── Tab Documentos ── */}
        <TabsContent value="documentos" className="flex-1 overflow-auto mt-0 p-6 data-[state=inactive]:hidden">
          <div className="max-w-3xl space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {uploading ? "Enviando..." : "Clique para selecionar um arquivo"}
            </p>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </div>

          {projeto.documentos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum documento enviado ainda</p>
          )}

          <div className="space-y-2">
            {projeto.documentos.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
                <FileText className="size-8 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.arquivo_tamanho)} · {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                    {doc.criador && ` · ${doc.criador.nome}`}
                  </p>
                </div>
                <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost" className="size-8">
                    <Download className="size-4" />
                  </Button>
                </a>
                <Button size="icon" variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => removerDocumento(doc.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          </div>
        </TabsContent>

        {/* ── Tab Informações ── */}
        <TabsContent value="info" className="flex-1 overflow-auto mt-0 p-6 data-[state=inactive]:hidden">
          <div className="max-w-3xl space-y-4">
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="font-medium">{projeto.cliente?.nome ?? "Projeto interno"}</p>
                {projeto.cliente?.email && <p className="text-muted-foreground">{projeto.cliente.email}</p>}
              </div>
              {projeto.contrato && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Contrato</p>
                  <p className="font-medium">{projeto.contrato.titulo}</p>
                </div>
              )}
              {projeto.descricao && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Descrição</p>
                  <p className="whitespace-pre-wrap">{projeto.descricao}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Início</p>
                <p>{projeto.data_inicio ? new Date(projeto.data_inicio).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Término</p>
                <p>{projeto.data_fim ? new Date(projeto.data_fim).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Portal do cliente</p>
            <p className="text-xs text-muted-foreground">
              Gere um link de acesso para que <strong>{projeto.cliente?.nome ?? "o cliente"}</strong> possa acompanhar este projeto.
              O link expira em 7 dias.
            </p>
            <Button variant="outline" size="sm" onClick={gerarLink} disabled={isPending}>
              <LinkIcon className="size-4 mr-1.5" />
              Gerar link de acesso
            </Button>

            {linkPortalGerado && (
              <div className="flex items-center gap-2 bg-muted rounded-md p-2 mt-2">
                <code className="text-xs flex-1 break-all">{linkPortalGerado}</code>
                <Button size="icon" variant="ghost" className="size-7 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(linkPortalGerado); toast.success("Copiado!"); }}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
          </div>
        </TabsContent>
      {tarefaModal && (
        <TarefaModal
          tarefa={tarefaModal}
          membros={membros.map((m) => m.usuario)}
          usuarioAtualId={usuarioAtualId}
          onClose={() => setTarefaModal(null)}
          onUpdate={atualizarTarefaNaLista}
        />
      )}
      <ImportarTarefasModal
        aberto={importarAberto}
        onFechar={() => setImportarAberto(false)}
        projetoId={projeto.id}
        etapas={projeto.etapas.map((e) => ({ id: e.id, titulo: e.titulo }))}
        membros={membros}
        onImportado={(novasTarefas) => {
          setProjeto((p) => ({
            ...p,
            etapas: p.etapas.map((e) => {
              const doEtapa = novasTarefas.filter((t) => t.etapaId === e.id);
              if (doEtapa.length === 0) return e;
              return { ...e, tarefas: [...e.tarefas, ...doEtapa] as Tarefa[] };
            }),
          }));
        }}
      />
    </Tabs>
  );
}
