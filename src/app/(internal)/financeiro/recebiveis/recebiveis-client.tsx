"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, Trash2, CheckCircle, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarRecebivel, baixarRecebivel, excluirRecebivel, gerarParcelasContrato } from "@/actions/recebiveis";

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
  valor: z.string().min(1, "Valor obrigatório"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  cliente_id: z.string().optional(),
  contrato_id: z.string().optional(),
  plano_contas_id: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.string().min(1, "Valor obrigatório"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});

const schemaParcelas = z.object({
  contrato_id: z.string().min(1, "Contrato obrigatório"),
  n_parcelas: z.string().min(1),
  data_primeira: z.string().min(1, "Data obrigatória"),
  valor_parcela: z.string().min(1, "Valor obrigatório"),
  plano_contas_id: z.string().optional(),
});

type FormCreate = z.input<typeof schemaCreate>;
type FormBaixar = z.input<typeof schemaBaixar>;
type FormParcelas = z.input<typeof schemaParcelas>;

interface Recebivel {
  id: string; descricao: string; valor: string | number; data_vencimento: Date;
  status: Status; data_pagamento: Date | null; valor_pago: string | number | null;
  forma_pagamento: string | null; numero_parcela: number | null; total_parcelas: number | null;
  cliente: { id: string; nome: string } | null;
  contrato: { id: string; titulo: string; numero_contrato: string | null } | null;
  plano_contas: { id: string; nome: string } | null;
}

interface Contrato {
  id: string; titulo: string; cliente_id: string; valor_total: string | number;
  cliente: { nome: string };
}

interface ModeloDoc {
  id: string;
  nome: string;
}

interface Props {
  recebiveis: Recebivel[];
  clientes: { id: string; nome: string }[];
  contratos: Contrato[];
  categorias: { id: string; nome: string }[];
  contasBancarias: { id: string; nome: string }[];
  anoMes: string;
  statusFiltro: string;
  modelosRecibo: ModeloDoc[];
}

