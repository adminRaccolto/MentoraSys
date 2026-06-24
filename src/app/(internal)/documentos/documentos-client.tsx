"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  FolderOpen, Folder, FolderPlus, Upload, Search, Download, Trash2, FileText,
  FileImage, FileVideo, FileArchive, File, X, Loader2, Plus, ChevronRight,
  MoreHorizontal, Pencil, FolderInput, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  criarUrlUpload, confirmarUpload, excluirDocumento, obterUrlDownload,
  criarPasta, editarPasta, excluirPasta, moverDocumento,
} from "@/actions/documentos";
import { CategoriaDocumento } from "@/lib/generated/prisma";

// ─── tipos ────────────────────────────────────────────────────────────────────

type Pasta = {
  id: string;
  nome: string;
  descricao: string | null;
  parent_id: string | null;
  criado_em: Date;
  _count: { documentos: number; filhos: number };
};

type Documento = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaDocumento;
  arquivo_nome: string;
  arquivo_url: string;
  arquivo_tamanho: number;
  mime_type: string;
  criado_em: string;
  pasta_id: string | null;
  pasta: { id: string; nome: string } | null;
  criador: { id: string; nome: string; avatar_url: string | null } | null;
  projeto: { id: string; titulo: string } | null;
  cliente: { id: string; nome: string } | null;
  contrato: { id: string; titulo: string } | null;
};

