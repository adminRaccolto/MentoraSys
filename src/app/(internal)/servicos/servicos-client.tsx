"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Briefcase, ListTree } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarServico, editarServico, excluirServico } from "@/actions/servicos";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional(),
  valor_base: z.string().optional(),
  plano_contas_id: z.string().optional().nullable(),
  canal: z.enum(["ARATO", "CONSELHO_AGRO", "CONSULTORIA"]).optional().nullable(),
  plano: z.enum(["ESSENCIAL", "GESTAO", "PERFORMANCE", "NOVO_AGRO", "MESA_AGRO", "CONSULTORIA_AGRO"]).optional().nullable(),
  tipo_cobranca: z.enum(["ASSINATURA", "PROJETO", "PONTUAL"]).optional().nullable(),
  asaas_link_pagamento: z.string().optional().nullable(),
});

const CANAL_LABELS: Record<string, string> = {
  ARATO: "Arato",
  CONSELHO_AGRO: "O Conselho Agro",
  CONSULTORIA: "Consultoria",
};

const PLANO_LABELS: Record<string, string> = {
  ESSENCIAL: "Essencial",
  GESTAO: "Gestão",
  PERFORMANCE: "Performance",
  NOVO_AGRO: "O Novo Agro",
  MESA_AGRO: "Mesa de Conselheiros",
  CONSULTORIA_AGRO: "Conselheiro Executivo",
};

const TIPO_COB_LABELS: Record<string, string> = {
  ASSINATURA: "Assinatura",
  PROJETO: "Projeto",
  PONTUAL: "Pontual",
};

type FormData = z.infer<typeof schema>;

interface ContaReceita {
  id: string;
  nome: string;
  codigo: string | null;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  valor_base: number | null;
  plano_contas_id: string | null;
  plano_contas: { nome: string; codigo: string | null } | null;
  canal: string | null;
  plano: string | null;
  tipo_cobranca: string | null;
  asaas_link_pagamento: string | null;
  ativo: boolean;
}

