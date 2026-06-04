"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  FolderOpen, Upload, Search, Download, Trash2, FileText,
  FileImage, FileVideo, FileArchive, File, X, Eye, Filter,
  Loader2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { criarUrlUpload, confirmarUpload, excluirDocumento, obterUrlDownload } from "@/actions/documentos";
import { CategoriaDocumento } from "@/lib/generated/prisma";

// ─── tipos ────────────────────────────────────────────────────────────────────

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
  criador: { id: string; nome: string; avatar_url: string | null } | null;
  projeto: { id: string; titulo: string } | null;
  cliente: { id: string; nome: string } | null;
  contrato: { id: string; titulo: string } | null;
};

type Props = {
  documentos: Documento[];
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
  if (mime.startsWith("image/"))  return <FileImage className="size-8 text-blue-400" />;
  if (mime.startsWith("video/"))  return <FileVideo className="size-8 text-purple-400" />;
  if (mime.includes("pdf"))       return <FileText className="size-8 text-red-400" />;
  if (mime.includes("zip") || mime.includes("rar")) return <FileArchive className="size-8 text-orange-400" />;
  return <File className="size-8 text-slate-400" />;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function DocumentosClient({ documentos: inicial, clientes, projetos, contratos }: Props) {
  const [docs, setDocs] = useState(inicial);
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

  // exclusão
  const [docExcluindo, setDocExcluindo] = useState<Documento | null>(null);

  // ─── filtro ────────────────────────────────────────────────────────────────

  const docsFiltrados = docs.filter((d) => {
    const passaCategoria = categoria === "TODOS" || d.categoria === categoria;
    const passaBusca = !busca || [d.titulo, d.arquivo_nome, d.descricao ?? ""]
      .some((s) => s.toLowerCase().includes(busca.toLowerCase()));
    return passaCategoria && passaBusca;
  });

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

      // Upload direto para o Supabase Storage via URL assinada
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
      });

      if (res.ok) {
        setDocs((prev) => [{ ...res.doc, criado_em: res.doc.criado_em.toISOString(), criador: null, projeto: null, cliente: null, contrato: null }, ...prev]);
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
      a.href = url;
      a.download = nome;
      a.click();
    } catch {
      toast.error("Erro ao gerar link de download");
    }
  };

  // ─── exclusão ──────────────────────────────────────────────────────────────

  const confirmarExclusao = () => {
    if (!docExcluindo) return;
    startTransition(async () => {
      const res = await excluirDocumento(docExcluindo.id);
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== docExcluindo.id));
        toast.success("Documento excluído");
      } else {
        toast.error(res.error ?? "Erro ao excluir");
      }
      setDocExcluindo(null);
    });
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Documentos</h1>
          <Badge variant="secondary">{docs.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setModalUpload(true)}>
          <Plus className="size-4 mr-1.5" /> Enviar arquivo
        </Button>
      </div>

      {/* filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou título..."
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIAS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoria(c.value as CategoriaDocumento | "TODOS")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoria === c.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* grid de arquivos */}
      {docsFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="size-12 mb-3 opacity-30" />
          <p className="text-sm">Nenhum documento encontrado</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setModalUpload(true)}>
            <Upload className="size-4 mr-1.5" /> Enviar primeiro arquivo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {docsFiltrados.map((doc) => (
            <div
              key={doc.id}
              className="bg-background border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                {iconeArquivo(doc.mime_type)}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_CORES[doc.categoria]}`}>
                  {CATEGORIAS.find((c) => c.value === doc.categoria)?.label}
                </span>
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
                {doc.projeto && <p className="truncate">Projeto: {doc.projeto.titulo}</p>}
                {doc.cliente && <p className="truncate">Cliente: {doc.cliente.nome}</p>}
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon" variant="ghost" className="size-7"
                  title="Baixar"
                  onClick={() => baixar(doc)}
                >
                  <Download className="size-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() => setDocExcluindo(doc)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                {doc.criador && ` · ${doc.criador.nome}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* modal de upload */}
      <Dialog open={modalUpload} onOpenChange={(v) => { if (!uploadando) { setModalUpload(v); if (!v) { setArquivoSelecionado(null); setForm({ titulo: "", descricao: "", categoria: "INTERNO", projeto_id: "", cliente_id: "", contrato_id: "" }); } } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar arquivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputFileRef.current?.click()}
            >
              <input
                ref={inputFileRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selecionarArquivo(f); }}
              />
              {arquivoSelecionado ? (
                <div className="flex items-center justify-center gap-3">
                  {iconeArquivo(arquivoSelecionado.type)}
                  <div className="text-left">
                    <p className="font-medium text-sm">{arquivoSelecionado.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(arquivoSelecionado.size)}</p>
                  </div>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); setArquivoSelecionado(null); }}
                  >
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

            {/* metadados */}
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input
                  placeholder="Nome do documento"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descrição opcional..."
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as CategoriaDocumento }))}>
                    <SelectTrigger>
                      <SelectValue>
                        {(value: string | null) => value ? (CATEGORIAS.find((c) => c.value === value)?.label ?? value) : undefined}
                      </SelectValue>
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum">
                        {(value: string | null) => value && value !== "none" ? (clientes.find((c) => c.id === value)?.nome ?? value) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Projeto</Label>
                  <Select value={form.projeto_id} onValueChange={(v: string | null) => setForm((f) => ({ ...f, projeto_id: !v || v === "none" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum">
                        {(value: string | null) => value && value !== "none" ? (projetos.find((p) => p.id === value)?.titulo ?? value) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Contrato</Label>
                  <Select value={form.contrato_id} onValueChange={(v: string | null) => setForm((f) => ({ ...f, contrato_id: !v || v === "none" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum">
                        {(value: string | null) => value && value !== "none" ? (contratos.find((c) => c.id === value)?.titulo ?? value) : undefined}
                      </SelectValue>
                    </SelectTrigger>
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
            <Button variant="outline" onClick={() => setModalUpload(false)} disabled={uploadando}>
              Cancelar
            </Button>
            <Button onClick={fazerUpload} disabled={!arquivoSelecionado || !form.titulo || uploadando}>
              {uploadando ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Enviando…</> : <><Upload className="size-4 mr-1.5" />Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmação de exclusão */}
      <AlertDialog open={!!docExcluindo} onOpenChange={(v) => { if (!v) setDocExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo <strong>{docExcluindo?.titulo}</strong> será removido permanentemente do storage. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmarExclusao}
              disabled={isPending}
            >
              {isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
