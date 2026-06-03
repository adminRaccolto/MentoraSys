"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Building2, User, Upload, Trash2, ImageIcon, Loader2, Users, UserPlus, Mail, MoreVertical, X, ShieldCheck, Plus, Check, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  atualizarEmpresa,
  removerLogo,
  atualizarPerfil,
  salvarLogoUrl,
  salvarAvatarUrl,
  uploadLogoAction,
  uploadAvatarAction,
} from "@/actions/configuracoes";
import { convidarMembro, removerMembro, alterarPerfilMembro, cancelarConvite, criarUsuarioDireto } from "@/actions/equipe";
import { criarPerfil, editarPerfil, excluirPerfil } from "@/actions/perfis";
import { criarEmpresa } from "@/actions/empresas";

const RECURSOS = [
  { key: "clientes", label: "Clientes" },
  { key: "servicos", label: "Serviços" },
  { key: "crm", label: "CRM" },
  { key: "propostas", label: "Propostas" },
  { key: "contratos", label: "Contratos" },
  { key: "projetos", label: "Projetos" },
  { key: "modelos", label: "Modelos" },
  { key: "agenda", label: "Agenda" },
  { key: "financeiro", label: "Financeiro" },
  { key: "faturamento", label: "Faturamento" },
  { key: "diagnosticos", label: "Diagnósticos" },
  { key: "configuracoes", label: "Configurações" },
] as const;

const ACOES = ["criar", "editar", "excluir"] as const;

const schemaEmpresa = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
  nome_fantasia: z.string().optional(),
  razao_social: z.string().optional(),
  telefone: z.string().optional(),
  email_contato: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  site: z.string().optional(),
  representante: z.string().optional(),
  representante_cargo: z.string().optional(),
  representante_cpf: z.string().optional(),
});

const schemaPerfil = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
});

type EmpresaForm = z.input<typeof schemaEmpresa>;
type PerfilForm = z.input<typeof schemaPerfil>;

interface MembroItem {
  id: string;
  ativo: boolean;
  usuario: { id: string; nome: string; email: string; avatar_url: string | null };
  perfil: { id: string; nome: string };
}

interface ConvitePendente {
  id: string;
  email: string;
  criado_em: string;
  expira_em: string;
}

interface PerfilItem {
  id: string;
  nome: string;
  descricao: string;
  membros: number;
  permissoes: { recurso: string; acao: string }[];
}

interface Props {
  empresa: {
    id: string;
    nome: string;
    cnpj: string;
    logo_url: string;
    plano: string;
    nome_fantasia: string;
    razao_social: string;
    telefone: string;
    email_contato: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    site: string;
    representante: string;
    representante_cargo: string;
    representante_cpf: string;
  };
  usuario: {
    id: string;
    nome: string;
    email: string;
    avatar_url: string;
  } | null;
  membros: MembroItem[];
  perfis: PerfilItem[];
  convitesPendentes: ConvitePendente[];
  usuarioAtualId: string | null;
  empresaAtualId: string;
  minhasEmpresas: { id: string; nome: string; logo_url: string | null; plano: string }[];
}

const PLANO_LABELS: Record<string, string> = {
  BASICO: "Básico",
  PROFISSIONAL: "Profissional",
  ENTERPRISE: "Enterprise",
};

const PLANO_COLORS: Record<string, string> = {
  BASICO: "bg-slate-100 text-slate-700",
  PROFISSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE: "bg-amber-100 text-amber-700",
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function UrlLogoInput({ currentUrl }: { currentUrl: string }) {
  const [url, setUrl] = useState(currentUrl);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await salvarLogoUrl(url.trim());
      toast.success("URL da logo salva!");
    } catch {
      toast.error("Erro ao salvar URL");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Ou cole aqui a URL pública da logo (ex: do Supabase Storage)"
        className="h-8 text-xs text-muted-foreground"
      />
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={saving || url === currentUrl} onClick={handleSave}>
        {saving ? "..." : "Usar esta URL"}
      </Button>
    </div>
  );
}

