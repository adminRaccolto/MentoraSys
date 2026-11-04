"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Percent, Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  calcularPisCofins, gerarPrevisaoPisCofins,
  calcularIrpjCsll, gerarPrevisaoIrpjCsll,
  type PrevisaoPisCofins, type PrevisaoIrpjCsll,
} from "@/actions/impostos";

type Status = "PENDENTE" | "PARCIAL" | "PAGO" | "VENCIDO" | "CANCELADO";

const STATUS_CONFIG: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDENTE:  { label: "Pendente",  variant: "secondary" },
  PARCIAL:   { label: "Parcial",   variant: "outline" },
  PAGO:      { label: "Pago",      variant: "default" },
  VENCIDO:   { label: "Vencido",   variant: "destructive" },
  CANCELADO: { label: "Cancelado", variant: "outline" },
};

interface Previsao {
  id: string; descricao: string; valor: number; data_vencimento: Date;
  status: string; observacoes: string | null;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
const trimestreAtual = Math.floor(hoje.getMonth() / 3) + 1;

export default function ImpostosClient({ previsoes }: { previsoes: Previsao[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [competenciaMes, setCompetenciaMes] = useState(mesAtual);
  const [previaMes, setPreviaMes] = useState<PrevisaoPisCofins | null>(null);

  const [anoTrimestre, setAnoTrimestre] = useState(String(hoje.getFullYear()));
  const [trimestre, setTrimestre] = useState(String(trimestreAtual));
  const [previaTrimestre, setPreviaTrimestre] = useState<PrevisaoIrpjCsll | null>(null);

  function calcularMes() {
    setPreviaMes(null);
    startTransition(async () => {
      try {
        setPreviaMes(await calcularPisCofins(competenciaMes));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao calcular");
      }
    });
  }

  function lancarMes() {
    startTransition(async () => {
      try {
        await gerarPrevisaoPisCofins(competenciaMes);
        toast.success("PIS e COFINS lançados em Contas a Pagar!");
        setPreviaMes(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao lançar");
      }
    });
  }

  function calcularTrimestreFn() {
    setPreviaTrimestre(null);
    startTransition(async () => {
      try {
        setPreviaTrimestre(await calcularIrpjCsll(`${anoTrimestre}-T${trimestre}`));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao calcular");
      }
    });
  }

  function lancarTrimestre() {
    startTransition(async () => {
      try {
        await gerarPrevisaoIrpjCsll(`${anoTrimestre}-T${trimestre}`);
        toast.success("IRPJ e CSLL lançados em Contas a Pagar!");
        setPreviaTrimestre(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao lançar");
      }
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Percent className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Impostos — Lucro Presumido</h1>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <Info className="size-4 shrink-0 mt-0.5" />
        <p>
          Previsões calculadas sobre a receita <strong>recebida</strong> (regime de caixa), com a presunção padrão
          de 32% para serviços de consultoria. São estimativas lançadas em Contas a Pagar — confirme sempre com o
          contador antes do pagamento, especialmente os vencimentos (ajustados automaticamente apenas para dia 25
          ou último dia do mês, sem considerar feriados/dias não úteis).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PIS/COFINS mensal */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">PIS / COFINS — mensal</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Competência</Label>
              <Input type="month" value={competenciaMes} onChange={(e) => { setCompetenciaMes(e.target.value); setPreviaMes(null); }} className="h-9 text-sm" />
            </div>
            <Button variant="outline" className="h-9 gap-1.5" onClick={calcularMes} disabled={isPending}>
              <Calculator className="size-3.5" /> Calcular
            </Button>
          </div>

          {previaMes && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Receita recebida</span><span className="font-medium">{fmtBRL(previaMes.receita)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">PIS (0,65%)</span><span className="font-medium">{fmtBRL(previaMes.pis)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">COFINS (3%)</span><span className="font-medium">{fmtBRL(previaMes.cofins)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span className="font-medium">{fmtData(previaMes.vencimento)}</span></div>
              {previaMes.jaGerado ? (
                <Badge variant="outline" className="text-amber-700 border-amber-400">Já lançado nesse período</Badge>
              ) : (
                <Button size="sm" className="w-full mt-1" onClick={lancarMes} disabled={isPending || previaMes.receita <= 0}>
                  Lançar em Contas a Pagar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* IRPJ/CSLL trimestral */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">IRPJ / CSLL — trimestral</p>
          <div className="flex items-end gap-2">
            <div className="w-24 space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input type="number" value={anoTrimestre} onChange={(e) => { setAnoTrimestre(e.target.value); setPreviaTrimestre(null); }} className="h-9 text-sm" />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Trimestre</Label>
              <Select value={trimestre} onValueChange={(v) => { if (v) { setTrimestre(v); setPreviaTrimestre(null); } }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º (Jan–Mar)</SelectItem>
                  <SelectItem value="2">2º (Abr–Jun)</SelectItem>
                  <SelectItem value="3">3º (Jul–Set)</SelectItem>
                  <SelectItem value="4">4º (Out–Dez)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="h-9 gap-1.5" onClick={calcularTrimestreFn} disabled={isPending}>
              <Calculator className="size-3.5" /> Calcular
            </Button>
          </div>

          {previaTrimestre && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Receita recebida</span><span className="font-medium">{fmtBRL(previaTrimestre.receita)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Base presumida (32%)</span><span className="font-medium">{fmtBRL(previaTrimestre.base)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IRPJ (15%{previaTrimestre.adicionalIrpj > 0 ? " + adicional" : ""})</span>
                <span className="font-medium">{fmtBRL(previaTrimestre.irpj)}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">CSLL (9%)</span><span className="font-medium">{fmtBRL(previaTrimestre.csll)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span className="font-medium">{fmtData(previaTrimestre.vencimento)}</span></div>
              {previaTrimestre.jaGerado ? (
                <Badge variant="outline" className="text-amber-700 border-amber-400">Já lançado nesse período</Badge>
              ) : (
                <Button size="sm" className="w-full mt-1" onClick={lancarTrimestre} disabled={isPending || previaTrimestre.receita <= 0}>
                  Lançar em Contas a Pagar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">Previsões já lançadas</p>
        {previsoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg">Nenhuma previsão de imposto lançada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previsoes.map((p) => {
                const cfg = STATUS_CONFIG[p.status as Status] ?? STATUS_CONFIG.PENDENTE;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtData(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(p.valor)}</TableCell>
                    <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
