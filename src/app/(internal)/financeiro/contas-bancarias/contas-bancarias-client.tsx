"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarConta, editarConta, excluirConta } from "@/actions/contas-bancarias";

const TIPO_LABEL: Record<string, string> = {
  CORRENTE: "Conta Corrente", POUPANCA: "Poupança", CAIXA: "Caixa", INVESTIMENTO: "Investimento",
};

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo: z.enum(["CORRENTE", "POUPANCA", "CAIXA", "INVESTIMENTO"]).default("CORRENTE"),
  saldo_inicial: z.string().default("0"),
});

type FormData = z.input<typeof schema>;

interface Conta {
  id: string; nome: string; banco: string | null; agencia: string | null;
  conta: string | null; tipo: string; saldo_inicial: number; saldo_atual: number; ativo: boolean;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContasBancariasClient({ contas: inicial }: { contas: Conta[] }) {
  const [contas, setContas] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const abrirNovo = () => { reset(); setEditando(null); setModalAberto(true); };
  const abrirEditar = (c: Conta) => {
    setEditando(c);
    reset({ nome: c.nome, banco: c.banco ?? "", agencia: c.agencia ?? "", conta: c.conta ?? "", tipo: c.tipo as FormData["tipo"], saldo_inicial: String(c.saldo_inicial) });
    setModalAberto(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const payload = { ...data, saldo_inicial: Number(data.saldo_inicial) };
        if (editando) {
          const res = await editarConta(editando.id, payload);
          setContas((prev) => prev.map((c) => c.id === editando.id ? { ...c, ...res.data, saldo_inicial: Number(res.data.saldo_inicial), saldo_atual: c.saldo_atual + (Number(res.data.saldo_inicial) - c.saldo_inicial) } : c));
          toast.success("Conta atualizada");
        } else {
          const res = await criarConta(payload);
          setContas((prev) => [...prev, { ...res.data, saldo_inicial: Number(res.data.saldo_inicial), saldo_atual: Number(res.data.saldo_inicial) }]);
          toast.success("Conta criada");
        }
        setModalAberto(false);
        reset();
      } catch { toast.error("Erro ao salvar conta"); }
    });
  };

  const desativar = (id: string) => {
    startTransition(async () => {
      try {
        await excluirConta(id);
        setContas((prev) => prev.map((c) => c.id === id ? { ...c, ativo: false } : c));
        toast.success("Conta desativada");
      } catch { toast.error("Erro ao desativar"); }
    });
  };

  const saldoTotal = contas.filter((c) => c.ativo).reduce((s, c) => s + c.saldo_atual, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Contas Bancárias</h1>
          <Badge variant="secondary">{contas.filter((c) => c.ativo).length}</Badge>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="size-4 mr-1.5" /> Nova conta
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 inline-flex gap-8">
        <div>
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className={`text-xl font-bold ${saldoTotal >= 0 ? "text-green-600" : "text-destructive"}`}>{formatBRL(saldoTotal)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência / Conta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Saldo Inicial</TableHead>
              <TableHead className="text-right">Saldo Atual</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">Nenhuma conta cadastrada</TableCell>
              </TableRow>
            )}
            {contas.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirEditar(c)}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.banco ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.agencia && c.conta ? `${c.agencia} / ${c.conta}` : c.agencia ?? c.conta ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{TIPO_LABEL[c.tipo] ?? c.tipo}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatBRL(c.saldo_inicial)}</TableCell>
                <TableCell className={`text-right font-medium ${c.saldo_atual >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatBRL(c.saldo_atual)}
                </TableCell>
                <TableCell>
                  <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {c.ativo && (
                    <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => desativar(c.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register("nome")} placeholder="Ex.: Conta Corrente Sicoob" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Banco</Label>
                <Input {...register("banco")} placeholder="Ex.: Sicoob, Itaú, Nubank" />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as FormData["tipo"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Agência</Label>
                <Input {...register("agencia")} placeholder="0000" />
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Input {...register("conta")} placeholder="00000-0" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Saldo inicial (R$)</Label>
              <Input {...register("saldo_inicial")} type="number" step="0.01" defaultValue="0" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : editando ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
