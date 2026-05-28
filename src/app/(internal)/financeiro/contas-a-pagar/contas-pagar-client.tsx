"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowUpCircle, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarContaPagar, baixarContaPagar, excluirContaPagar } from "@/actions/contas-pagar";

type Status = "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO";

const STATUS_CONFIG: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDENTE: { label: "Pendente", variant: "secondary" },
  PAGO: { label: "Pago", variant: "default" },
  VENCIDO: { label: "Vencido", variant: "destructive" },
  CANCELADO: { label: "Cancelado", variant: "outline" },
};

const FORMAS = ["Dinheiro", "PIX", "TED", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Cheque"];

const schemaCreate = z.object({
  descricao: z.string().min(1, "Descrição obrigatória"),
  fornecedor: z.string().optional(),
  valor: z.string().min(1, "Valor obrigatório"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  plano_contas_id: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.string().min(1, "Valor obrigatório"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});

type FormCreate = z.input<typeof schemaCreate>;
type FormBaixar = z.input<typeof schemaBaixar>;

interface ContaPagar {
  id: string; descricao: string; fornecedor: string | null;
  valor: string | number; data_vencimento: Date; status: Status;
  data_pagamento: Date | null; valor_pago: string | number | null; forma_pagamento: string | null;
  plano_contas: { id: string; nome: string } | null;
}

interface Props {
  contas: ContaPagar[];
  categorias: { id: string; nome: string }[];
  contasBancarias: { id: string; nome: string }[];
  de: string;
  ate: string;
  statusFiltro: string;
}

function formatBRL(v: string | number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isVencido(data: Date, status: Status) {
  return status === "PENDENTE" && new Date(data) < new Date();
}

export default function ContasPagarClient({ contas: inicial, categorias, contasBancarias, de, ate, statusFiltro }: Props) {
  const router = useRouter();
  const [contas, setContas] = useState(inicial);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalBaixar, setModalBaixar] = useState<ContaPagar | null>(null);
  const [excluindo, setExcluindo] = useState<ContaPagar | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filtroDe, setFiltroDe] = useState(de);
  const [filtroAte, setFiltroAte] = useState(ate);

  const aplicarFiltro = () => {
    router.push(`/financeiro/contas-a-pagar?de=${filtroDe}&ate=${filtroAte}&status=${statusFiltro}`);
  };

  const filtradas = statusFiltro === "TODOS" ? contas : contas.filter((c) => c.status === statusFiltro);
  const totalPendente = contas.filter((c) => c.status === "PENDENTE").reduce((s, c) => s + Number(c.valor), 0);
  const totalPago = contas.filter((c) => c.status === "PAGO").reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0);

  const formNovo = useForm<FormCreate>({ resolver: zodResolver(schemaCreate) });
  const onSubmitNovo = (data: FormCreate) => {
    startTransition(async () => {
      try {
        const res = await criarContaPagar({ ...data, valor: Number(data.valor) });
        setContas((prev) => [...prev, res.data as unknown as ContaPagar]);
        toast.success("Conta a pagar criada");
        setModalNovo(false);
        formNovo.reset();
      } catch { toast.error("Erro ao criar conta"); }
    });
  };

  const formBaixar = useForm<FormBaixar>({ resolver: zodResolver(schemaBaixar) });
  const onSubmitBaixar = (data: FormBaixar) => {
    if (!modalBaixar) return;
    startTransition(async () => {
      try {
        await baixarContaPagar(modalBaixar.id, { ...data, valor_pago: Number(data.valor_pago) });
        setContas((prev) => prev.map((c) => c.id === modalBaixar.id ? { ...c, status: "PAGO", data_pagamento: new Date(data.data_pagamento), valor_pago: data.valor_pago, forma_pagamento: data.forma_pagamento } : c));
        toast.success("Conta baixada");
        setModalBaixar(null);
        formBaixar.reset();
      } catch { toast.error("Erro ao baixar conta"); }
    });
  };

  const confirmarExcluir = () => {
    if (!excluindo) return;
    startTransition(async () => {
      try {
        await excluirContaPagar(excluindo.id);
        setContas((prev) => prev.filter((c) => c.id !== excluindo.id));
        toast.success("Conta excluída");
        setExcluindo(null);
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  const tabs = [
    { key: "TODOS", label: "Todos" }, { key: "PENDENTE", label: "Pendente" },
    { key: "VENCIDO", label: "Vencido" }, { key: "PAGO", label: "Pago" }, { key: "CANCELADO", label: "Cancelado" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="size-5 text-orange-600" />
          <h1 className="text-xl font-semibold">Contas a Pagar</h1>
        </div>
        <Button size="sm" onClick={() => { formNovo.reset(); setModalNovo(true); }}>
          <Plus className="size-4 mr-1.5" /> Nova conta
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">De</span>
          <Input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} className="h-8 w-36 text-sm" />
          <span className="text-sm text-muted-foreground">Até</span>
          <Input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} className="h-8 w-36 text-sm" />
          <Button size="sm" variant="outline" className="h-8" onClick={aplicarFiltro}>Aplicar</Button>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Pendente: <strong className="text-foreground">{formatBRL(totalPendente)}</strong></span>
          <span className="text-muted-foreground">Pago: <strong className="text-orange-600">{formatBRL(totalPago)}</strong></span>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/financeiro/contas-a-pagar?de=${filtroDe}&ate=${filtroAte}&status=${tab.key}`)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${statusFiltro === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma conta encontrada</TableCell>
              </TableRow>
            )}
            {filtradas.map((c) => {
              const vencido = isVencido(c.data_vencimento, c.status);
              const cfg = STATUS_CONFIG[vencido ? "VENCIDO" : c.status];
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.fornecedor ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.plano_contas?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium text-orange-600">{formatBRL(c.valor)}</TableCell>
                  <TableCell className={`text-sm ${vencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {new Date(c.data_vencimento).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.forma_pagamento ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.status === "PENDENTE" && (
                        <Button size="icon" variant="ghost" className="size-7 text-primary hover:text-primary" title="Baixar"
                          onClick={() => { formBaixar.setValue("valor_pago", String(Number(c.valor).toFixed(2))); formBaixar.setValue("data_pagamento", new Date().toISOString().split("T")[0]); setModalBaixar(c); }}>
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {c.status !== "PAGO" && (
                        <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => setExcluindo(c)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal nova conta */}
      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
          <form onSubmit={formNovo.handleSubmit(onSubmitNovo)} className="space-y-3">
            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Input {...formNovo.register("descricao")} placeholder="Ex.: Aluguel do escritório" />
              {formNovo.formState.errors.descricao && <p className="text-xs text-destructive">{formNovo.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input {...formNovo.register("fornecedor")} placeholder="Nome do fornecedor ou credor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor *</Label>
                <Input {...formNovo.register("valor")} type="number" step="0.01" min="0.01" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Vencimento *</Label>
                <Input {...formNovo.register("data_vencimento")} type="date" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoria (despesa)</Label>
              <Select value={formNovo.watch("plano_contas_id") ?? ""} onValueChange={(v) => formNovo.setValue("plano_contas_id", v === "nenhuma" ? undefined : v ?? undefined)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea {...formNovo.register("observacoes")} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNovo(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal baixar */}
      <Dialog open={!!modalBaixar} onOpenChange={(v) => !v && setModalBaixar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          <form onSubmit={formBaixar.handleSubmit(onSubmitBaixar)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data do pagamento *</Label>
                <Input {...formBaixar.register("data_pagamento")} type="date" />
              </div>
              <div className="space-y-1">
                <Label>Valor pago *</Label>
                <Input {...formBaixar.register("valor_pago")} type="number" step="0.01" min="0.01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento *</Label>
              <Select value={formBaixar.watch("forma_pagamento") ?? ""} onValueChange={(v) => formBaixar.setValue("forma_pagamento", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {contasBancarias.length > 0 && (
              <div className="space-y-1">
                <Label>Conta bancária</Label>
                <Select value={formBaixar.watch("conta_bancaria_id") ?? ""} onValueChange={(v) => formBaixar.setValue("conta_bancaria_id", v === "nenhuma" ? undefined : v ?? undefined)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    {contasBancarias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalBaixar(null)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Confirmar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a pagar?</AlertDialogTitle>
            <AlertDialogDescription>A conta <strong>{excluindo?.descricao}</strong> será excluída permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
