"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Printer, CheckCircle, Car, UtensilsCrossed, Hotel, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarReembolso, editarReembolso, excluirReembolso, marcarPago } from "@/actions/reembolsos";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClienteSimples {
  id: string; nome: string;
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
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  km: z.coerce.number().nonnegative().optional().nullable(),
  valor_km: z.coerce.number().nonnegative().optional().nullable(),
  clientes_ids: z.array(z.string()).default([]),
});

const schema = z.object({
  periodo: z.string().min(1, "Informe o período"),
  descricao: z.string().optional(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPOS = {
  DESLOCAMENTO: { label: "Deslocamento", icon: Car, color: "text-blue-600" },
  REFEICAO:     { label: "Refeição",     icon: UtensilsCrossed, color: "text-orange-600" },
  HOTEL:        { label: "Hotel",        icon: Hotel, color: "text-purple-600" },
  PEDAGIO:      { label: "Pedágio",      icon: ReceiptText, color: "text-slate-600" },
} as const;

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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReembolsoClient({
  reembolsos, clientes,
}: {
  reembolsos: Reembolso[];
  clientes: ClienteSimples[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Reembolso | null>(null);
  const [excluindo, setExcluindo] = useState<Reembolso | null>(null);

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
    append({ tipo, data: hoje, descricao: "", valor: 0, km: null, valor_km: null, clientes_ids: [] });
  }

  function onClienteSelecionado(index: number, clienteId: string, checked: boolean) {
    const atual = form.getValues(`itens.${index}.clientes_ids`) ?? [];
    const novos = checked ? [...atual, clienteId] : atual.filter((id) => id !== clienteId);
    form.setValue(`itens.${index}.clientes_ids`, novos);

    // Auto-preenche km e valor_km do primeiro cliente selecionado
    if (checked && novos.length === 1) {
      const c = clientes.find((cl) => cl.id === clienteId);
      if (c?.distancia_km) form.setValue(`itens.${index}.km`, Number(c.distancia_km));
      if (c?.preco_km) form.setValue(`itens.${index}.valor_km`, Number(c.preco_km));
    }
    // Recalcula valor
    const km = form.getValues(`itens.${index}.km`) ?? 0;
    const vkm = form.getValues(`itens.${index}.valor_km`) ?? 0;
    if (km && vkm) form.setValue(`itens.${index}.valor`, Number((km * vkm).toFixed(2)));
  }

  function onKmChange(index: number, km: number) {
    const vkm = form.getValues(`itens.${index}.valor_km`) ?? 0;
    if (vkm) form.setValue(`itens.${index}.valor`, Number((km * vkm).toFixed(2)));
  }

  function onValorKmChange(index: number, vkm: number) {
    const km = form.getValues(`itens.${index}.km`) ?? 0;
    if (km) form.setValue(`itens.${index}.valor`, Number((km * vkm).toFixed(2)));
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
        <Button onClick={abrirNovo} className="gap-2">
          <Plus className="size-4" /> Novo Reembolso
        </Button>
      </div>

      {/* Tabela */}
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
                      <Button size="icon" variant="ghost" className="size-7" title="Imprimir relatório">
                        <Printer className="size-3.5" />
                      </Button>
                    </a>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Reembolso" : "Novo Reembolso"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Cabeçalho do relatório */}
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

            {/* Itens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens de despesa</Label>
                <div className="flex gap-1">
                  {(["DESLOCAMENTO", "REFEICAO", "HOTEL", "PEDAGIO"] as const).map((tipo) => {
                    const cfg = TIPOS[tipo];
                    return (
                      <Button key={tipo} type="button" size="sm" variant="outline"
                        className="gap-1.5 text-xs h-7" onClick={() => adicionarItem(tipo)}>
                        <cfg.icon className={`size-3 ${cfg.color}`} />
                        {cfg.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Clique em um tipo de despesa acima para adicionar
                </p>
              )}

              {fields.map((field, index) => {
                const tipo = form.watch(`itens.${index}.tipo`);
                const cfg = TIPOS[tipo];
                const clientesSelecionados = form.watch(`itens.${index}.clientes_ids`) ?? [];
                const valorItem = Number(form.watch(`itens.${index}.valor`) || 0);
                const rateio = clientesSelecionados.length > 1
                  ? valorItem / clientesSelecionados.length
                  : null;

                return (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <cfg.icon className={`size-4 ${cfg.color}`} />
                        <span className="font-medium text-sm">{cfg.label}</span>
                      </div>
                      <Button type="button" size="icon" variant="ghost"
                        className="size-6 text-destructive hover:text-destructive"
                        onClick={() => remove(index)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Data *</Label>
                        <Input type="date" className="h-8 text-sm" {...form.register(`itens.${index}.data`)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descrição *</Label>
                        <Input className="h-8 text-sm" placeholder="Descreva a despesa"
                          {...form.register(`itens.${index}.descricao`)} />
                      </div>
                    </div>

                    {tipo === "DESLOCAMENTO" && (
                      <>
                        {/* Seleção de clientes */}
                        <div className="space-y-1">
                          <Label className="text-xs">Clientes atendidos</Label>
                          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1 bg-white">
                            {clientes.map((c) => {
                              const selecionado = clientesSelecionados.includes(c.id);
                              return (
                                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-1 rounded">
                                  <input type="checkbox" checked={selecionado}
                                    onChange={(e) => onClienteSelecionado(index, c.id, e.target.checked)}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{c.nome}</span>
                                  {c.distancia_km && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {Number(c.distancia_km)}km · R${Number(c.preco_km ?? 0).toFixed(2)}/km
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Distância (km)</Label>
                            <Input type="number" step="0.1" className="h-8 text-sm"
                              {...form.register(`itens.${index}.km`, {
                                onChange: (e) => onKmChange(index, Number(e.target.value)),
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor por km (R$)</Label>
                            <Input type="number" step="0.01" className="h-8 text-sm"
                              {...form.register(`itens.${index}.valor_km`, {
                                onChange: (e) => onValorKmChange(index, Number(e.target.value)),
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total (R$)</Label>
                            <Input type="number" step="0.01" className="h-8 text-sm font-semibold"
                              {...form.register(`itens.${index}.valor`)}
                            />
                          </div>
                        </div>

                        {rateio && (
                          <p className="text-xs text-muted-foreground bg-blue-50 px-3 py-1.5 rounded">
                            Rateio entre {clientesSelecionados.length} clientes:{" "}
                            <strong>{fmtBRL(rateio)}</strong> por cliente
                          </p>
                        )}
                      </>
                    )}

                    {tipo !== "DESLOCAMENTO" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input type="number" step="0.01" className="h-8 text-sm"
                          {...form.register(`itens.${index}.valor`)}
                        />
                      </div>
                    )}

                    {form.formState.errors.itens?.[index]?.descricao && (
                      <p className="text-xs text-destructive">{form.formState.errors.itens[index]?.descricao?.message}</p>
                    )}
                  </div>
                );
              })}

              {fields.length > 0 && (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">
                    Total: <strong className="text-base ml-1">{fmtBRL(totalForm)}</strong>
                  </div>
                </div>
              )}
            </div>

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
