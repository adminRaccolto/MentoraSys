"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { criarConta, editarConta, excluirConta } from "@/actions/contas-bancarias";

const TIPO_LABEL: Record<string, string> = {
  CORRENTE: "Conta Corrente", POUPANCA: "Poupança", CAIXA: "Caixa", INVESTIMENTO: "Investimento",
};

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  banco_id: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  digito: z.string().optional(),
  pix_chave: z.string().optional(),
  tipo: z.enum(["CORRENTE", "POUPANCA", "CAIXA", "INVESTIMENTO"]).default("CORRENTE"),
  saldo_inicial: z.string().default("0"),
});

type FormData = z.input<typeof schema>;

interface Conta {
  id: string; nome: string; banco_id: string | null; banco_nome: string | null;
  agencia: string | null; conta: string | null; digito: string | null;
  pix_chave: string | null; tipo: string; saldo_inicial: number; saldo_atual: number; ativo: boolean;
}

interface Banco { id: string; codigo: string; sigla: string; nome: string; }

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContasBancariasClient({ contas: inicial, bancos }: { contas: Conta[]; bancos: Banco[] }) {
  const [contas, setContas] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [excluindo, setExcluindo] = useState<Conta | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const abrirNova = () => {
    setEditando(null);
    reset({ nome: "", banco_id: "", agencia: "", conta: "", digito: "", pix_chave: "", tipo: "CORRENTE", saldo_inicial: "0" });
    setModalAberto(true);
  };

  const abrirEditar = (c: Conta) => {
    setEditando(c);
    reset({
      nome: c.nome,
      banco_id: c.banco_id ?? "",
      agencia: c.agencia ?? "",
      conta: c.conta ?? "",
      digito: c.digito ?? "",
      pix_chave: c.pix_chave ?? "",
      tipo: c.tipo as FormData["tipo"],
      saldo_inicial: String(c.saldo_inicial),
    });
    setModalAberto(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const payload = { ...data, saldo_inicial: Number(data.saldo_inicial), banco_id: data.banco_id || undefined };
        const banco = bancos.find((b) => b.id === payload.banco_id);
        const banco_nome = banco ? `${banco.codigo} - ${banco.sigla}` : null;

        if (editando) {
          const res = await editarConta(editando.id, payload);
          setContas((prev) => prev.map((c) => c.id === editando.id
            ? { ...c, ...payload, saldo_inicial: Number(data.saldo_inicial), banco_nome, banco_id: payload.banco_id ?? null, agencia: data.agencia ?? null, conta: data.conta ?? null, digito: data.digito ?? null, pix_chave: data.pix_chave ?? null }
            : c));
          toast.success("Conta atualizada");
        } else {
          const res = await criarConta(payload);
          setContas((prev) => [...prev, {
            id: (res.data as { id: string }).id,
            nome: data.nome, banco_id: payload.banco_id ?? null, banco_nome,
            agencia: data.agencia ?? null, conta: data.conta ?? null, digito: data.digito ?? null,
            pix_chave: data.pix_chave ?? null, tipo: data.tipo ?? "CORRENTE",
            saldo_inicial: Number(data.saldo_inicial), saldo_atual: Number(data.saldo_inicial), ativo: true,
          }]);
          toast.success("Conta criada");
        }
        setModalAberto(false);
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    });
  };

  const confirmarExcluir = () => {
    if (!excluindo) return;
    startTransition(async () => {
      try {
        await excluirConta(excluindo.id);
        setContas((prev) => prev.filter((c) => c.id !== excluindo.id));
        toast.success("Conta removida");
        setExcluindo(null);
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Contas Bancárias</h1>
        </div>
        <Button size="sm" onClick={abrirNova}>
          <Plus className="size-4 mr-1.5" /> Nova conta
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Apelido</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência / Conta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Chave PIX</TableHead>
              <TableHead className="text-right">Saldo Inicial</TableHead>
              <TableHead className="text-right">Saldo Atual</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhuma conta cadastrada
                </TableCell>
              </TableRow>
            )}
            {contas.map((c) => (
              <TableRow key={c.id} className={!c.ativo ? "opacity-50" : ""}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.banco_nome ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.agencia ? `Ag. ${c.agencia}` : ""}
                  {c.agencia && c.conta ? " · " : ""}
                  {c.conta ? `C/C ${c.conta}${c.digito ? `-${c.digito}` : ""}` : ""}
                  {!c.agencia && !c.conta ? "—" : ""}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.pix_chave ?? "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">{formatBRL(c.saldo_inicial)}</TableCell>
                <TableCell className={`text-right font-medium ${c.saldo_atual >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatBRL(c.saldo_atual)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEditar(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => setExcluindo(c)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal criar / editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar conta bancária" : "Nova conta bancária"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome / Apelido *</Label>
              <Input {...register("nome")} placeholder="Ex.: Conta Principal BB" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Banco</Label>
                <Select
                  value={watch("banco_id") ?? undefined}
                  onValueChange={(v) => setValue("banco_id", !v || v === "_nenhum" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco">
                      {(value: string | null) => {
                        if (!value || value === "_nenhum") return undefined;
                        const b = bancos.find((b) => b.id === value);
                        return b ? `${b.codigo} — ${b.sigla}` : undefined;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_nenhum">Nenhum</SelectItem>
                    {bancos.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.codigo} — {b.sigla} — {b.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={watch("tipo")}
                  onValueChange={(v) => setValue("tipo", v as FormData["tipo"])}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string | null) => value ? (TIPO_LABEL[value] ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Agência</Label>
                <Input {...register("agencia")} placeholder="0000" />
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Input {...register("conta")} placeholder="00000" />
              </div>
              <div className="space-y-1">
                <Label>Dígito</Label>
                <Input {...register("digito")} placeholder="0" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Chave PIX</Label>
              <Input {...register("pix_chave")} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
            </div>

            <div className="space-y-1">
              <Label>Saldo inicial (R$)</Label>
              <Input {...register("saldo_inicial")} type="number" step="0.01" placeholder="0,00" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : editando ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta <strong>{excluindo?.nome}</strong> será desativada e não aparecerá mais como opção.
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
