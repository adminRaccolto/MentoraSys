"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileEdit, Plus, Copy, Trash2, FileText, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { criarModelo, duplicarModelo, excluirModelo, seedModeloProposta, resetarModeloProposta, seedModeloContrato, resetarModeloContrato } from "@/actions/modelos";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { TipoModelo } from "@/lib/generated/prisma";

interface Modelo {
  id: string;
  nome: string;
  tipo: TipoModelo;
  atualizado_em: Date;
}

interface Props {
  modelos: Modelo[];
}

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  tipo: z.enum(["CONTRATO", "PROPOSTA", "RECIBO", "GENERICO"]),
});
type FormData = z.input<typeof schema>;

const TIPO_LABELS: Record<TipoModelo, string> = {
  CONTRATO: "Contrato",
  PROPOSTA: "Proposta",
  RECIBO: "Recibo",
  GENERICO: "Genérico",
};

const TIPO_COLORS: Record<TipoModelo, string> = {
  CONTRATO: "bg-blue-100 text-blue-700",
  PROPOSTA: "bg-amber-100 text-amber-700",
  RECIBO: "bg-green-100 text-green-700",
  GENERICO: "bg-slate-100 text-slate-600",
};

const TABS = [
  { label: "Todos", value: "TODOS" },
  { label: "Contrato", value: "CONTRATO" },
  { label: "Proposta", value: "PROPOSTA" },
  { label: "Recibo", value: "RECIBO" },
  { label: "Genérico", value: "GENERICO" },
] as const;

export default function ModelosClient({ modelos }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tabAtiva, setTabAtiva] = useState<string>("TODOS");
  const [modalAberto, setModalAberto] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", tipo: "CONTRATO" },
  });

  const modelosFiltrados =
    tabAtiva === "TODOS" ? modelos : modelos.filter((m) => m.tipo === tabAtiva);

  const handleCriar = form.handleSubmit(async (data) => {
    startTransition(async () => {
      const res = await criarModelo(data);
      if (res.ok) {
        setModalAberto(false);
        form.reset();
        router.push(`/modelos/${res.id}`);
      }
    });
  });

  const handleDuplicar = (id: string) => {
    startTransition(async () => {
      await duplicarModelo(id);
      router.refresh();
    });
  };

  const handleExcluir = () => {
    if (!excluirId) return;
    startTransition(async () => {
      await excluirModelo(excluirId);
      setExcluirId(null);
      router.refresh();
    });
  };

  const handleSeedProposta = () => {
    startTransition(async () => {
      const res = await seedModeloProposta();
      if (res.ok) {
        toast.success("Modelo de proposta importado com sucesso!");
        router.refresh();
      } else {
        toast.info(res.message ?? "Modelo já existe.");
      }
    });
  };

  const handleResetarProposta = () => {
    startTransition(async () => {
      const res = await resetarModeloProposta();
      if (res.ok) {
        toast.success(res.message ?? "Template atualizado!");
        router.refresh();
      } else {
        toast.error("Erro ao atualizar o template.");
      }
    });
  };

  const temModeloProposta = modelos.some((m) => m.tipo === "PROPOSTA");
  const temModeloContrato = modelos.some((m) => m.tipo === "CONTRATO");

  const handleSeedContrato = () => {
    startTransition(async () => {
      const res = await seedModeloContrato();
      if (res.ok) {
        toast.success("Modelo de contrato importado com sucesso!");
        router.refresh();
      } else {
        toast.info(res.message ?? "Modelo já existe.");
      }
    });
  };

  const handleResetarContrato = () => {
    startTransition(async () => {
      const res = await resetarModeloContrato();
      if (res.ok) {
        toast.success(res.message ?? "Template atualizado!");
        router.refresh();
      } else {
        toast.error("Erro ao atualizar o template.");
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileEdit className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Modelos de Documento</h1>
        </div>
        <div className="flex gap-2">
          {!temModeloContrato ? (
            <Button variant="outline" size="sm" onClick={handleSeedContrato} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Importar modelo de contrato
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleResetarContrato} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Atualizar template de contrato
            </Button>
          )}
          {!temModeloProposta ? (
            <Button variant="outline" size="sm" onClick={handleSeedProposta} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Importar modelo de proposta
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleResetarProposta} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Atualizar template de proposta
            </Button>
          )}
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="size-4 mr-2" />
            Novo Modelo
          </Button>
        </div>
      </div>

      {/* Tabs de tipo */}
      <div className="flex gap-1 border-b border-border pb-0">
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
                ? modelos.length
                : modelos.filter((m) => m.tipo === tab.value).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Grid de cards */}
      {modelosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum modelo encontrado.</p>
          {tabAtiva === "CONTRATO" && !temModeloContrato && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleSeedContrato} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Importar modelo de contrato de consultoria
            </Button>
          )}
          {tabAtiva === "PROPOSTA" && !temModeloProposta && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleSeedProposta} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Importar modelo de proposta de consultoria
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelosFiltrados.map((modelo) => (
            <div
              key={modelo.id}
              className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow group cursor-pointer"
              onClick={() => router.push(`/modelos/${modelo.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{modelo.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atualizado em{" "}
                    {new Date(modelo.atualizado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge
                  className={`${TIPO_COLORS[modelo.tipo]} border-0 shrink-0`}
                  variant="outline"
                >
                  {TIPO_LABELS[modelo.tipo]}
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
                  onClick={() => router.push(`/modelos/${modelo.id}`)}
                >
                  <ChevronRight className="size-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={isPending}
                  onClick={() => handleDuplicar(modelo.id)}
                >
                  <Copy className="size-3 mr-1" />
                  Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                  onClick={() => setExcluirId(modelo.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo modelo */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Modelo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCriar} className="space-y-4">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Contrato de Consultoria"
                  {...form.register("nome")}
                />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={form.watch("tipo")}
                  onValueChange={(v) => form.setValue("tipo", v as "CONTRATO" | "PROPOSTA" | "RECIBO" | "GENERICO")}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string | null) => value ? (TIPO_LABELS[value as TipoModelo] ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTRATO">Contrato</SelectItem>
                    <SelectItem value="PROPOSTA">Proposta</SelectItem>
                    <SelectItem value="RECIBO">Recibo</SelectItem>
                    <SelectItem value="GENERICO">Genérico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAberto(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  Criar e abrir editor
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!excluirId} onOpenChange={() => setExcluirId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. O modelo será permanentemente removido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