function ImageUploadZone({
  currentUrl,
  uploadAction,
  onRemove,
  label,
  shape = "square",
}: {
  currentUrl: string;
  uploadAction: (formData: FormData) => Promise<{ ok: boolean; url?: string; error?: string }>;
  onRemove: () => Promise<void>;
  label: string;
  shape?: "square" | "circle";
}) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (PNG, JPG, SVG ou WebP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadAction(formData);
      if (!res.ok) throw new Error(res.error ?? "Erro no upload");
      const urlComCache = `${res.url}?t=${Date.now()}`;
      setPreviewUrl(urlComCache);
      toast.success(`${label} atualizada!`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setPreviewUrl("");
    await onRemove();
    toast.success(`${label} removida`);
  };

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-start gap-4">
      <div
        className={`relative flex-shrink-0 ${shapeClass} border-2 border-dashed border-border bg-muted/30 overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center`}
        style={{ width: shape === "circle" ? 80 : 160, height: shape === "circle" ? 80 : 80 }}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          <Image
            src={previewUrl}
            alt={label}
            fill
            className="object-contain p-2"
            unoptimized
          />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground/50" />
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      <div className="space-y-2 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">PNG, JPG, SVG ou WebP · máx. 2 MB</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3 mr-1" />
            {previewUrl ? "Trocar" : "Enviar"}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              <Trash2 className="size-3 mr-1" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesClient({ empresa, usuario, membros: membrosInicial, perfis: perfisInicial, convitesPendentes: convitesInicial, usuarioAtualId, empresaAtualId, minhasEmpresas: minhasEmpresasInicial }: Props) {
  const [isPendingEmpresa, startEmpresa] = useTransition();
  const [isPendingPerfil, startPerfil] = useTransition();

  // Equipe
  const [membros, setMembros] = useState(membrosInicial);
  const [convitesPendentes, setConvitesPendentes] = useState(convitesInicial);
  const [conviteEmail, setConviteEmail] = useState("");
  const [convitePerfilId, setConvitePerfilId] = useState(perfisInicial[0]?.id ?? "");
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | null>(null);
  const [linkConviteGerado, setLinkConviteGerado] = useState<string | null>(null);
  const [abaEquipe, setAbaEquipe] = useState<"convite" | "direto">("direto");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoPerfilId, setNovoPerfilId] = useState(perfisInicial[0]?.id ?? "");

  // Perfis de Acesso
  const [perfis, setPerfis] = useState(perfisInicial);
  const [perfilEditando, setPerfilEditando] = useState<PerfilItem | null>(null);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [nomePerfil, setNomePerfil] = useState("");
  const [descricaoPerfil, setDescricaoPerfil] = useState("");
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<Set<string>>(new Set());
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  // Empresas
  const [minhasEmpresas, setMinhasEmpresas] = useState(minhasEmpresasInicial);
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");
  const [cnpjNovaEmpresa, setCnpjNovaEmpresa] = useState("");
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

  const abrirModalPerfil = (p?: PerfilItem) => {
    if (p) {
      setPerfilEditando(p);
      setNomePerfil(p.nome);
      setDescricaoPerfil(p.descricao);
      setPermissoesSelecionadas(new Set(p.permissoes.map((x) => `${x.recurso}:${x.acao}`)));
    } else {
      setPerfilEditando(null);
      setNomePerfil("");
      setDescricaoPerfil("");
      setPermissoesSelecionadas(new Set());
    }
    setErroPerfil(null);
    setModalPerfilAberto(true);
  };

  const togglePermissao = (recurso: string, acao: string) => {
    const key = `${recurso}:${acao}`;
    setPermissoesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleRecurso = (recurso: string) => {
    const todasAcoes = ACOES.map((a) => `${recurso}:${a}`);
    const todasMarcadas = todasAcoes.every((k) => permissoesSelecionadas.has(k));
    setPermissoesSelecionadas((prev) => {
      const next = new Set(prev);
      if (todasMarcadas) { todasAcoes.forEach((k) => next.delete(k)); }
      else { todasAcoes.forEach((k) => next.add(k)); }
      return next;
    });
  };

  const salvarPerfil = async () => {
    if (!nomePerfil.trim()) { setErroPerfil("Nome obrigatório"); return; }
    setSalvandoPerfil(true);
    setErroPerfil(null);
    const permissoes = Array.from(permissoesSelecionadas).map((k) => {
      const [recurso, acao] = k.split(":");
      return { recurso, acao };
    });
    try {
      if (perfilEditando) {
        const res = await editarPerfil(perfilEditando.id, { nome: nomePerfil, descricao: descricaoPerfil, permissoes });
        if (res.ok) {
          setPerfis((prev) => prev.map((p) => p.id === perfilEditando.id
            ? { ...p, nome: nomePerfil, descricao: descricaoPerfil, permissoes }
            : p
          ));
          toast.success("Perfil atualizado");
          setModalPerfilAberto(false);
        } else { setErroPerfil(res.error); }
      } else {
        const res = await criarPerfil({ nome: nomePerfil, descricao: descricaoPerfil, permissoes });
        if (res.ok) {
          setPerfis((prev) => [...prev, { id: res.id, nome: nomePerfil, descricao: descricaoPerfil, membros: 0, permissoes }]);
          toast.success("Perfil criado");
          setModalPerfilAberto(false);
        }
      }
    } catch { setErroPerfil("Erro ao salvar perfil"); }
    finally { setSalvandoPerfil(false); }
  };

  const formEmpresa = useForm<EmpresaForm>({
    resolver: zodResolver(schemaEmpresa),
    defaultValues: {
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      nome_fantasia: empresa.nome_fantasia,
      razao_social: empresa.razao_social,
      telefone: empresa.telefone,
      email_contato: empresa.email_contato,
      endereco: empresa.endereco,
      cidade: empresa.cidade,
      estado: empresa.estado,
      cep: empresa.cep,
      site: empresa.site,
      representante: empresa.representante,
      representante_cargo: empresa.representante_cargo,
      representante_cpf: empresa.representante_cpf,
    },
  });

  const formPerfil = useForm<PerfilForm>({
    resolver: zodResolver(schemaPerfil),
    defaultValues: { nome: usuario?.nome ?? "" },
  });

  const onSubmitEmpresa = formEmpresa.handleSubmit((data) => {
    startEmpresa(async () => {
      try {
        await atualizarEmpresa(data);
        toast.success("Dados da empresa atualizados");
      } catch {
        toast.error("Erro ao salvar dados da empresa");
      }
    });
  });

  const onSubmitPerfil = formPerfil.handleSubmit((data) => {
    startPerfil(async () => {
      try {
        await atualizarPerfil(data);
        toast.success("Perfil atualizado");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar perfil");
      }
    });
  });

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Configurações</h1>
      </div>

      {/* ── Dados da empresa ── */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <h2 className="font-semibold">Dados da Empresa</h2>
          <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLANO_COLORS[empresa.plano] ?? "bg-slate-100 text-slate-700"}`}>
            {PLANO_LABELS[empresa.plano] ?? empresa.plano}
          </span>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Logo da Empresa</Label>
            <ImageUploadZone
              currentUrl={empresa.logo_url}
              uploadAction={uploadLogoAction}
              onRemove={async () => { await removerLogo(); }}
              label="Logo"
              shape="square"
            />
            <UrlLogoInput currentUrl={empresa.logo_url} />
          </div>

          <Separator />

          <form onSubmit={onSubmitEmpresa} className="space-y-6">
            {/* Identificação */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Identificação</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Razão Social *" error={formEmpresa.formState.errors.nome?.message}>
                  <Input {...formEmpresa.register("nome")} className="h-9 text-sm" placeholder="Nome jurídico completo" />
                </Field>
                <Field label="Nome Fantasia">
                  <Input {...formEmpresa.register("nome_fantasia")} className="h-9 text-sm" placeholder="Como a empresa é conhecida" />
                </Field>
                <Field label="CNPJ">
                  <Input {...formEmpresa.register("cnpj")} className="h-9 text-sm" placeholder="00.000.000/0001-00" />
                </Field>
                <Field label="Site">
                  <Input {...formEmpresa.register("site")} className="h-9 text-sm" placeholder="https://www.empresa.com" />
                </Field>
              </div>
            </div>

            {/* Representante legal */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Representante Legal <span className="text-muted-foreground normal-case font-normal">(usado nos documentos)</span></p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do representante">
                  <Input {...formEmpresa.register("representante")} className="h-9 text-sm" placeholder="Nome completo" />
                </Field>
                <Field label="CPF do representante">
                  <Input {...formEmpresa.register("representante_cpf")} className="h-9 text-sm" placeholder="000.000.000-00" />
                </Field>
                <div className="col-span-2">
                  <Field label="Cargo / Qualidade">
                    <Input {...formEmpresa.register("representante_cargo")} className="h-9 text-sm" placeholder="Ex: Sócio Administrador" />
                  </Field>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Contato e Endereço</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefone / Celular">
                  <Input {...formEmpresa.register("telefone")} className="h-9 text-sm" placeholder="(xx) 9xxxx-xxxx" />
                </Field>
                <Field label="E-mail de contato">
                  <Input {...formEmpresa.register("email_contato")} type="email" className="h-9 text-sm" placeholder="contato@empresa.com" />
                </Field>
                <div className="col-span-2">
                  <Field label="Endereço completo">
                    <Input {...formEmpresa.register("endereco")} className="h-9 text-sm" placeholder="Rua, nº, complemento, bairro" />
                  </Field>
                </div>
                <Field label="Cidade">
                  <Input {...formEmpresa.register("cidade")} className="h-9 text-sm" />
                </Field>
                <Field label="Estado (UF)">
                  <Input {...formEmpresa.register("estado")} className="h-9 text-sm" placeholder="MT" maxLength={2} />
                </Field>
                <Field label="CEP">
                  <Input {...formEmpresa.register("cep")} className="h-9 text-sm" placeholder="00000-000" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPendingEmpresa}>
                {isPendingEmpresa ? "Salvando..." : "Salvar dados da empresa"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Meu perfil ── */}
      {usuario && (
        <section className="rounded-xl border bg-card">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <User className="size-4 text-primary" />
            <h2 className="font-semibold">Meu Perfil</h2>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Avatar */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Foto de perfil</Label>
              <ImageUploadZone
                currentUrl={usuario.avatar_url}
                uploadAction={uploadAvatarAction}
                onRemove={async () => { await salvarAvatarUrl(""); }}
                label="Avatar"
                shape="circle"
              />
            </div>

            <Separator />

            <form onSubmit={onSubmitPerfil} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome completo *" error={formPerfil.formState.errors.nome?.message}>
                  <Input {...formPerfil.register("nome")} className="h-9 text-sm" />
                </Field>
                <Field label="E-mail (somente leitura)">
                  <Input value={usuario.email} disabled className="h-9 text-sm bg-muted" />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isPendingPerfil}>
                  {isPendingPerfil ? "Salvando..." : "Salvar perfil"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ── Equipe ── */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-semibold">Equipe</h2>
          <span className="ml-auto text-xs text-muted-foreground">{membros.length} membro{membros.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Lista de membros */}
          <div className="space-y-2">
            {membros.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                  {m.usuario.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.usuario.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.usuario.email}</p>
                </div>
                <Select
                  value={m.perfil.id}
                  onValueChange={async (perfilId) => {
                    if (!perfilId) return;
                    const res = await alterarPerfilMembro(m.id, perfilId);
                    if (res.ok) {
                      const nomePerfil = perfis.find(p => p.id === perfilId)?.nome ?? "";
                      setMembros(prev => prev.map(x => x.id === m.id ? { ...x, perfil: { id: perfilId, nome: nomePerfil } } : x));
                      toast.success("Perfil alterado");
                    }
                  }}
                  disabled={m.usuario.id === usuarioAtualId}
                >
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {m.usuario.id !== usuarioAtualId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent transition-colors shrink-0">
                      <MoreVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive text-xs"
                        onClick={async () => {
                          const res = await removerMembro(m.id);
                          if (res.ok) {
                            setMembros(prev => prev.filter(x => x.id !== m.id));
                            toast.success("Membro removido");
                          } else {
                            toast.error(res.error);
                          }
                        }}
                      >
                        Remover da empresa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {m.usuario.id === usuarioAtualId && <div className="size-7 shrink-0" />}
              </div>
            ))}
          </div>

          {/* Convites pendentes */}
          {convitesPendentes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Convites pendentes</p>
                {convitesPendentes.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-1.5">
                    <Mail className="size-4 text-muted-foreground shrink-0" />
                    <p className="text-sm flex-1">{c.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        const res = await cancelarConvite(c.id);
                        if (res.ok) {
                          setConvitesPendentes(prev => prev.filter(x => x.id !== c.id));
                          toast.success("Convite cancelado");
                        }
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Adicionar membro */}
          <div className="space-y-3">
            <div className="flex gap-1 border-b">
              {([
                { key: "direto", label: "Criar usuário" },
                { key: "convite", label: "Enviar convite" },
              ] as { key: "direto" | "convite"; label: string }[]).map(a => (
                <button
                  key={a.key}
                  onClick={() => setAbaEquipe(a.key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    abaEquipe === a.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Criar usuário diretamente */}
            {abaEquipe === "direto" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Cria a conta imediatamente. O usuário já pode fazer login com as credenciais definidas.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Nome *</label>
                    <Input placeholder="Nome completo" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">E-mail *</label>
                    <Input type="email" placeholder="email@exemplo.com" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Senha inicial *</label>
                    <Input type="password" placeholder="Mínimo 8 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Perfil *</label>
                    <Select value={novoPerfilId} onValueChange={v => { if (v) setNovoPerfilId(v); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {perfis.map(p => <SelectItem key={p.id} value={p.id} className="text-sm">{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={criando || !novoNome || !novoEmail || !novaSenha || !novoPerfilId}
                    onClick={async () => {
                      setErroCriar(null);
                      setCriando(true);
                      try {
                        const res = await criarUsuarioDireto({ nome: novoNome, email: novoEmail, senha: novaSenha, perfil_id: novoPerfilId });
                        if (res.ok) {
                          toast.success(`Usuário ${novoEmail} criado com sucesso`);
                          setNovoNome(""); setNovoEmail(""); setNovaSenha("");
                        } else {
                          setErroCriar(res.error);
                        }
                      } catch (e: unknown) {
                        setErroCriar(e instanceof Error ? e.message : "Erro ao criar usuário");
                      } finally {
                        setCriando(false);
                      }
                    }}
                  >
                    <UserPlus className="size-3.5" />
                    {criando ? "Criando..." : "Criar usuário"}
                  </Button>
                  {erroCriar && <p className="text-xs text-destructive">{erroCriar}</p>}
                </div>
              </div>
            )}

            {/* Convidar por link/email */}
            {abaEquipe === "convite" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Gera um link de convite válido por 7 dias. O usuário define a própria senha ao aceitar.</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={conviteEmail}
                    onChange={(e) => setConviteEmail(e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                  <Select value={convitePerfilId} onValueChange={(v) => { if (v) setConvitePerfilId(v); }}>
                    <SelectTrigger className="h-9 text-sm w-36">
                      <SelectValue placeholder="Perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm">{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 shrink-0"
                    disabled={enviandoConvite || !conviteEmail || !convitePerfilId}
                    onClick={async () => {
                      setErroConvite(null);
                      setLinkConviteGerado(null);
                      setEnviandoConvite(true);
                      try {
                        const res = await convidarMembro({ email: conviteEmail, perfil_id: convitePerfilId });
                        if (res.ok) {
                          const expira = new Date();
                          expira.setDate(expira.getDate() + 7);
                          setConvitesPendentes(prev => [...prev, {
                            id: Date.now().toString(),
                            email: conviteEmail,
                            criado_em: new Date().toISOString(),
                            expira_em: expira.toISOString(),
                          }]);
                          setConviteEmail("");
                          if (res.emailEnviado) {
                            toast.success(`Convite enviado por e-mail para ${conviteEmail}`);
                          } else {
                            setLinkConviteGerado(res.link ?? null);
                            setErroConvite(`E-mail não pôde ser enviado (${res.emailErro ?? "RESEND_EMAIL_API_KEY não configurada"}). Compartilhe o link abaixo:`);
                            toast.info("Convite criado — copie o link de acesso.");
                          }
                        } else {
                          setErroConvite(res.error);
                        }
                      } catch (e: unknown) {
                        setErroConvite(e instanceof Error ? e.message : "Erro ao enviar convite");
                      } finally {
                        setEnviandoConvite(false);
                      }
                    }}
                  >
                    <UserPlus className="size-3.5" />
                    {enviandoConvite ? "Enviando..." : "Convidar"}
                  </Button>
                </div>
                {erroConvite && <p className="text-xs text-destructive">{erroConvite}</p>}
                {linkConviteGerado && (
                  <div className="flex items-center gap-2 p-2 rounded bg-muted border text-xs">
                    <span className="truncate flex-1 font-mono text-muted-foreground">{linkConviteGerado}</span>
                    <button
                      className="shrink-0 text-primary hover:underline font-medium"
                      onClick={() => { navigator.clipboard.writeText(linkConviteGerado); toast.success("Link copiado!"); }}
                    >
                      Copiar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Perfis de Acesso ── */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-semibold">Perfis de Acesso</h2>
          <span className="ml-auto text-xs text-muted-foreground">{perfis.length} perfil{perfis.length !== 1 ? "s" : ""}</span>
          <Button size="sm" variant="outline" className="ml-2 h-7 text-xs gap-1" onClick={() => abrirModalPerfil()}>
            <Plus className="size-3" />
            Novo perfil
          </Button>
        </div>

        <div className="divide-y">
          {perfis.map((p) => (
            <div key={p.id} className="px-6 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.nome}</p>
                {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.permissoes.length} permissão{p.permissoes.length !== 1 ? "ões" : ""} · {p.membros} membro{p.membros !== 1 ? "s" : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => abrirModalPerfil(p)}>
                Editar
                <ChevronRight className="size-3" />
              </Button>
              {p.membros === 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  title="Excluir perfil"
                  onClick={async () => {
                    const res = await excluirPerfil(p.id);
                    if (res.ok) {
                      setPerfis((prev) => prev.filter((x) => x.id !== p.id));
                      toast.success("Perfil excluído");
                    } else {
                      toast.error(res.error);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Minhas Empresas ── */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <h2 className="font-semibold">Minhas Empresas</h2>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="space-y-2">
            {minhasEmpresas.map((e) => (
              <div key={e.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg border ${e.id === empresaAtualId ? "border-primary/30 bg-primary/5" : "border-transparent"}`}>
                <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {e.logo_url
                    ? <img src={e.logo_url} alt={e.nome} className="size-full object-contain rounded-md p-1" />
                    : <Building2 className="size-4 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.nome}</p>
                  <p className="text-xs text-muted-foreground">{PLANO_LABELS[e.plano] ?? e.plano}</p>
                </div>
                {e.id === empresaAtualId && (
                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                    <Check className="size-3" />
                    Ativa
                  </span>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {!criandoEmpresa ? (
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={() => setCriandoEmpresa(true)}>
              <Plus className="size-4" />
              Cadastrar nova empresa
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nova empresa</p>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => { setCriandoEmpresa(false); setNomeNovaEmpresa(""); setCnpjNovaEmpresa(""); }}>
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Razão Social / Nome *"
                  value={nomeNovaEmpresa}
                  onChange={(e) => setNomeNovaEmpresa(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="CNPJ (opcional)"
                  value={cnpjNovaEmpresa}
                  onChange={(e) => setCnpjNovaEmpresa(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                className="w-full"
                disabled={salvandoEmpresa || !nomeNovaEmpresa.trim()}
                onClick={async () => {
                  setSalvandoEmpresa(true);
                  try {
                    const res = await criarEmpresa({ nome: nomeNovaEmpresa, cnpj: cnpjNovaEmpresa || undefined });
                    if (res.ok) {
                      toast.success("Empresa criada! Acesse via Selecionar Empresa.");
                      setMinhasEmpresas((prev) => [...prev, { id: res.empresaId, nome: nomeNovaEmpresa, logo_url: null, plano: "BASICO" }]);
                      setCriandoEmpresa(false);
                      setNomeNovaEmpresa("");
                      setCnpjNovaEmpresa("");
                    }
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Erro ao criar empresa");
                  } finally {
                    setSalvandoEmpresa(false);
                  }
                }}
              >
                {salvandoEmpresa ? "Criando..." : "Criar empresa"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Modal perfil */}
      {modalPerfilAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">{perfilEditando ? `Editar perfil — ${perfilEditando.nome}` : "Novo perfil"}</h2>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setModalPerfilAberto(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Nome e descrição */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome do perfil *</Label>
                  <Input value={nomePerfil} onChange={(e) => setNomePerfil(e.target.value)} placeholder="Ex: Analista Financeiro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input value={descricaoPerfil} onChange={(e) => setDescricaoPerfil(e.target.value)} placeholder="Breve descrição do perfil" />
                </div>
              </div>

              {/* Grade de permissões */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissões</p>
                <div className="rounded-xl border overflow-hidden">
                  {/* Cabeçalho */}
                  <div className="grid grid-cols-[1fr_80px_80px_80px_60px] bg-muted/50 border-b px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Módulo</span>
                    {ACOES.map((a) => (
                      <span key={a} className="text-xs font-medium text-muted-foreground text-center capitalize">{a}</span>
                    ))}
                    <span className="text-xs font-medium text-muted-foreground text-center">Todos</span>
                  </div>
                  {/* Linhas */}
                  {RECURSOS.map(({ key, label }) => {
                    const todasMarcadas = ACOES.every((a) => permissoesSelecionadas.has(`${key}:${a}`));
                    const algumasMarcadas = ACOES.some((a) => permissoesSelecionadas.has(`${key}:${a}`));
                    return (
                      <div key={key} className={`grid grid-cols-[1fr_80px_80px_80px_60px] px-4 py-2.5 border-b last:border-0 ${algumasMarcadas ? "bg-primary/3" : ""}`}>
                        <span className="text-sm">{label}</span>
                        {ACOES.map((a) => (
                          <div key={a} className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={permissoesSelecionadas.has(`${key}:${a}`)}
                              onChange={() => togglePermissao(key, a)}
                              className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                            />
                          </div>
                        ))}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={todasMarcadas}
                            onChange={() => toggleRecurso(key)}
                            className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {permissoesSelecionadas.size} permissão{permissoesSelecionadas.size !== 1 ? "ões" : ""} selecionada{permissoesSelecionadas.size !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
              {erroPerfil && <p className="text-sm text-destructive">{erroPerfil}</p>}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setModalPerfilAberto(false)}>Cancelar</Button>
                <Button onClick={salvarPerfil} disabled={salvandoPerfil}>
                  {salvandoPerfil ? "Salvando..." : perfilEditando ? "Salvar alterações" : "Criar perfil"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instrução bucket */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Pré-requisito: bucket "logos" no Supabase</p>
        <p className="text-xs leading-relaxed">
          Acesse <strong>Supabase → Storage → New bucket</strong>, crie um bucket chamado <code className="bg-amber-100 px-1 rounded">logos</code> e marque como <strong>Public</strong>.
          Isso é necessário para que a logo apareça nas propostas, contratos e no sistema.
        </p>
      </div>
    </div>
  );
}