function formatarValor(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ServicosClient({
  servicos: inicial,
  contasReceita,
}: {
  servicos: Servico[];
  contasReceita: ContaReceita[];
}) {
  const [servicos, setServicos] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [servicoEditando, setServicoEditando] = useState<Servico | null>(null);
  const [servicoExcluindo, setServicoExcluindo] = useState<Servico | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const abrirCriar = () => {
    setServicoEditando(null);
    reset({ plano_contas_id: null });
    setModalAberto(true);
  };

  const abrirEditar = (s: Servico) => {
    setServicoEditando(s);
    reset({
      nome: s.nome,
      descricao: s.descricao ?? "",
      valor_base: s.valor_base != null ? String(s.valor_base) : "",
      plano_contas_id: s.plano_contas_id ?? null,
      canal: (s.canal as "ARATO" | "CONSELHO_AGRO" | "CONSULTORIA" | null) ?? null,
      plano: (s.plano as "ESSENCIAL" | "GESTAO" | "PERFORMANCE" | "NOVO_AGRO" | "MESA_AGRO" | "CONSULTORIA_AGRO" | null) ?? null,
      tipo_cobranca: (s.tipo_cobranca as "ASSINATURA" | "PROJETO" | "PONTUAL" | null) ?? null,
      asaas_link_pagamento: s.asaas_link_pagamento ?? null,
    });
    setModalAberto(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        if (servicoEditando) {
          const res = await editarServico(servicoEditando.id, data);
          const conta = contasReceita.find((c) => c.id === data.plano_contas_id) ?? null;
          setServicos((prev) =>
            prev.map((s) =>
              s.id === servicoEditando.id
                ? {
                    ...s,
                    ...res.data,
                    valor_base: res.data.valor_base != null ? Number(res.data.valor_base) : null,
                    plano_contas: conta ? { nome: conta.nome, codigo: conta.codigo } : null,
                    canal: res.data.canal ?? null,
                    plano: res.data.plano ?? null,
                    tipo_cobranca: res.data.tipo_cobranca ?? null,
                    asaas_link_pagamento: res.data.asaas_link_pagamento ?? null,
                  }
                : s
            )
          );
          toast.success("Serviço atualizado");
        } else {
          const res = await criarServico(data);
          const conta = contasReceita.find((c) => c.id === data.plano_contas_id) ?? null;
          setServicos((prev) => [
            ...prev,
            {
              ...res.data,
              valor_base: res.data.valor_base != null ? Number(res.data.valor_base) : null,
              plano_contas: conta ? { nome: conta.nome, codigo: conta.codigo } : null,
              canal: res.data.canal ?? null,
              plano: res.data.plano ?? null,
              tipo_cobranca: res.data.tipo_cobranca ?? null,
              asaas_link_pagamento: res.data.asaas_link_pagamento ?? null,
            },
          ]);
          toast.success("Serviço criado");
        }
        setModalAberto(false);
      } catch {
        toast.error("Erro ao salvar serviço");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!servicoExcluindo) return;
    startTransition(async () => {
      try {
        await excluirServico(servicoExcluindo.id);
        setServicos((prev) =>
          prev.map((s) => (s.id === servicoExcluindo.id ? { ...s, ativo: false } : s))
        );
        toast.success("Serviço desativado");
        setServicoExcluindo(null);
      } catch {
        toast.error("Erro ao excluir serviço");
      }
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Serviços</h1>
          <Badge variant="secondary">{servicos.length}</Badge>
        </div>
        <div className="flex gap-2">
          {contasReceita.length === 0 && (
            <Link
              href="/plano-contas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors"
            >
              <ListTree className="size-4" /> Configurar plano de contas
            </Link>
          )}
          <Button onClick={abrirCriar} size="sm">
            <Plus className="size-4 mr-1.5" /> Novo serviço
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Canal / Plano</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor base</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum serviço cadastrado
                </TableCell>
              </TableRow>
            )}
            {servicos.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirEditar(s)}>
                <TableCell>
                  <p className="font-medium">{s.nome}</p>
                  {s.descricao && <p className="text-xs text-muted-foreground truncate max-w-xs">{s.descricao}</p>}
                </TableCell>
                <TableCell className="text-sm">
                  {s.canal ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">{CANAL_LABELS[s.canal] ?? s.canal}</span>
                      {s.plano && <span className="text-muted-foreground text-xs">{PLANO_LABELS[s.plano] ?? s.plano}</span>}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {s.tipo_cobranca ? (
                    <Badge variant="outline" className="text-xs">{TIPO_COB_LABELS[s.tipo_cobranca] ?? s.tipo_cobranca}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>{formatarValor(s.valor_base)}</TableCell>
                <TableCell>
                  <Badge variant={s.ativo ? "default" : "secondary"}>
                    {s.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setServicoExcluindo(s)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{servicoEditando ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input {...register("nome")} className="h-9" placeholder="Ex.: Consultoria financeira mensal" />
              {errors.nome && <p className="text-destructive text-xs">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea {...register("descricao")} placeholder="Descreva o serviço..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor base (R$)</Label>
                <Input {...register("valor_base")} type="number" step="0.01" className="h-9" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de cobrança</Label>
                <Select
                  value={watch("tipo_cobranca") ?? ""}
                  onValueChange={(v) => setValue("tipo_cobranca", v === "" ? null : v as "ASSINATURA" | "PROJETO" | "PONTUAL")}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não definido</SelectItem>
                    <SelectItem value="ASSINATURA">Assinatura</SelectItem>
                    <SelectItem value="PROJETO">Projeto</SelectItem>
                    <SelectItem value="PONTUAL">Pontual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Canal</Label>
                <Select
                  value={watch("canal") ?? ""}
                  onValueChange={(v) => {
                    setValue("canal", v === "" ? null : v as "ARATO" | "CONSELHO_AGRO" | "CONSULTORIA");
                    setValue("plano", null);
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    <SelectItem value="ARATO">Arato</SelectItem>
                    <SelectItem value="CONSELHO_AGRO">O Conselho Agro</SelectItem>
                    <SelectItem value="CONSULTORIA">Consultoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plano</Label>
                <Select
                  value={watch("plano") ?? ""}
                  onValueChange={(v) => setValue("plano", v === "" ? null : v as "ESSENCIAL" | "GESTAO" | "PERFORMANCE" | "NOVO_AGRO" | "MESA_AGRO" | "CONSULTORIA_AGRO")}
                  disabled={!watch("canal")}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {watch("canal") === "ARATO" && <>
                      <SelectItem value="ESSENCIAL">Essencial</SelectItem>
                      <SelectItem value="GESTAO">Gestão</SelectItem>
                      <SelectItem value="PERFORMANCE">Performance</SelectItem>
                    </>}
                    {watch("canal") === "CONSELHO_AGRO" && <>
                      <SelectItem value="NOVO_AGRO">O Novo Agro</SelectItem>
                      <SelectItem value="MESA_AGRO">Mesa de Conselheiros</SelectItem>
                      <SelectItem value="CONSULTORIA_AGRO">Conselheiro Executivo</SelectItem>
                    </>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Conta de receita</Label>
                <Select
                  value={watch("plano_contas_id") ?? ""}
                  onValueChange={(v) => setValue("plano_contas_id", v === "" ? null : v)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Sem vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem vínculo</SelectItem>
                    {contasReceita.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo ? `${c.codigo} · ` : ""}{c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contasReceita.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Configure o{" "}
                    <Link href="/plano-contas" className="text-primary underline">
                      plano de contas
                    </Link>{" "}
                    primeiro.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link Asaas (ID)</Label>
                <Input
                  {...register("asaas_link_pagamento")}
                  className="h-9"
                  placeholder="apl_xxxxxxxxxxxx"
                />
                <p className="text-[10px] text-muted-foreground">ID do link de pagamento no Asaas</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : servicoEditando ? "Salvar alterações" : "Cadastrar serviço"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!servicoExcluindo} onOpenChange={(v) => !v && setServicoExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço <strong>{servicoExcluindo?.nome}</strong> será desativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
