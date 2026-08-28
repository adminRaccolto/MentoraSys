"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Printer, CheckCircle, Car, UtensilsCrossed, Hotel, ReceiptText, Users, Settings, Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarReembolso, editarReembolso, excluirReembolso, marcarPago, enviarEmailsReembolso } from "@/actions/reembolsos";
import { salvarPagamentoReembolso } from "@/actions/configuracoes";
import type { PagamentoReembolso } from "./page";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClienteSimples {
  id: string; nome: string; email: string | null;
  distancia_km: number | null; preco_km: number | null;
  cidade: string | null; estado: string | null;
}

interface ReembolsoItem {
  id: string; tipo: string; data: Date; descricao: string; valor: number | string;
  km: number | null; valor_km: number | null; clientes_ids: string[];
}

interface Reembolso {
  id: string; periodo: string; descricao: string | null;
  status: string; total: number | string; criado_em: Date;
  itens: ReembolsoItem[];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schemaItem = z.object({
  tipo: z.enum(["DESLOCAMENTO", "REFEICAO", "HOTEL", "PEDAGIO"]),
  data: z.string().min(1, "Informe a data"),
  descricao: z.string().min(1, "Informe a descrição"),
  valor: z.number({ error: "Valor deve ser positivo" }).positive(),
  km: z.number().nonnegative().nullish(),
  valor_km: z.number().nonnegative().nullish(),
  clientes_ids: z.array(z.string()),
});

const schema = z.object({
  periodo: z.string().min(1, "Informe o período"),
  descricao: z.string().optional(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type FormData = z.infer<typeof schema>;

// ─── Sections config ──────────────────────────────────────────────────────────

const SECTIONS = [
  { tipo: "DESLOCAMENTO" as const, label: "Deslocamento", icon: Car,            color: "text-blue-600" },
  { tipo: "REFEICAO"     as const, label: "Refeição",     icon: UtensilsCrossed, color: "text-orange-600" },
  { tipo: "HOTEL"        as const, label: "Hotel",         icon: Hotel,           color: "text-purple-600" },
  { tipo: "PEDAGIO"      as const, label: "Pedágio",       icon: ReceiptText,     color: "text-slate-600" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}

const hoje = new Date().toISOString().split("T")[0];
const periodoAtual = hoje.slice(0, 7);

// ─── Currency Input ───────────────────────────────────────────────────────────

function CurrencyInput({
  value, onChange, onBlur, className,
}: {
  value: number; onChange: (v: number) => void; onBlur?: () => void; className?: string;
}) {
  const fmt = (n: number) =>
    (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none select-none">
        R$
      </span>
      <Input
        className={cn("pl-7 text-right tabular-nums", className)}
        type="text"
        inputMode="numeric"
        value={fmt(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(parseInt(digits || "0") / 100);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}

// ─── Client Picker ────────────────────────────────────────────────────────────

function ClientePicker({
  selecionados, clientes, onChange,
}: {
  selecionados: string[]; clientes: ClienteSimples[]; onChange: (ids: string[]) => void;
}) {
  const nomes = selecionados.map((id) => clientes.find((c) => c.id === id)?.nome ?? id);

  return (
    <Popover>
      <PopoverTrigger className="text-xs border rounded px-2 h-7 w-full text-left hover:bg-slate-50 flex items-center gap-1 min-w-0">
        {nomes.length > 0
          ? <span className="truncate flex-1">{nomes.join(", ")}</span>
          : <span className="text-muted-foreground">Selecionar…</span>}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2 max-h-52 overflow-y-auto" align="start">
        <div className="space-y-0.5">
          {clientes.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 px-1.5 py-1.5 rounded">
              <input
                type="checkbox"
                checked={selecionados.includes(c.id)}
                onChange={(e) => {
                  const novo = e.target.checked
                    ? [...selecionados, c.id]
                    : selecionados.filter((id) => id !== c.id);
                  onChange(novo);
                }}
                className="rounded shrink-0"
              />
              <span className="flex-1 truncate">{c.nome}</span>
              {c.distancia_km && (
                <span className="text-muted-foreground shrink-0">{c.distancia_km}km</span>
              )}
            </label>
          ))}
          {clientes.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Nenhum cliente cadastrado</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const schemaPagamento = z.object({
  banco: z.string(),
  agencia: z.string(),
  conta: z.string(),
  tipo_conta: z.string(),
  chave_pix: z.string(),
});
type PagamentoForm = z.infer<typeof schemaPagamento>;

export default function ReembolsoClient({
  reembolsos, clientes, pagamentoConfig,
}: {
  reembolsos: Reembolso[];
  clientes: ClienteSimples[];
  pagamentoConfig: PagamentoReembolso | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Reembolso | null>(null);
  const [excluindo, setExcluindo] = useState<Reembolso | null>(null);
  const [relatorioCliente, setRelatorioCliente] = useState<Reembolso | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [enviandoEmails, setEnviandoEmails] = useState<Reembolso | null>(null);
  const [resultadoEnvio, setResultadoEnvio] = useState<
    { clienteId: string; nome: string; email: string | null; ok: boolean; erro?: string; recebivel?: "criado" | "existente" }[] | null
  >(null);

  const formPagamento = useForm<PagamentoForm>({
    resolver: zodResolver(schemaPagamento),
    defaultValues: {
      banco: pagamentoConfig?.banco ?? "",
      agencia: pagamentoConfig?.agencia ?? "",
      conta: pagamentoConfig?.conta ?? "",
      tipo_conta: pagamentoConfig?.tipo_conta ?? "corrente",
      chave_pix: pagamentoConfig?.chave_pix ?? "",
    },
  });

  function abrirEnvioEmails(r: Reembolso) {
    setResultadoEnvio(null);
    setEnviandoEmails(r);
  }

  function handleEnviarEmails(r: Reembolso) {
    startTransition(async () => {
      try {
        const { resultados } = await enviarEmailsReembolso(r.id);
        setResultadoEnvio(resultados);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar e-mails");
      }
    });
  }

  function abrirPagamento() {
    formPagamento.reset({
      banco: pagamentoConfig?.banco ?? "",
      agencia: pagamentoConfig?.agencia ?? "",
      conta: pagamentoConfig?.conta ?? "",
      tipo_conta: pagamentoConfig?.tipo_conta ?? "corrente",
      chave_pix: pagamentoConfig?.chave_pix ?? "",
    });
    setModalPagamento(true);
  }

  function salvarPagamento(data: PagamentoForm) {
    startTransition(async () => {
      try {
        await salvarPagamentoReembolso({
          banco: data.banco ?? "",
          agencia: data.agencia ?? "",
          conta: data.conta ?? "",
          tipo_conta: data.tipo_conta ?? "corrente",
          chave_pix: data.chave_pix ?? "",
        });
        toast.success("Dados de pagamento salvos!");
        setModalPagamento(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { periodo: periodoAtual, descricao: "", itens: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "itens" });

  function abrirNovo() {
    form.reset({ periodo: periodoAtual, descricao: "", itens: [] });
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(r: Reembolso) {
    form.reset({
      periodo: r.periodo,
      descricao: r.descricao ?? "",
      itens: r.itens.map((i) => ({
        tipo: i.tipo as FormData["itens"][0]["tipo"],
        data: new Date(i.data).toISOString().split("T")[0],
        descricao: i.descricao,
        valor: Number(i.valor),
        km: i.km != null ? Number(i.km) : null,
        valor_km: i.valor_km != null ? Number(i.valor_km) : null,
        clientes_ids: i.clientes_ids,
      })),
    });
    setEditando(r);
    setModalAberto(true);
  }

  function adicionarItem(tipo: FormData["itens"][0]["tipo"]) {
    append({
      tipo,
      data: hoje,
      descricao: tipo === "DESLOCAMENTO" ? "Deslocamento" : "",
      valor: 0,
      km: null,
      valor_km: null,
      clientes_ids: [],
    });
  }

  function onSubmit(data: FormData) {
    startTransition(async () => {
      try {
        if (editando) {
          await editarReembolso(editando.id, data);
          toast.success("Reembolso atualizado!");
        } else {
          await criarReembolso(data);
          toast.success("Reembolso criado!");
        }
        setModalAberto(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      try {
        await excluirReembolso(id);
        toast.success("Reembolso excluído!");
        setExcluindo(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      }
    });
  }

  function handleMarcarPago(id: string) {
    startTransition(async () => {
      try {
        await marcarPago(id);
        toast.success("Marcado como pago!");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  const watchItens = form.watch("itens");
  const totalForm = watchItens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios de Reembolso</h1>
          <p className="text-muted-foreground text-sm">Deslocamento, refeição, hotel e pedágios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={abrirPagamento} title="Dados de pagamento">
            <Settings className="size-4" />
          </Button>
          <Button onClick={abrirNovo} className="gap-2">
            <Plus className="size-4" /> Novo Reembolso
          </Button>
        </div>
      </div>

      {/* Lista de reembolsos */}
      {reembolsos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          Nenhum reembolso registrado ainda.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reembolsos.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{periodoLabel(r.periodo)}</TableCell>
                <TableCell className="text-muted-foreground">{r.descricao ?? "—"}</TableCell>
                <TableCell className="text-center">{r.itens.length}</TableCell>
                <TableCell className="text-right font-semibold">{fmtBRL(r.total)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "PAGO" ? "default" : "outline"}
                    className={r.status === "PAGO" ? "bg-green-600 text-white" : "text-amber-700 border-amber-400"}>
                    {r.status === "PAGO" ? "Pago" : "Em aberto"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <a href={`/reembolso/${r.id}`} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="size-7" title="Relatório interno completo">
                        <Printer className="size-3.5" />
                      </Button>
                    </a>
                    {r.itens.some((i) => i.clientes_ids.length > 0) && (
                      <Button size="icon" variant="ghost" className="size-7 text-blue-600 hover:text-blue-600"
                        title="Relatório por cliente" onClick={() => setRelatorioCliente(r)}>
                        <Users className="size-3.5" />
                      </Button>
                    )}
                    {r.itens.some((i) => i.clientes_ids.length > 0) && (
                      <Button size="icon" variant="ghost" className="size-7 text-emerald-600 hover:text-emerald-600"
                        title="Enviar e-mails de cobrança" onClick={() => abrirEnvioEmails(r)}>
                        <Mail className="size-3.5" />
                      </Button>
                    )}
                    {r.status !== "PAGO" && (
                      <Button size="icon" variant="ghost" className="size-7 text-green-600 hover:text-green-600"
                        title="Marcar como pago" onClick={() => handleMarcarPago(r.id)} disabled={isPending}>
                        <CheckCircle className="size-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-7" title="Editar"
                      onClick={() => abrirEditar(r)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                      title="Excluir" onClick={() => setExcluindo(r)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Reembolso" : "Novo Reembolso"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Período + Descrição */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Período *</Label>
                <Input type="month" {...form.register("periodo")} />
                {form.formState.errors.periodo && (
                  <p className="text-xs text-destructive">{form.formState.errors.periodo.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Descrição (opcional)</Label>
                <Input placeholder="Ex: Visita Região Sul" {...form.register("descricao")} />
              </div>
            </div>

            {/* Seções por tipo de despesa */}
            <div className="space-y-4">
              {SECTIONS.map(({ tipo, label, icon: Icon, color }) => {
                const secItens = fields
                  .map((f, idx) => ({ ...f, idx }))
                  .filter((f) => f.tipo === tipo);
                const subtotal = secItens.reduce((s, { idx }) => s + (Number(watchItens[idx]?.valor) || 0), 0);

                return (
                  <div key={tipo} className="border rounded-lg overflow-hidden">
                    {/* Header da seção */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("size-4", color)} />
                        <span className="text-sm font-semibold">{label}</span>
                        {subtotal > 0 && (
                          <span className="text-xs text-muted-foreground">
                            — {fmtBRL(subtotal)}
                          </span>
                        )}
                      </div>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => adicionarItem(tipo)}>
                        <Plus className="size-3" /> Adicionar
                      </Button>
                    </div>

                    {secItens.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3 px-4">
                        Nenhum item — clique em Adicionar
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-slate-500">
                              <th className="text-left px-3 py-2 font-medium w-32">Data</th>
                              {tipo === "DESLOCAMENTO" ? (
                                <>
                                  <th className="text-left px-3 py-2 font-medium">Clientes</th>
                                  <th className="text-left px-3 py-2 font-medium w-20">km</th>
                                  <th className="text-left px-3 py-2 font-medium w-24">R$/km</th>
                                  <th className="text-left px-3 py-2 font-medium w-32">Total</th>
                                </>
                              ) : (
                                <>
                                  <th className="text-left px-3 py-2 font-medium">Descrição</th>
                                  <th className="text-left px-3 py-2 font-medium w-36">Valor</th>
                                </>
                              )}
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {secItens.map(({ idx }) => (
                              <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/50">
                                {/* Data */}
                                <td className="px-2 py-1.5">
                                  <Input type="date" className="h-7 text-xs w-full"
                                    {...form.register(`itens.${idx}.data`)} />
                                </td>

                                {tipo === "DESLOCAMENTO" ? (
                                  <>
                                    {/* Clientes */}
                                    <td className="px-2 py-1.5 min-w-40">
                                      <Controller
                                        control={form.control}
                                        name={`itens.${idx}.clientes_ids`}
                                        render={({ field }) => (
                                          <ClientePicker
                                            selecionados={field.value}
                                            clientes={clientes}
                                            onChange={(ids) => {
                                              field.onChange(ids);
                                              if (ids.length === 1) {
                                                const c = clientes.find((cl) => cl.id === ids[0]);
                                                const km = c?.distancia_km ? Number(c.distancia_km) : (form.getValues(`itens.${idx}.km`) ?? 0);
                                                const vkm = c?.preco_km ? Number(c.preco_km) : (form.getValues(`itens.${idx}.valor_km`) ?? 0);
                                                if (c?.distancia_km) form.setValue(`itens.${idx}.km`, km);
                                                if (c?.preco_km) form.setValue(`itens.${idx}.valor_km`, vkm);
                                                if (km && vkm) form.setValue(`itens.${idx}.valor`, Number((km * vkm).toFixed(2)));
                                              }
                                            }}
                                          />
                                        )}
                                      />
                                    </td>
                                    {/* km */}
                                    <td className="px-2 py-1.5">
                                      <Input type="number" step="0.1" min="0" className="h-7 text-xs"
                                        {...form.register(`itens.${idx}.km`, {
                                          valueAsNumber: true,
                                          onChange: (e) => {
                                            const km = Number(e.target.value);
                                            const vkm = Number(form.getValues(`itens.${idx}.valor_km`) ?? 0);
                                            if (km >= 0 && vkm > 0) form.setValue(`itens.${idx}.valor`, Number((km * vkm).toFixed(2)));
                                          },
                                        })}
                                      />
                                    </td>
                                    {/* R$/km */}
                                    <td className="px-2 py-1.5">
                                      <Input type="number" step="0.01" min="0" className="h-7 text-xs"
                                        {...form.register(`itens.${idx}.valor_km`, {
                                          valueAsNumber: true,
                                          onChange: (e) => {
                                            const vkm = Number(e.target.value);
                                            const km = Number(form.getValues(`itens.${idx}.km`) ?? 0);
                                            if (km > 0 && vkm >= 0) form.setValue(`itens.${idx}.valor`, Number((km * vkm).toFixed(2)));
                                          },
                                        })}
                                      />
                                    </td>
                                    {/* Total */}
                                    <td className="px-2 py-1.5">
                                      <Controller
                                        control={form.control}
                                        name={`itens.${idx}.valor`}
                                        render={({ field }) => (
                                          <CurrencyInput value={field.value} onChange={field.onChange}
                                            onBlur={field.onBlur} className="h-7 text-xs font-semibold" />
                                        )}
                                      />
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {/* Descrição */}
                                    <td className="px-2 py-1.5">
                                      <Input className="h-7 text-xs" placeholder="Descrição da despesa"
                                        {...form.register(`itens.${idx}.descricao`)} />
                                    </td>
                                    {/* Valor */}
                                    <td className="px-2 py-1.5">
                                      <Controller
                                        control={form.control}
                                        name={`itens.${idx}.valor`}
                                        render={({ field }) => (
                                          <CurrencyInput value={field.value} onChange={field.onChange}
                                            onBlur={field.onBlur} className="h-7 text-xs" />
                                        )}
                                      />
                                    </td>
                                  </>
                                )}

                                {/* Excluir */}
                                <td className="px-1 py-1.5">
                                  <Button type="button" size="icon" variant="ghost"
                                    className="size-6 text-destructive hover:text-destructive"
                                    onClick={() => remove(idx)}>
                                    <Trash2 className="size-3" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total geral */}
            {watchItens.length > 0 && (
              <div className="flex justify-end pt-1">
                <div className="bg-primary text-primary-foreground rounded-lg px-5 py-3">
                  Total geral: <strong className="text-base ml-2">{fmtBRL(totalForm)}</strong>
                </div>
              </div>
            )}

            {form.formState.errors.itens?.root && (
              <p className="text-xs text-destructive text-center">
                {form.formState.errors.itens.root.message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : editando ? "Salvar alterações" : "Criar reembolso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Seleção de cliente para relatório rateado */}
      <Dialog open={!!relatorioCliente} onOpenChange={(o) => !o && setRelatorioCliente(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Relatório por Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o cliente para gerar o relatório com os valores rateados:
            </p>
            <div className="space-y-1.5">
              {relatorioCliente && (() => {
                const ids = [...new Set(relatorioCliente.itens.flatMap((i) => i.clientes_ids))];
                const clientesDoRel = clientes.filter((c) => ids.includes(c.id));
                if (clientesDoRel.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Nenhum cliente associado a itens de deslocamento.
                    </p>
                  );
                }
                return clientesDoRel.map((c) => (
                  <a
                    key={c.id}
                    href={`/reembolso/${relatorioCliente.id}?cliente_id=${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setRelatorioCliente(null)}
                  >
                    <Button variant="outline" className="w-full justify-start gap-2 h-9">
                      <Users className="size-3.5 shrink-0" />
                      <span className="truncate">{c.nome}</span>
                    </Button>
                  </a>
                ));
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de envio de e-mails */}
      <Dialog open={!!enviandoEmails} onOpenChange={(o) => { if (!o && !isPending) { setEnviandoEmails(null); setResultadoEnvio(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar e-mails de reembolso</DialogTitle>
          </DialogHeader>

          {!resultadoEnvio ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cada cliente associado ao reembolso receberá um e-mail com o seu valor rateado e o link para o relatório.
              </p>
              {enviandoEmails && (() => {
                const ids = [...new Set(enviandoEmails.itens.flatMap((i) => i.clientes_ids))];
                const clientesDoRel = clientes.filter((c) => ids.includes(c.id));
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Destinatários ({clientesDoRel.length})
                    </p>
                    {clientesDoRel.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-slate-50">
                        <Users className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate font-medium">{c.nome}</span>
                        {c.email
                          ? <span className="text-xs text-muted-foreground truncate max-w-40">{c.email}</span>
                          : <span className="text-xs text-destructive shrink-0">sem e-mail</span>
                        }
                      </div>
                    ))}
                  </div>
                );
              })()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEnviandoEmails(null)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => enviandoEmails && handleEnviarEmails(enviandoEmails)}
                  disabled={isPending}
                  className="gap-2"
                >
                  {isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Enviando…</>
                  ) : (
                    <><Mail className="size-4" /> Enviar e-mails</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {resultadoEnvio.map((r) => (
                  <div key={r.clienteId} className={cn(
                    "flex items-start gap-3 rounded-lg p-3 text-sm",
                    r.ok ? "bg-green-50" : "bg-red-50"
                  )}>
                    {r.ok
                      ? <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
                      : <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.nome}</p>
                      {r.email
                        ? <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        : <p className="text-xs text-destructive">{r.erro}</p>
                      }
                      {!r.ok && r.erro && r.email && (
                        <p className="text-xs text-destructive mt-0.5">{r.erro}</p>
                      )}
                      {r.ok && r.recebivel && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {r.recebivel === "criado"
                            ? "✓ Lançado no contas a receber (venc. 30 dias)"
                            : "Já existe no contas a receber"}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-xs font-semibold shrink-0", r.ok ? "text-green-700" : "text-red-600")}>
                      {r.ok ? "Enviado" : "Falhou"}
                    </span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => { setEnviandoEmails(null); setResultadoEnvio(null); }}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de dados de pagamento */}
      <Dialog open={modalPagamento} onOpenChange={setModalPagamento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados de Pagamento do Reembolso</DialogTitle>
          </DialogHeader>
          <form onSubmit={formPagamento.handleSubmit(salvarPagamento)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Essas informações aparecem no relatório enviado ao cliente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Banco</Label>
                <Input placeholder="Ex: Banco do Brasil, Itaú…" {...formPagamento.register("banco")} />
              </div>
              <div className="space-y-1">
                <Label>Agência</Label>
                <Input placeholder="0000" {...formPagamento.register("agencia")} />
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Input placeholder="00000-0" {...formPagamento.register("conta")} />
              </div>
              <div className="space-y-1">
                <Label>Tipo de conta</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  {...formPagamento.register("tipo_conta")}
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Conta Poupança</option>
                  <option value="pix">Somente PIX</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Chave PIX</Label>
                <Input placeholder="CPF, e-mail, telefone…" {...formPagamento.register("chave_pix")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalPagamento(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reembolso?</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório de {excluindo && periodoLabel(excluindo.periodo)} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => excluindo && handleExcluir(excluindo.id)} disabled={isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
