"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Building2, User, Upload, Trash2, ImageIcon, Loader2, Users, UserPlus, Mail, MoreVertical, X } from "lucide-react";
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
import { convidarMembro, removerMembro, alterarPerfilMembro, cancelarConvite } from "@/actions/equipe";

const schemaEmpresa = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email_contato: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  site: z.string().optional(),
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

interface Props {
  empresa: {
    id: string;
    nome: string;
    cnpj: string;
    logo_url: string;
    plano: string;
    telefone: string;
    email_contato: string;
    endereco: string;
    cidade: string;
    estado: string;
    site: string;
  };
  usuario: {
    id: string;
    nome: string;
    email: string;
    avatar_url: string;
  } | null;
  membros: MembroItem[];
  perfis: { id: string; nome: string }[];
  convitesPendentes: ConvitePendente[];
  usuarioAtualId: string | null;
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

export default function ConfiguracoesClient({ empresa, usuario, membros: membrosInicial, perfis, convitesPendentes: convitesInicial, usuarioAtualId }: Props) {
  const [isPendingEmpresa, startEmpresa] = useTransition();
  const [isPendingPerfil, startPerfil] = useTransition();

  // Equipe
  const [membros, setMembros] = useState(membrosInicial);
  const [convitesPendentes, setConvitesPendentes] = useState(convitesInicial);
  const [conviteEmail, setConviteEmail] = useState("");
  const [convitePerfilId, setConvitePerfilId] = useState(perfis[0]?.id ?? "");
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | null>(null);

  const formEmpresa = useForm<EmpresaForm>({
    resolver: zodResolver(schemaEmpresa),
    defaultValues: {
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      telefone: empresa.telefone,
      email_contato: empresa.email_contato,
      endereco: empresa.endereco,
      cidade: empresa.cidade,
      estado: empresa.estado,
      site: empresa.site,
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
      } catch {
        toast.error("Erro ao salvar perfil");
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

          <form onSubmit={onSubmitEmpresa} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razão social / Nome *" error={formEmpresa.formState.errors.nome?.message}>
                <Input {...formEmpresa.register("nome")} className="h-9 text-sm" />
              </Field>
              <Field label="CNPJ">
                <Input {...formEmpresa.register("cnpj")} className="h-9 text-sm" placeholder="00.000.000/0001-00" />
              </Field>
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
              <div className="col-span-2">
                <Field label="Site">
                  <Input {...formEmpresa.register("site")} className="h-9 text-sm" placeholder="https://www.empresa.com" />
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

          {/* Convidar novo membro */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Convidar novo membro</p>
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
                  setEnviandoConvite(true);
                  try {
                    const res = await convidarMembro({ email: conviteEmail, perfil_id: convitePerfilId });
                    if (res.ok) {
                      toast.success(`Convite enviado para ${conviteEmail}`);
                      const expira = new Date();
                      expira.setDate(expira.getDate() + 7);
                      setConvitesPendentes(prev => [...prev, {
                        id: Date.now().toString(),
                        email: conviteEmail,
                        criado_em: new Date().toISOString(),
                        expira_em: expira.toISOString(),
                      }]);
                      setConviteEmail("");
                    } else {
                      setErroConvite(res.error);
                    }
                  } catch {
                    setErroConvite("Erro ao enviar convite");
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
          </div>
        </div>
      </section>

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
