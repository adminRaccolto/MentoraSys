"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, FolderKanban, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarProjeto, excluirProjeto } from "@/actions/projetos";

const schema = z.object({
  cliente_id: z.string().optional(),
  contrato_id: z.string().optional(),
  interno: z.boolean().default(false),
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
}).refine(
  (d) => d.interno || !!d.cliente_id,
  { message: "Selecione um cliente ou marque como projeto interno", path: ["cliente_id"] }
);

type FormData = z.input<typeof schema>;

type StatusProjeto = "PLANEJAMENTO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

interface Tarefa { id: string; status: string }
interface Projeto {
  id: string;
  titulo: string;
  status: StatusProjeto;
  interno: boolean;
  data_inicio: Date | null;
  data_fim: Date | null;
  criado_em: Date;
  cliente: { id: string; nome: string } | null;
  tarefas: Tarefa[];
}

interface Contrato {
  id: string;
  titulo: string;
  cliente_id: string;
  cliente: { nome: string };
}

interface Props {
  projetos: Projeto[];
  clientes: { id: string; nome: string }[];
  contratos: Contrato[];
}

const STATUS_CONFIG: Record<StatusProjeto, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PLANEJAMENTO: { label: "Planejamento", variant: "secondary" },
  EM_ANDAMENTO: { label: "Em Andamento", variant: "default" },
  CONCLUIDO: { label: "Concluído", variant: "outline" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};

export default function ProjetosClient({ projetos: inicial, clientes, contratos }: Props) {
  const router = useRouter();
  const [projetos, setProjetos] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [projetoExcluindo, setProjetoExcluindo] = useState<Projeto | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { interno: false },
    });

  const isInterno = watch("interno") ?? false;
  const clienteId = watch("cliente_id") ?? "";
  const contratoId = watch("contrato_id") ?? "nenhum";

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const res = await criarProjeto(data);
        toast.success("Projeto criado");
        setModalAberto(false);
        reset();
        router.push(`/projetos/${res.data.id}`);
      } catch {
        toast.error("Erro ao criar projeto");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!projetoExcluindo) return;
    startTransition(async () => {
      try {
        await excluirProjeto(projetoExcluindo.id);
        setProjetos((prev) => prev.filter((p) => p.id !== projetoExcluindo.id));
        toast.success("Projeto excluído");
        setProjetoExcluindo(null);
      } catch {
        toast.error("Erro ao excluir projeto");
      }
    });
  };

  const progresso = (p: Projeto) => {
    if (!p.tarefas.length) return null;
    const concluidas = p.tarefas.filter((t) => t.status === "CONCLUIDA").length;
    return `${concluidas}/${p.tarefas.length}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Projetos</h1>
          <Badge variant="secondary">{projetos.length}</Badge>
        </div>
        <Button onClick={() => { reset(); setModalAberto(true); }} size="sm">
          <Plus className="size-4 mr-1.5" /> Novo projeto
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Término</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projetos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhum projeto cadastrado
                </TableCell>
              </TableRow>
            )}
            {projetos.map((p) => {
              const prog = progresso(p);
              const cfg = STATUS_CONFIG[p.status];
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/projetos/${p.id}`)}
                >
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell>
                    {p.interno
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full border border-primary/20"><Building2 className="size-3" />Interno</span>
                      : (p.cliente?.nome ?? "—")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {prog ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.data_inicio ? new Date(p.data_inicio).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.data_fim ? new Date(p.data_fim).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon" variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setProjetoExcluindo(p)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal novo projeto */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl">Novo projeto</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 py-2">

              {/* Toggle projeto interno */}
              <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/40 transition-colors select-none">
                <Checkbox
                  className="mt-0.5 size-5"
                  checked={isInterno}
                  onCheckedChange={(v) => {
                    setValue("interno", !!v);
                    if (v) {
                      setValue("cliente_id", undefined);
                      setValue("contrato_id", undefined);
                    }
                  }}
                />
                <div>
                  <p className="text-sm font-semibold leading-tight">Projeto interno</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sem vínculo com cliente externo — ex.: melhoria de processos, capacitação interna
                  </p>
                </div>
              </label>

              {/* Cliente + Contrato — ocultos quando interno */}
              {!isInterno && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Cliente *</Label>
                    <Select value={clienteId} onValueChange={(v) => setValue("cliente_id", v ?? undefined)}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.cliente_id && (
                      <p className="text-destructive text-xs">{errors.cliente_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Contrato vinculado{" "}
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Select
                      value={contratoId}
                      onValueChange={(v) => {
                        if (!v || v === "nenhum") { setValue("contrato_id", undefined); return; }
                        setValue("contrato_id", v ?? undefined);
                        const c = contratos.find((ct) => ct.id === v);
                        if (c) setValue("cliente_id", c.cliente_id ?? undefined);
                      }}
                    >
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {contratos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.titulo} — {c.cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Título *</Label>
                <Input
                  className="h-11"
                  {...register("titulo")}
                  placeholder="Ex.: Consultoria Financeira Q3"
                />
                {errors.titulo && (
                  <p className="text-destructive text-xs">{errors.titulo.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Descrição{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Textarea
                  {...register("descricao")}
                  rows={3}
                  placeholder="Objetivo e escopo do projeto..."
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Data de início</Label>
                  <Input {...register("data_inicio")} type="date" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Data de término</Label>
                  <Input {...register("data_fim")} type="date" className="h-11" />
                </div>
              </div>

            </div>

            <DialogFooter className="shrink-0 pt-4 border-t mt-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="min-w-32">
                {isPending ? "Criando..." : "Criar projeto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!projetoExcluindo} onOpenChange={(v) => !v && setProjetoExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto <strong>{projetoExcluindo?.titulo}</strong> e todos seus dados (etapas, tarefas, documentos) serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
