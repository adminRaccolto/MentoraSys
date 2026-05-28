"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, FolderKanban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarProjeto, excluirProjeto } from "@/actions/projetos";

const schema = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  contrato_id: z.string().optional(),
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
});

type FormData = z.input<typeof schema>;

type StatusProjeto = "PLANEJAMENTO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

interface Tarefa { id: string; status: string }
interface Projeto {
  id: string;
  titulo: string;
  status: StatusProjeto;
  data_inicio: Date | null;
  data_fim: Date | null;
  criado_em: Date;
  cliente: { id: string; nome: string };
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
    useForm<FormData>({ resolver: zodResolver(schema) });

  const contratoSelecionado = watch("contrato_id");

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
                  <TableCell>{p.cliente.nome}</TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Select value={watch("cliente_id") ?? ""} onValueChange={(v) => setValue("cliente_id", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cliente_id && <p className="text-destructive text-xs">{errors.cliente_id.message}</p>}
            </div>

            {contratos.length > 0 && (
              <div className="space-y-1">
                <Label>Contrato vinculado <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select
                  value={watch("contrato_id") ?? ""}
                  onValueChange={(v) => {
                    if (v === null || v === "nenhum") {
                      setValue("contrato_id", undefined);
                      return;
                    }
                    setValue("contrato_id", v);
                    const c = contratos.find((ct) => ct.id === v);
                    if (c) setValue("cliente_id", c.cliente_id);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.titulo} — {c.cliente.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Título *</Label>
              <Input {...register("titulo")} placeholder="Ex.: Consultoria Financeira Q3" />
              {errors.titulo && <p className="text-destructive text-xs">{errors.titulo.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea {...register("descricao")} rows={2} placeholder="Objetivo e escopo do projeto..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de início</Label>
                <Input {...register("data_inicio")} type="date" />
              </div>
              <div className="space-y-1">
                <Label>Data de término</Label>
                <Input {...register("data_fim")} type="date" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar projeto"}</Button>
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
