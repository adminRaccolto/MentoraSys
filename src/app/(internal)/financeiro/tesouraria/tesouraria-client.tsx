"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Trash2, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { criarTransferencia, excluirTransferencia } from "@/actions/tesouraria";
import type { ExtratoItem } from "./page";

interface Conta { id: string; nome: string; tipo: string; saldo_inicial: number; saldo_atual: number; }
interface Transferencia {
  id: string;
  conta_origem_id: string; conta_origem_nome: string;
  conta_destino_id: string; conta_destino_nome: string;
  valor: number; data: string; descricao: string | null;
}

interface Props {
  contas: Conta[];
  transferencias: Transferencia[];
  extrato: ExtratoItem[];
  contaIdSelecionada: string | null;
  saldoInicialConta: number;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

const TIPO_LABEL: Record<string, string> = { CORRENTE: "C/C", POUPANCA: "Poup.", CAIXA: "Caixa", INVESTIMENTO: "Invest." };

const FORM_VAZIO = { conta_origem_id: "", conta_destino_id: "", valor: "", data: new Date().toISOString().split("T")[0], descricao: "" };

export default function TesourariaClient({ contas, transferencias: inicial, extrato, contaIdSelecionada, saldoInicialConta }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [aba, setAba] = useState<"transferencias" | "extrato">(contaIdSelecionada ? "extrato" : "transferencias");
  const [transferencias, setTransferencias] = useState(inicial);
  const [modalNovaTransf, setModalNovaTransf] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [contaExtrato, setContaExtrato] = useState(contaIdSelecionada ?? "");

  const totalSaldo = contas.reduce((s, c) => s + c.saldo_atual, 0);

  const handleCriar = () => {
    if (!form.conta_origem_id || !form.conta_destino_id || !form.valor || !form.data) {
      toast.error("Preencha todos os campos obrigatórios"); return;
    }
    startTransition(async () => {
      try {
        const res = await criarTransferencia({ ...form, valor: Number(form.valor) });
        const novaT = res.data;
        const origem = contas.find(c => c.id === novaT.conta_origem_id);
        const destino = contas.find(c => c.id === novaT.conta_destino_id);
        setTransferencias(prev => [{
          id: novaT.id,
          conta_origem_id: novaT.conta_origem_id,
          conta_origem_nome: origem?.nome ?? "—",
          conta_destino_id: novaT.conta_destino_id,
          conta_destino_nome: destino?.nome ?? "—",
          valor: novaT.valor,
          data: novaT.data.toString().split("T")[0],
          descricao: novaT.descricao ?? null,
        }, ...prev]);
        setForm(FORM_VAZIO);
        setModalNovaTransf(false);
        toast.success("Transferência registrada");
        router.refresh();
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  const handleExcluir = (id: string) => {
    startTransition(async () => {
      try {
        await excluirTransferencia(id);
        setTransferencias(prev => prev.filter(t => t.id !== id));
        toast.success("Transferência excluída");
        router.refresh();
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  const abrirExtrato = (contaId: string) => {
    setContaExtrato(contaId);
    setAba("extrato");
    router.push(`/financeiro/tesouraria?conta_id=${contaId}`);
  };

  // Extrato com saldo acumulado
  let acum = saldoInicialConta;
  const extratoComSaldo = extrato.map(item => {
    acum += item.tipo === "CREDITO" ? item.valor : -item.valor;
    return { ...item, saldoAcum: acum };
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Tesouraria</h1>
      </div>

      {/* Cards de contas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {contas.map(c => (
          <button
            key={c.id}
            onClick={() => abrirExtrato(c.id)}
            className={`rounded-lg border p-4 text-left transition-all hover:shadow-sm hover:border-primary/40
              ${contaIdSelecionada === c.id ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{c.nome}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
            </div>
            <p className={`text-lg font-bold ${c.saldo_atual >= 0 ? "text-primary" : "text-destructive"}`}>
              {fmtBRL(c.saldo_atual)}
            </p>
            {c.saldo_atual !== c.saldo_inicial && (
              <p className="text-xs text-muted-foreground mt-0.5">Inicial: {fmtBRL(c.saldo_inicial)}</p>
            )}
          </button>
        ))}
        <div className="rounded-lg border bg-muted/20 p-4 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground font-medium mb-1">Saldo Total</p>
          <p className={`text-lg font-bold ${totalSaldo >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtBRL(totalSaldo)}</p>
        </div>
      </div>

      {/* Painel principal */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center border-b">
          {([
            { key: "transferencias", label: "Transferências" },
            { key: "extrato",        label: contaExtrato ? `Extrato — ${contas.find(c => c.id === contaExtrato)?.nome ?? ""}` : "Extrato por Conta" },
          ] as { key: "transferencias" | "extrato"; label: string }[]).map(v => (
            <button key={v.key} onClick={() => setAba(v.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${aba === v.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {v.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="px-4">
            <Button size="sm" onClick={() => setModalNovaTransf(true)}>
              <ArrowLeftRight className="size-3.5 mr-1.5" /> Nova transferência
            </Button>
          </div>
        </div>

        {/* ── TRANSFERÊNCIAS ── */}
        {aba === "transferencias" && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferencias.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhuma transferência registrada</TableCell></TableRow>
              )}
              {transferencias.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground text-sm">{fmtData(t.data)}</TableCell>
                  <TableCell className="font-medium text-sm">{t.conta_origem_nome}</TableCell>
                  <TableCell className="font-medium text-sm">{t.conta_destino_nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.descricao ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmtBRL(t.valor)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => handleExcluir(t.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* ── EXTRATO ── */}
        {aba === "extrato" && (
          <div>
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
              <Building2 className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Conta:</span>
              <Select value={contaExtrato} onValueChange={v => { if (v) abrirExtrato(v); }}>
                <SelectTrigger className="h-8 w-56 text-sm">
                  <SelectValue placeholder="Selecione uma conta">
                    {(value: string | null) => value ? (contas.find((c) => c.id === value)?.nome ?? value) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {contaExtrato && (
                <span className="text-sm text-muted-foreground ml-auto">
                  Saldo inicial: <strong>{fmtBRL(saldoInicialConta)}</strong>
                </span>
              )}
            </div>
            {!contaExtrato ? (
              <p className="text-center text-muted-foreground py-12">Selecione uma conta para ver o extrato</p>
            ) : extratoComSaldo.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum movimento nesta conta</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratoComSaldo.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{fmtData(item.data)}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{item.descricao}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.referencia}</TableCell>
                      <TableCell>
                        {item.tipo === "CREDITO" ? (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <TrendingUp className="size-3" /> Crédito
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <TrendingDown className="size-3" /> Débito
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium text-sm ${item.tipo === "CREDITO" ? "text-primary" : "text-orange-600"}`}>
                        {item.tipo === "CREDITO" ? "+" : "−"}{fmtBRL(item.valor)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${item.saldoAcum >= 0 ? "text-primary" : "text-destructive"}`}>
                        {fmtBRL(item.saldoAcum)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Modal nova transferência */}
      <Dialog open={modalNovaTransf} onOpenChange={setModalNovaTransf}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova transferência entre contas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Conta de origem *</Label>
                <Select value={form.conta_origem_id} onValueChange={v => setForm(p => ({ ...p, conta_origem_id: v ?? "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {(value: string | null) => value ? (contas.find((c) => c.id === value)?.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Conta de destino *</Label>
                <Select value={form.conta_destino_id} onValueChange={v => setForm(p => ({ ...p, conta_destino_id: v ?? "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {(value: string | null) => value ? (contas.find((c) => c.id === value)?.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {contas.filter(c => c.id !== form.conta_origem_id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Capitalização conta poupança" />
            </div>
            {form.conta_origem_id && form.conta_destino_id && form.valor && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{contas.find(c => c.id === form.conta_origem_id)?.nome}</span>
                {" → "}
                <span className="font-medium text-foreground">{contas.find(c => c.id === form.conta_destino_id)?.nome}</span>
                {" · "}
                <span className="font-semibold text-primary">{fmtBRL(Number(form.valor))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovaTransf(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
