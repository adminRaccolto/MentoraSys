"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart2, Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarDiagnostico, excluirDiagnostico } from "@/actions/diagnosticos";

interface Diagnostico {
  id: string;
  tipo: "SWOT" | "CANVAS" | "CINCO_W_DOIS_H";
  titulo: string;
  atualizado_em: string;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

interface Props {
  diagnosticos: Diagnostico[];
  clientes: { id: string; nome: string }[];
  projetos: { id: string; titulo: string }[];
}

const schema = z.object({
  tipo: z.enum(["SWOT", "CANVAS", "CINCO_W_DOIS_H"]),
  titulo: z.string().min(1, "Título obrigatório"),
  cliente_id: z.string().optional(),
  projeto_id: z.string().optional(),
});
type FormData = z.input<typeof schema>;

const TIPO_LABEL: Record<string, string> = {
  SWOT: "SWOT",
  CANVAS: "Business Canvas",
  CINCO_W_DOIS_H: "5W2H",
};

const TIPO_COLOR: Record<string, string> = {
  SWOT: "bg-blue-100 text-blue-700",
  CANVAS: "bg-purple-100 text-purple-700",
  CINCO_W_DOIS_H: "bg-amber-100 text-amber-700",
};

const TABS = [
  { label: "Todos", value: "TODOS" },
  { label: "SWOT", value: "SWOT" },
  { label: "Business Canvas", value: "CANVAS" },
  { label: "5W2H", value: "CINCO_W_DOIS_H" },
] as const;

export default function DiagnosticosClient({ diagnosticos, clientes, projetos }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tabAtiva, setTabAtiva] = useState<string>("TODOS");
  const [modalAberto, setModalAberto] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "SWOT", titulo: "", cliente_id: "", projeto_id: "" },
  });

  const filtrados =
    tabAtiva === "TODOS" ? diagnosticos : diagnosticos.filter((d) => d.tipo === tabAtiva);

  const handleCriar = form.handleSubmit((data) => {
    startTransition(async () => {
      const res = await criarDiagnostico({
        ...data,
        cliente_id: data.cliente_id || undefined,
        projeto_id: data.projeto_id || undefined,
      });
      if (res.ok) {
        setModalAberto(false);
        form.reset();
        router.push(`/diagnosticos/${res.id}`);
      }
    });
  });

  const handleExcluir = () => {
    if (!excluirId) return;
    startTransition(async () => {
      await excluirDiagnostico(excluirId);
      setExcluirId(null);
      router.refresh();
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Diagramas & Diagnósticos</h1>
        </div>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          <Plus className="size-4 mr-1.5" />
          Novo Diagnóstico
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTabAtiva(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tabAtiva === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              (
              {tab.value === "TODOS"
                ? diagnosticos.length
                : diagnosticos.filter((d) => d.tipo === tab.value).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Nenhum diagnóstico encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((d) => (
            <div
              key={d.id}
              className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => router.push(`/diagnosticos/${d.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {d.cliente?.nome ?? d.projeto?.titulo ?? "Sem vínculo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Atualizado em {new Date(d.atualizado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge
                  className={`${TIPO_COLOR[d.tipo]} border-0 shrink-0 text-xs`}
                  variant="outline"
                >
                  {TIPO_LABEL[d.tipo]}
                </Badge>
              </div>
              <div
                className="flex items-center gap-1 mt-3 pt-3 border-t border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => router.push(`/diagnosticos/${d.id}`)}
                >
                  <ChevronRight className="size-3 mr-1" />
                  Abrir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                  disabled={isPending}
                  onClick={() => setExcluirId(d.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo diagnóstico */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Diagnóstico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCriar} className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select
                value={form.watch("tipo")}
                onValueChange={(v) => form.setValue("tipo", v as "SWOT" | "CANVAS" | "CINCO_W_DOIS_H")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SWOT">Análise SWOT</SelectItem>
                  <SelectItem value="CANVAS">Business Model Canvas</SelectItem>
                  <SelectItem value="CINCO_W_DOIS_H">5W2H</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input placeholder="Ex: SWOT 2026 — Cliente ABC" {...form.register("titulo")} />
              {form.formState.errors.titulo && (
                <p className="text-xs text-destructive">{form.formState.errors.titulo.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Select
                  value={form.watch("cliente_id") ?? ""}
                  onValueChange={(v) => form.setValue("cliente_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Projeto</Label>
                <Select
                  value={form.watch("projeto_id") ?? ""}
                  onValueChange={(v) => form.setValue("projeto_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                Criar e abrir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!excluirId} onOpenChange={() => setExcluirId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir diagnóstico?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