type Props = {
  documentos: Documento[];
  pastas: Pasta[];
  clientes: { id: string; nome: string }[];
  projetos: { id: string; titulo: string }[];
  contratos: { id: string; titulo: string }[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: CategoriaDocumento | "TODOS"; label: string }[] = [
  { value: "TODOS",      label: "Todos" },
  { value: "CONTRATO",   label: "Contratos" },
  { value: "PROPOSTA",   label: "Propostas" },
  { value: "PROJETO",    label: "Projetos" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "INTERNO",    label: "Interno" },
  { value: "OUTROS",     label: "Outros" },
];

const CAT_CORES: Record<CategoriaDocumento, string> = {
  CONTRATO:   "bg-blue-100 text-blue-700",
  PROPOSTA:   "bg-purple-100 text-purple-700",
  PROJETO:    "bg-green-100 text-green-700",
  FINANCEIRO: "bg-yellow-100 text-yellow-700",
  INTERNO:    "bg-slate-100 text-slate-700",
  OUTROS:     "bg-gray-100 text-gray-700",
};

function iconeArquivo(mime: string) {
  if (mime.startsWith("image/"))  return <FileImage className="size-7 text-blue-400" />;
  if (mime.startsWith("video/"))  return <FileVideo className="size-7 text-purple-400" />;
  if (mime.includes("pdf"))       return <FileText className="size-7 text-red-400" />;
  if (mime.includes("zip") || mime.includes("rar")) return <FileArchive className="size-7 text-orange-400" />;
  return <File className="size-7 text-slate-400" />;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── nó de pasta na sidebar ───────────────────────────────────────────────────

function PastaNo({
  pasta, todas, ativa, onSelecionar, nivel,
}: {
  pasta: Pasta;
  todas: Pasta[];
  ativa: string | null;
  onSelecionar: (id: string) => void;
  nivel: number;
}) {
  const filhos = todas.filter((p) => p.parent_id === pasta.id);
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors group ${
          ativa === pasta.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
        }`}
        style={{ paddingLeft: `${8 + nivel * 16}px` }}
        onClick={() => onSelecionar(pasta.id)}
      >
        {filhos.length > 0 ? (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
          >
            {aberto ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {ativa === pasta.id ? (
          <FolderOpen className="size-4 shrink-0 text-primary" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        )}
        <span className="flex-1 truncate">{pasta.nome}</span>
        {pasta._count.documentos > 0 && (
          <span className="text-[10px] text-muted-foreground">{pasta._count.documentos}</span>
        )}
      </div>
      {aberto && filhos.map((f) => (
        <PastaNo key={f.id} pasta={f} todas={todas} ativa={ativa} onSelecionar={onSelecionar} nivel={nivel + 1} />
      ))}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function DocumentosClient({ documentos: inicial, pastas: iniciaisPastas, clientes, projetos, contratos }: Props) {
  const [docs, setDocs] = useState(inicial);
  const [pastas, setPastas] = useState(iniciaisPastas);
  const [pastaAtiva, setPastaAtiva] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDocumento | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [isPending, startTransition] = useTransition();

  // upload
  const [modalUpload, setModalUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [uploadProgresso, setUploadProgresso] = useState(0);
  const [uploadando, setUploadando] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    categoria: "INTERNO" as CategoriaDocumento,
    projeto_id: "",
    cliente_id: "",
    contrato_id: "",
  });

  // pasta — criar/editar/excluir
  const [modalPasta, setModalPasta] = useState<{ modo: "criar" | "editar"; pasta?: Pasta } | null>(null);
  const [formPasta, setFormPasta] = useState({ nome: "", descricao: "" });
  const [pastaExcluindo, setPastaExcluindo] = useState<Pasta | null>(null);

  // doc — excluir / mover
  const [docExcluindo, setDocExcluindo] = useState<Documento | null>(null);
  const [docMovendo, setDocMovendo] = useState<Documento | null>(null);
  const [pastaDestino, setPastaDestino] = useState<string>("raiz");

  // ─── breadcrumb ────────────────────────────────────────────────────────────

  function caminhoPasta(id: string | null): Pasta[] {
    if (!id) return [];
    const p = pastas.find((p) => p.id === id);
    if (!p) return [];
    return [...caminhoPasta(p.parent_id), p];
  }

  const breadcrumb = caminhoPasta(pastaAtiva);

  // ─── filtro de documentos ──────────────────────────────────────────────────

  const docsFiltrados = docs.filter((d) => {
    const passaPasta = pastaAtiva === null
      ? true  // "Todos" — mostra tudo
      : d.pasta_id === pastaAtiva;
    const passaCategoria = categoria === "TODOS" || d.categoria === categoria;
    const passaBusca = !busca || [d.titulo, d.arquivo_nome, d.descricao ?? ""]
      .some((s) => s.toLowerCase().includes(busca.toLowerCase()));
    return passaPasta && passaCategoria && passaBusca;
  });

  // subpastas visíveis no painel atual
  const subpastasVisiveis = pastas.filter((p) =>
    pastaAtiva === null ? p.parent_id === null : p.parent_id === pastaAtiva
  );

  // ─── upload ────────────────────────────────────────────────────────────────

  const selecionarArquivo = (file: File) => {
    setArquivoSelecionado(file);
    if (!form.titulo) setForm((f) => ({ ...f, titulo: file.name.replace(/\.[^/.]+$/, "") }));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) selecionarArquivo(file);
  }, []);

  const fazerUpload = async () => {
    if (!arquivoSelecionado || !form.titulo) return;
    setUploadando(true);
    setUploadProgresso(0);
    try {
      const { signedUrl, caminho } = await criarUrlUpload({
        arquivo_nome: arquivoSelecionado.name,
        mime_type: arquivoSelecionado.type || "application/octet-stream",
      });

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgresso(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Erro no upload")));
        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", arquivoSelecionado.type || "application/octet-stream");
        xhr.send(arquivoSelecionado);
      });

      const pastaUpload = pastaAtiva ?? undefined;
      const res = await confirmarUpload({
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        categoria: form.categoria,
        caminho,
        arquivo_nome: arquivoSelecionado.name,
        arquivo_tamanho: arquivoSelecionado.size,
        mime_type: arquivoSelecionado.type || "application/octet-stream",
        projeto_id: form.projeto_id || undefined,
        cliente_id: form.cliente_id || undefined,
        contrato_id: form.contrato_id || undefined,
        pasta_id: pastaUpload,
      });

      if (res.ok) {
        const pastaInfo = pastaUpload ? (pastas.find((p) => p.id === pastaUpload) ?? null) : null;
        setDocs((prev) => [{
          ...res.doc,
          criado_em: res.doc.criado_em.toISOString(),
          criador: null, projeto: null, cliente: null, contrato: null,
          pasta: pastaInfo ? { id: pastaInfo.id, nome: pastaInfo.nome } : null,
        }, ...prev]);
        if (pastaUpload) {
          setPastas((prev) => prev.map((p) =>
            p.id === pastaUpload ? { ...p, _count: { ...p._count, documentos: p._count.documentos + 1 } } : p
          ));
        }
        setModalUpload(false);
        setArquivoSelecionado(null);
        setForm({ titulo: "", descricao: "", categoria: "INTERNO", projeto_id: "", cliente_id: "", contrato_id: "" });
        toast.success("Arquivo enviado com sucesso!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar arquivo");
    } finally {
      setUploadando(false);
      setUploadProgresso(0);
    }
  };

  // ─── download ──────────────────────────────────────────────────────────────

  const baixar = async (doc: Documento) => {
    try {
      const { url, nome } = await obterUrlDownload(doc.id);
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.click();
    } catch {
      toast.error("Erro ao gerar link de download");
    }
  };

  // ─── excluir documento ─────────────────────────────────────────────────────

  const confirmarExclusao = () => {
    if (!docExcluindo) return;
    startTransition(async () => {
      const res = await excluirDocumento(docExcluindo.id);
      if (res.ok) {
        if (docExcluindo.pasta_id) {
          setPastas((prev) => prev.map((p) =>
            p.id === docExcluindo.pasta_id ? { ...p, _count: { ...p._count, documentos: p._count.documentos - 1 } } : p
          ));
        }
        setDocs((prev) => prev.filter((d) => d.id !== docExcluindo.id));
        toast.success("Documento excluído");
      } else {
        toast.error(res.error ?? "Erro ao excluir");
      }
      setDocExcluindo(null);
    });
  };

  // ─── pastas — criar/editar/excluir ─────────────────────────────────────────

  const abrirCriarPasta = () => {
    setFormPasta({ nome: "", descricao: "" });
    setModalPasta({ modo: "criar" });
  };

  const abrirEditarPasta = (p: Pasta) => {
    setFormPasta({ nome: p.nome, descricao: p.descricao ?? "" });
    setModalPasta({ modo: "editar", pasta: p });
  };

  const salvarPasta = () => {
    if (!formPasta.nome.trim()) return;
    startTransition(async () => {
      if (modalPasta?.modo === "criar") {
        const res = await criarPasta({
          nome: formPasta.nome,
          descricao: formPasta.descricao || undefined,
          parent_id: pastaAtiva ?? undefined,
        });
        if (res.ok) {
          setPastas((prev) => [...prev, res.pasta]);
          toast.success("Pasta criada");
        }
      } else if (modalPasta?.pasta) {
        const res = await editarPasta(modalPasta.pasta.id, { nome: formPasta.nome, descricao: formPasta.descricao });
        if (res.ok) {
          setPastas((prev) => prev.map((p) =>
            p.id === modalPasta.pasta!.id ? { ...p, nome: formPasta.nome, descricao: formPasta.descricao || null } : p
          ));
          toast.success("Pasta renomeada");
        }
      }
      setModalPasta(null);
    });
  };

  const confirmarExcluirPasta = () => {
    if (!pastaExcluindo) return;
    startTransition(async () => {
      const res = await excluirPasta(pastaExcluindo.id);
      if (res.ok) {
        setPastas((prev) => prev.filter((p) => p.id !== pastaExcluindo.id));
        setDocs((prev) => prev.map((d) => d.pasta_id === pastaExcluindo.id ? { ...d, pasta_id: null, pasta: null } : d));
        if (pastaAtiva === pastaExcluindo.id) setPastaAtiva(pastaExcluindo.parent_id);
        toast.success("Pasta excluída");
      } else {
        toast.error(res.error ?? "Erro ao excluir pasta");
      }
      setPastaExcluindo(null);
    });
  };

  // ─── mover documento ───────────────────────────────────────────────────────

  const confirmarMover = () => {
    if (!docMovendo) return;
    const destino = pastaDestino === "raiz" ? null : pastaDestino;
    startTransition(async () => {
      const res = await moverDocumento(docMovendo.id, destino);
      if (res.ok) {
        const pastaAnt = docMovendo.pasta_id;
        const pastaInfo = destino ? (pastas.find((p) => p.id === destino) ?? null) : null;
        setDocs((prev) => prev.map((d) =>
          d.id === docMovendo.id ? { ...d, pasta_id: destino, pasta: pastaInfo ? { id: pastaInfo.id, nome: pastaInfo.nome } : null } : d
        ));
        setPastas((prev) => prev.map((p) => {
          if (p.id === pastaAnt) return { ...p, _count: { ...p._count, documentos: p._count.documentos - 1 } };
          if (p.id === destino) return { ...p, _count: { ...p._count, documentos: p._count.documentos + 1 } };
          return p;
        }));
        toast.success("Documento movido");
      }
      setDocMovendo(null);
    });
  };

  // ─── render ────────────────────────────────────────────────────────────────

  const pastasRaiz = pastas.filter((p) => p.parent_id === null);

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar de pastas ── */}
      <aside className="w-56 shrink-0 border-r bg-slate-50/60 flex flex-col overflow-y-auto">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-7 h-8 text-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* categorias */}
        <div className="p-2 border-b space-y-0.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoria(c.value as CategoriaDocumento | "TODOS")}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                categoria === c.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* pastas */}
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => setPastaAtiva(null)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              pastaAtiva === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FolderOpen className="size-4 shrink-0" />
            <span className="flex-1 text-left">Todos os arquivos</span>
            <span className="text-[10px]">{docs.length}</span>
          </button>

          {pastasRaiz.length > 0 && <div className="my-1 border-t" />}

          {pastasRaiz.map((p) => (
            <PastaNo key={p.id} pasta={p} todas={pastas} ativa={pastaAtiva} onSelecionar={setPastaAtiva} nivel={0} />
          ))}
        </div>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs justify-start gap-1.5 text-muted-foreground hover:text-foreground h-8"
            onClick={abrirCriarPasta}
          >
            <FolderPlus className="size-3.5" />
            Nova pasta
          </Button>
        </div>
      </aside>

      {/* ── Painel principal ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* cabeçalho */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between gap-4">
          {/* breadcrumb */}
          <div className="flex items-center gap-1 text-sm min-w-0">
            <button
              onClick={() => setPastaAtiva(null)}
              className={`hover:text-primary transition-colors shrink-0 ${pastaAtiva === null ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              Documentos
            </button>
            {breadcrumb.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                <button
                  onClick={() => setPastaAtiva(p.id)}
                  className={`truncate hover:text-primary transition-colors ${i === breadcrumb.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {p.nome}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pastaAtiva && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => abrirEditarPasta(pastas.find((p) => p.id === pastaAtiva)!)}
                >
                  <Pencil className="size-3.5" />
                  Renomear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setPastaExcluindo(pastas.find((p) => p.id === pastaAtiva)!)}
                >
                  <Trash2 className="size-3.5" />
                  Excluir pasta
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={abrirCriarPasta}
            >
              <FolderPlus className="size-3.5" />
              Nova pasta
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => setModalUpload(true)}>
              <Plus className="size-3.5 mr-1" /> Enviar arquivo
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* subpastas */}
          {subpastasVisiveis.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pastas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {subpastasVisiveis.map((p) => (
                  <div key={p.id} className="relative group">
                    <button
                      onClick={() => setPastaAtiva(p.id)}
                      className="w-full flex flex-col items-center gap-2 p-4 rounded-xl border bg-slate-50 hover:bg-primary/5 hover:border-primary/30 transition-all text-sm"
                    >
                      <FolderOpen className="size-10 text-primary/70" />
                      <span className="font-medium text-xs text-center leading-tight line-clamp-2">{p.nome}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p._count.documentos} arq{p._count.documentos !== 1 ? "." : "."}
                        {p._count.filhos > 0 && ` · ${p._count.filhos} pasta${p._count.filhos !== 1 ? "s" : ""}`}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirEditarPasta(p)}>
                          <Pencil className="size-3.5 mr-2" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPastaExcluindo(p)}
                        >
                          <Trash2 className="size-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* documentos */}
          {docsFiltrados.length === 0 && subpastasVisiveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FolderOpen className="size-12 mb-3 opacity-30" />
              <p className="text-sm">
                {pastaAtiva ? "Pasta vazia" : "Nenhum documento encontrado"}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setModalUpload(true)}>
                <Upload className="size-4 mr-1.5" /> Enviar primeiro arquivo
              </Button>
            </div>
          ) : docsFiltrados.length > 0 ? (
            <section className="space-y-2">
              {subpastasVisiveis.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Arquivos</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {docsFiltrados.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-background border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between">
                      {iconeArquivo(doc.mime_type)}
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CAT_CORES[doc.categoria]}`}>
                          {CATEGORIAS.find((c) => c.value === doc.categoria)?.label}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="size-6 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-muted">
                            <MoreHorizontal className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => baixar(doc)}>
                              <Download className="size-3.5 mr-2" /> Baixar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setPastaDestino(doc.pasta_id ?? "raiz"); setDocMovendo(doc); }}>
                              <FolderInput className="size-3.5 mr-2" /> Mover para pasta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDocExcluindo(doc)}
                            >
                              <Trash2 className="size-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium text-sm leading-tight line-clamp-2">{doc.titulo}</p>
                      {doc.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.descricao}</p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="truncate">{doc.arquivo_nome}</p>
                      <p>{formatBytes(doc.arquivo_tamanho)}</p>
                      {doc.pasta && pastaAtiva === null && (
                        <p className="truncate text-primary/70">📁 {doc.pasta.nome}</p>
                      )}
                    </div>

                    <div className="flex gap-1 pt-1">
                      <Button size="icon" variant="ghost" className="size-7" title="Baixar" onClick={() => baixar(doc)}>
                        <Download className="size-3.5" />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                      {doc.criador && ` · ${doc.criador.nome}`}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      {/* ── Modal upload ── */}
      <Dialog open={modalUpload} onOpenChange={(v) => { if (!uploadando) { setModalUpload(v); if (!v) { setArquivoSelecionado(null); setForm({ titulo: "", descricao: "", categoria: "INTERNO", projeto_id: "", cliente_id: "", contrato_id: "" }); } } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Enviar arquivo
              {pastaAtiva && <span className="text-sm font-normal text-muted-foreground ml-2">→ {pastas.find((p) => p.id === pastaAtiva)?.nome}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputFileRef.current?.click()}
            >
              <input ref={inputFileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) selecionarArquivo(f); }} />
              {arquivoSelecionado ? (
                <div className="flex items-center justify-center gap-3">
                  {iconeArquivo(arquivoSelecionado.type)}
                  <div className="text-left">
                    <p className="font-medium text-sm">{arquivoSelecionado.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(arquivoSelecionado.size)}</p>
                  </div>
                  <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setArquivoSelecionado(null); }}>
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, imagens, documentos, planilhas…</p>
                </>
              )}
            </div>

            {uploadando && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enviando…</span><span>{uploadProgresso}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgresso}%` }} />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input placeholder="Nome do documento" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea placeholder="Descrição opcional..." rows={2} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as CategoriaDocumento }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.filter((c) => c.value !== "TODOS").map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Select value={form.cliente_id} onValueChange={(v: string | null) => setForm((f) => ({ ...f, cliente_id: !v || v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Projeto</Label>
                  <Select value={form.projeto_id} onValueChange={(v: string | null) => setForm((f) => ({ ...f, projeto_id: !v || v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contrato</Label>
                  <Select value={form.contrato_id} onValueChange={(v: string | null) => setForm((f) => ({ ...f, contrato_id: !v || v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contratos.map((c) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalUpload(false)} disabled={uploadando}>Cancelar</Button>
            <Button onClick={fazerUpload} disabled={!arquivoSelecionado || !form.titulo || uploadando}>
              {uploadando ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Enviando…</> : <><Upload className="size-4 mr-1.5" />Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal criar/editar pasta ── */}
      <Dialog open={!!modalPasta} onOpenChange={(v) => { if (!v) setModalPasta(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modalPasta?.modo === "criar" ? "Nova pasta" : "Renomear pasta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                autoFocus
                placeholder="Ex: Relatórios 2026"
                value={formPasta.nome}
                onChange={(e) => setFormPasta((f) => ({ ...f, nome: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && salvarPasta()}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                placeholder="Opcional"
                value={formPasta.descricao}
                onChange={(e) => setFormPasta((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            {modalPasta?.modo === "criar" && pastaAtiva && (
              <p className="text-xs text-muted-foreground">
                Será criada dentro de <strong>{pastas.find((p) => p.id === pastaAtiva)?.nome}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPasta(null)}>Cancelar</Button>
            <Button onClick={salvarPasta} disabled={!formPasta.nome.trim() || isPending}>
              {modalPasta?.modo === "criar" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal mover documento ── */}
      <Dialog open={!!docMovendo} onOpenChange={(v) => { if (!v) setDocMovendo(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="size-4 text-primary" />
              Mover arquivo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground truncate">
              <strong>{docMovendo?.titulo}</strong>
            </p>
            <div>
              <Label>Destino</Label>
              <Select value={pastaDestino} onValueChange={(v) => setPastaDestino(v ?? "raiz")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raiz">— Raiz (sem pasta)</SelectItem>
                  {pastas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.parent_id ? `  └ ${p.nome}` : p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocMovendo(null)}>Cancelar</Button>
            <Button onClick={confirmarMover} disabled={isPending}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar exclusão de documento ── */}
      <AlertDialog open={!!docExcluindo} onOpenChange={(v) => { if (!v) setDocExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo <strong>{docExcluindo?.titulo}</strong> será removido permanentemente do storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmarExclusao} disabled={isPending}>
              {isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmar exclusão de pasta ── */}
      <AlertDialog open={!!pastaExcluindo} onOpenChange={(v) => { if (!v) setPastaExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              A pasta <strong>{pastaExcluindo?.nome}</strong> será excluída. Os arquivos dentro dela não serão apagados — apenas perderão o vínculo com a pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmarExcluirPasta} disabled={isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