function formatBRL(v: string | number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isVencido(data: Date, status: Status) {
  return status === "PENDENTE" && new Date(data) < new Date();
}

export default function RecebiveisClient({ recebiveis: inicial, clientes, contratos, categorias, contasBancarias, anoMes, statusFiltro, modelosRecibo }: Props) {
  const router = useRouter();
  const [recebiveis, setRecebiveis] = useState(inicial);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalBaixar, setModalBaixar] = useState<Recebivel | null>(null);
  const [modalParcelas, setModalParcelas] = useState(false);
  const [modalRecibo, setModalRecibo] = useState<Recebivel | null>(null);
  const [excluindo, setExcluindo] = useState<Recebivel | null>(null);
  const [isPending, startTransition] = useTransition();

  const [ano, mes] = anoMes.split("-").map(Number);

  const navMes = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    const novoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/financeiro/recebiveis?mes=${novoMes}&status=${statusFiltro}`);
  };

  const nomeMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const statusFiltrados = statusFiltro === "TODOS" ? recebiveis : recebiveis.filter((r) => r.status === statusFiltro);

  const totalPendente = recebiveis.filter((r) => r.status === "PENDENTE").reduce((s, r) => s + Number(r.valor), 0);
  const totalPago = recebiveis.filter((r) => r.status === "PAGO").reduce((s, r) => s + Number(r.valor_pago ?? r.valor), 0);

  // Formulário criar
  const formNovo = useForm<FormCreate>({ resolver: zodResolver(schemaCreate) });
  const onSubmitNovo = (data: FormCreate) => {
    startTransition(async () => {
      try {
        const res = await criarRecebivel({ ...data, valor: Number(data.valor) });
        setRecebiveis((prev) => [...prev, res.data as unknown as Recebivel]);
        toast.success("Recebível criado");
        setModalNovo(false);
        formNovo.reset();
      } catch { toast.error("Erro ao criar recebível"); }
    });
  };

  // Formulário baixar
  const formBaixar = useForm<FormBaixar>({ resolver: zodResolver(schemaBaixar) });
  const onSubmitBaixar = (data: FormBaixar) => {
    if (!modalBaixar) return;
    startTransition(async () => {
      try {
        await baixarRecebivel(modalBaixar.id, { ...data, valor_pago: Number(data.valor_pago) });
        setRecebiveis((prev) => prev.map((r) => r.id === modalBaixar.id ? { ...r, status: "PAGO", data_pagamento: new Date(data.data_pagamento), valor_pago: data.valor_pago, forma_pagamento: data.forma_pagamento } : r));
        toast.success("Recebível baixado");
        setModalBaixar(null);
        formBaixar.reset();
      } catch { toast.error("Erro ao baixar recebível"); }
    });
  };

  // Formulário parcelas
  const formParcelas = useForm<FormParcelas>({ resolver: zodResolver(schemaParcelas) });
  const contratoSelecionado = contratos.find((c) => c.id === formParcelas.watch("contrato_id"));
  const nParcelas = Number(formParcelas.watch("n_parcelas") || 1);
  const valorSugerido = contratoSelecionado ? (Number(contratoSelecionado.valor_total) / nParcelas).toFixed(2) : "";

  const onSubmitParcelas = (data: FormParcelas) => {
    startTransition(async () => {
      try {
        await gerarParcelasContrato(data.contrato_id, {
          n_parcelas: Number(data.n_parcelas),
          data_primeira: data.data_primeira,
          valor_parcela: Number(data.valor_parcela),
          plano_contas_id: data.plano_contas_id,
        });
        toast.success(`${data.n_parcelas} parcelas geradas`);
        setModalParcelas(false);
        formParcelas.reset();
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao gerar parcelas");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!excluindo) return;
    startTransition(async () => {
      try {
        await excluirRecebivel(excluindo.id);
        setRecebiveis((prev) => prev.filter((r) => r.id !== excluindo.id));
        toast.success("Recebível excluído");
        setExcluindo(null);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      }
    });
  };

  const tabs: { key: string; label: string }[] = [
    { key: "TODOS", label: "Todos" },
    { key: "PENDENTE", label: "Pendente" },
    { key: "VENCIDO", label: "Vencido" },
    { key: "PAGO", label: "Pago" },
    { key: "CANCELADO", label: "Cancelado" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Recebíveis</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { formParcelas.reset(); setModalParcelas(true); }}>
            Gerar parcelas de contrato
          </Button>
          <Button size="sm" onClick={() => { formNovo.reset(); setModalNovo(true); }}>
            <Plus className="size-4 mr-1.5" /> Novo recebível
          </Button>
        </div>
      </div>

      {/* Navegação de mês + totais */}
      <div className="flex items-center justify-between">
        {statusFiltro !== "PAGO" && statusFiltro !== "CANCELADO" ? (
          <span className="text-sm text-muted-foreground">Todos os meses</span>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium capitalize">{nomeMes}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => navMes(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Pendente: <strong className="text-foreground">{formatBRL(totalPendente)}</strong></span>
          <span className="text-muted-foreground">Recebido: <strong className="text-primary">{formatBRL(totalPago)}</strong></span>
        </div>
      </div>

      {/* Tabs de status */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/financeiro/recebiveis?mes=${anoMes}&status=${tab.key}`)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusFiltro === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {statusFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhum recebível encontrado
                </TableCell>
              </TableRow>
            )}
            {statusFiltrados.map((r) => {
              const vencido = isVencido(r.data_vencimento, r.status);
              const cfg = STATUS_CONFIG[vencido ? "VENCIDO" : r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium max-w-[220px]">
                    <span className="block truncate" title={r.descricao}>{r.descricao}</span>
                    {r.numero_parcela && r.total_parcelas && (
                      <span className="text-xs text-muted-foreground">{r.numero_parcela}/{r.total_parcelas}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[140px]">
                    <span className="block truncate" title={r.cliente?.nome}>{r.cliente?.nome ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.contrato?.numero_contrato ?? r.contrato?.titulo ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(r.valor)}</TableCell>
                  <TableCell className={`text-sm ${vencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {new Date(r.data_vencimento).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.forma_pagamento ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "PENDENTE" && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-primary hover:text-primary"
                          title="Baixar pagamento"
                          onClick={() => { formBaixar.setValue("valor_pago", String(Number(r.valor).toFixed(2))); formBaixar.setValue("data_pagamento", new Date().toISOString().split("T")[0]); setModalBaixar(r); }}
                        >
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {r.status === "PAGO" && modelosRecibo.length > 0 && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground"
                          title="Emitir recibo"
                          onClick={() => setModalRecibo(r)}
                        >
                          <Receipt className="size-3.5" />
                        </Button>
                      )}
                      {r.status !== "PAGO" && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setExcluindo(r)}
                        >
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

      {/* Modal novo recebível */}
      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo recebível</DialogTitle></DialogHeader>
          <form onSubmit={formNovo.handleSubmit(onSubmitNovo)} className="space-y-3">
            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Input {...formNovo.register("descricao")} placeholder="Ex.: Honorários Consultoria Abril" />
              {formNovo.formState.errors.descricao && <p className="text-xs text-destructive">{formNovo.formState.errors.descricao.message}</p>}
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
              <Label>Cliente</Label>
              <Select value={formNovo.watch("cliente_id") ?? ""} onValueChange={(v) => formNovo.setValue("cliente_id", v === "nenhum" ? undefined : v ?? undefined)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
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
                <SelectContent>
                  {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              {formBaixar.formState.errors.forma_pagamento && <p className="text-xs text-destructive">{formBaixar.formState.errors.forma_pagamento.message}</p>}
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
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Confirmar pagamento"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal gerar parcelas */}
      <Dialog open={modalParcelas} onOpenChange={setModalParcelas}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerar parcelas de contrato</DialogTitle></DialogHeader>
          <form onSubmit={formParcelas.handleSubmit(onSubmitParcelas)} className="space-y-3">
            <div className="space-y-1">
              <Label>Contrato *</Label>
              <Select value={formParcelas.watch("contrato_id") ?? ""} onValueChange={(v) => formParcelas.setValue("contrato_id", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => <SelectItem key={c.id} value={c.id}>{c.titulo} — {c.cliente.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {formParcelas.formState.errors.contrato_id && <p className="text-xs text-destructive">{formParcelas.formState.errors.contrato_id.message}</p>}
            </div>
            {contratoSelecionado && (
              <p className="text-xs text-muted-foreground">
                Valor do contrato: <strong>{formatBRL(contratoSelecionado.valor_total)}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nº de parcelas *</Label>
                <Input {...formParcelas.register("n_parcelas")} type="number" min="1" max="24" defaultValue="1" />
              </div>
              <div className="space-y-1">
                <Label>Data da 1ª parcela *</Label>
                <Input {...formParcelas.register("data_primeira")} type="date" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valor por parcela *</Label>
              <Input
                {...formParcelas.register("valor_parcela")}
                type="number" step="0.01" min="0.01"
                placeholder={valorSugerido || "0,00"}
                defaultValue={valorSugerido}
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={formParcelas.watch("plano_contas_id") ?? ""} onValueChange={(v) => formParcelas.setValue("plano_contas_id", v === "nenhuma" ? undefined : v ?? undefined)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalParcelas(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Gerando..." : "Gerar parcelas"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal emitir recibo */}
      <Dialog open={!!modalRecibo} onOpenChange={(v) => !v && setModalRecibo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Emitir recibo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o modelo de recibo:</p>
          <div className="space-y-2">
            {modelosRecibo.map((m) => (
              <button
                key={m.id}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
                onClick={() => {
                  setModalRecibo(null);
                  window.open(`/modelos/${m.id}/preview?recebivel_id=${modalRecibo!.id}`, "_blank");
                }}
              >
                {m.nome}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRecibo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir */}
      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recebível?</AlertDialogTitle>
            <AlertDialogDescription>
              O recebível <strong>{excluindo?.descricao}</strong> será excluído permanentemente.
            </AlertDialogDescription>
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
