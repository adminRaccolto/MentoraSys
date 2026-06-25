"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Copy, ExternalLink, Pencil, Trash2, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { criarCampanha, editarCampanha, excluirCampanha, listarParticipantes } from "@/actions/campanhas-diagnostico";

const schema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  titulo: z.string().min(2, "Título obrigatório"),
  subtitulo: z.string().optional(),
  video_youtube: z.string().optional(),
  url_checkout: z.string().optional(),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Campanha {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  video_youtube: string | null;
  url_checkout: string | null;
  ativo: boolean;
  criado_em: Date;
  _count: { participantes: number };
}

interface Participante {
  id: string;
  nome: string;
  email: string;
  celular: string;
  pontuacao: number | null;
  celular_verificado: boolean;
  email_enviado: boolean;
  criado_em: Date;
}

interface Props {
  campanhasIniciais: Campanha[];
  empresaSlug: string;
}

export default function CampanhaClient({ campanhasIniciais, empresaSlug }: Props) {
  const [campanhas, setCampanhas] = useState<Campanha[]>(campanhasIniciais);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [participantesModal, setParticipantesModal] = useState<{ campanha: Campanha; lista: Participante[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.raccolto.com.br";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ativo: true },
  });

  function abrirNova() {
    setEditandoId(null);
    form.reset({ titulo: "Diagnóstico Empresarial", slug: "", subtitulo: "", video_youtube: "", url_checkout: "", ativo: true });
    setModalAberto(true);
  }

  function abrirEditar(c: Campanha) {
    setEditandoId(c.id);
    form.reset({
      titulo: c.titulo,
      slug: c.slug,
      subtitulo: c.subtitulo ?? "",
      video_youtube: c.video_youtube ?? "",
      url_checkout: c.url_checkout ?? "",
      ativo: c.ativo,
    });
    setModalAberto(true);
  }

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      try {
        if (editandoId) {
          await editarCampanha(editandoId, data);
          setCampanhas((prev) => prev.map((c) => c.id === editandoId ? { ...c, ...data, subtitulo: data.subtitulo ?? null, video_youtube: data.video_youtube ?? null, url_checkout: data.url_checkout ?? null } : c));
          toast.success("Campanha atualizada");
        } else {
          const nova = await criarCampanha(data);
          setCampanhas((prev) => [{ ...nova, _count: { participantes: 0 } }, ...prev]);
          toast.success("Campanha criada");
        }
        setModalAberto(false);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  });

  function handleExcluir() {
    if (!excluirId) return;
    startTransition(async () => {
      try {
        await excluirCampanha(excluirId);
        setCampanhas((prev) => prev.filter((c) => c.id !== excluirId));
        setExcluirId(null);
        toast.success("Campanha excluída");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleVerParticipantes(campanha: Campanha) {
    startTransition(async () => {
      try {
        const lista = await listarParticipantes(campanha.id);
        setParticipantesModal({ campanha, lista: lista as unknown as Participante[] });
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function copiarLink(slug: string) {
    navigator.clipboard.writeText(`${baseUrl}/funil/${slug}`);
    toast.success("Link copiado!");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Diagnóstico Online</h1>
          <p className="text-sm text-muted-foreground">Gerencie os funis de diagnóstico público vinculados ao CRM.</p>
        </div>
        <Button onClick={abrirNova} size="sm">
          <Plus className="size-4 mr-1.5" /> Nova campanha
        </Button>
      </div>

      {campanhas.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <p className="font-medium mb-1">Nenhuma campanha criada</p>
          <p className="text-sm">Crie sua primeira hotpage de diagnóstico.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campanhas.map((c) => (
            <div key={c.id} className="border border-border rounded-xl bg-card p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{c.titulo}</span>
                  <Badge variant={c.ativo ? "default" : "secondary"} className="text-xs">
                    {c.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                {c.subtitulo && <p className="text-sm text-muted-foreground">{c.subtitulo}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                    /funil/{c.slug}
                  </code>
                  <button onClick={() => copiarLink(c.slug)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Copy className="size-3" /> Copiar link
                  </button>
                  <a href={`/funil/${c.slug}`} target="_blank" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="size-3" /> Abrir
                  </a>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" />
                  {c._count.participantes} participante(s)
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleVerParticipantes(c)}>
                  <Users className="size-3.5 mr-1" /> Leads
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(c)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setExcluirId(c.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={(o) => { if (!o) setModalAberto(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar campanha" : "Nova campanha de diagnóstico"}</DialogTitle>
          </DialogHeader>

          <form id="campanha-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Título *</Label>
              <Input {...form.register("titulo")} placeholder="Ex: Diagnóstico Agro Gratuito" className="h-10" />
              {form.formState.errors.titulo && <p className="text-xs text-destructive">{form.formState.errors.titulo.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Slug (URL) *</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/funil/</span>
                <Input {...form.register("slug")} placeholder="conselho-agro" className="h-10" />
              </div>
              {form.formState.errors.slug && <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Subtítulo</Label>
              <Input {...form.register("subtitulo")} placeholder="Ex: Descubra o nível de gestão do seu agronegócio" className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label>ID do vídeo YouTube</Label>
              <Input {...form.register("video_youtube")} placeholder="Ex: dQw4w9WgXcQ" className="h-10" />
              <p className="text-xs text-muted-foreground">O ID fica na URL: youtube.com/watch?v=<strong>ID</strong></p>
            </div>

            <div className="space-y-1.5">
              <Label>URL de checkout (página final)</Label>
              <Input {...form.register("url_checkout")} placeholder="https://..." className="h-10" />
            </div>

            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="ativo" {...form.register("ativo")} className="size-4" />
              <Label htmlFor="ativo">Campanha ativa (aceita novos participantes)</Label>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button type="submit" form="campanha-form" disabled={isPending}>
              {editandoId ? "Salvar alterações" : "Criar campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal participantes */}
      <Dialog open={!!participantesModal} onOpenChange={(o) => { if (!o) setParticipantesModal(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leads — {participantesModal?.campanha.titulo}</DialogTitle>
          </DialogHeader>
          {participantesModal?.lista.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum participante ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-3 text-xs font-semibold text-muted-foreground">Nome</th>
                  <th className="pb-2 pr-3 text-xs font-semibold text-muted-foreground">E-mail</th>
                  <th className="pb-2 pr-3 text-xs font-semibold text-muted-foreground">Celular</th>
                  <th className="pb-2 pr-3 text-xs font-semibold text-muted-foreground">Pontuação</th>
                  <th className="pb-2 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {participantesModal?.lista.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{p.nome}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{p.email}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{p.celular}</td>
                    <td className="py-2 pr-3">
                      {p.pontuacao !== null ? (
                        <span className="font-semibold text-primary">{p.pontuacao}/64</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        {p.celular_verificado && <Badge variant="outline" className="text-[10px]">✓ Tel</Badge>}
                        {p.email_enviado && <Badge variant="outline" className="text-[10px]">✓ E-mail</Badge>}
                        {!p.celular_verificado && <Badge variant="secondary" className="text-[10px]">Pendente</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir */}
      <AlertDialog open={!!excluirId} onOpenChange={(o) => { if (!o) setExcluirId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir campanha?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">Todos os participantes e dados desta campanha serão removidos.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
