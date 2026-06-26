"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, Trash2, CheckCircle, Receipt, Undo2, FileText, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarRecebivel, baixarRecebivel, excluirRecebivel, gerarParcelasContrato, estornarRecebivel, baixarLoteRecebiveis, refaturarRecebivel } from "@/actions/recebiveis";
import { gerarBoleto, consultarBoleto, cancelarBoleto } from "@/actions/boletos";

type Status = "PENDENTE" | "PARCIAL" | "PAGO" | "VENCIDO" | "CANCELADO" | "RENEGOCIADO";

const STATUS_CONFIG: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDENTE:    { label: "Pendente",    variant: "secondary" },
  PARCIAL:     { label: "Parcial",     variant: "outline" },
  PAGO:        { label: "Pago",        variant: "default" },
  VENCIDO:     { label: "Vencido",     variant: "destructive" },
  CANCELADO:   { label: "Cancelado",   variant: "outline" },
  RENEGOCIADO: { label: "Renegociado", variant: "outline" },
};

const FORMAS = ["Dinheiro", "PIX", "TED", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Cheque"];

const schemaCreate = z.object({
  descricao:       z.string().min(1, "Descrição obrigatória"),
  valor:           z.string().min(1, "Valor obrigatório"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  cliente_id:      z.string().optional(),
  contrato_id:     z.string().optional(),
  plano_contas_id: z.string().optional(),
  centro_custo_id: z.string().optional(),
  observacoes:     z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.string().min(1, "Valor obrigatório"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
  juros_valor: z.coerce.number().min(0).optional(),
  multa_valor: z.coerce.number().min(0).optional(),
  desconto_valor: z.coerce.number().min(0).optional(),
});

const schemaRefaturarForm = z.object({
  juros_valor: z.coerce.number().min(0).default(0),
  multa_valor: z.coerce.number().min(0).default(0),
  desconto_valor: z.coerce.number().min(0).default(0),
  nova_data_vencimento: z.string().min(1, "Nova data obrigatória"),
  observacoes: z.string().optional(),
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
type FormRefaturar = z.input<typeof schemaRefaturarForm>;

interface Boleto {
  id: string; status: string; linha_digitavel: string | null;
  url_boleto: string | null; url_fatura: string | null;
}

interface Recebivel {
  id: string; descricao: string; valor: string | number; data_vencimento: Date;
  status: Status; data_pagamento: Date | null; valor_pago: string | number | null;
  forma_pagamento: string | null; numero_parcela: number | null; total_parcelas: number | null;
  cliente: { id: string; nome: string } | null;
  contrato: { id: string; titulo: string; numero_contrato: string | null; juros_ao_mes_percentual: number | null; multa_percentual: number | null } | null;
  plano_contas: { id: string; nome: string } | null;
  boleto: Boleto | null;
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
  centrosCusto: { id: string; nome: string; codigo: string | null }[];
  de: string;
  ate: string;
  statusFiltro: string;
  modelosRecibo: ModeloDoc[];
}

function formatBRL(v: string | number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isVencido(data: Date, status: Status) {
  return status === "PENDENTE" && new Date(data) < new Date();
}

export default function RecebiveisClient({ recebiveis: inicial, clientes, contratos, categorias, contasBancarias, centrosCusto, de, ate, statusFiltro, modelosRecibo }: Props) {
  const router = useRouter();
  const [recebiveis, setRecebiveis] = useState(inicial);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalBaixar, setModalBaixar] = useState<Recebivel | null>(null);
  const [modalParcelas, setModalParcelas] = useState(false);
  const [modalRecibo, setModalRecibo] = useState<Recebivel | null>(null);
  const [modalRefaturar, setModalRefaturar] = useState<Recebivel | null>(null);
  const [excluindo, setExcluindo] = useState<Recebivel | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalLote, setModalLote] = useState(false);
  const [formLoteData, setFormLoteData] = useState({ data_pagamento: new Date().toISOString().split("T")[0], forma_pagamento: "", conta_bancaria_id: "" });
  const [filtroDe, setFiltroDe] = useState(de);
  const [filtroAte, setFiltroAte] = useState(ate);

  const aplicarFiltro = () => {
    router.push(`/financeiro/recebiveis?de=${filtroDe}&ate=${filtroAte}&status=${statusFiltro}`);
  };

  const statusFiltrados = (() => {
    if (statusFiltro === "TODOS") return recebiveis;
    if (statusFiltro === "VENCIDO") return recebiveis.filter((r) => r.status === "VENCIDO" || (r.status === "PENDENTE" && new Date(r.data_vencimento) < new Date()));
    if (statusFiltro === "PENDENTE") return recebiveis.filter((r) => r.status === "PENDENTE" && new Date(r.data_vencimento) >= new Date());
    return recebiveis.filter((r) => r.status === statusFiltro);
  })();

  const totalPendente = recebiveis.filter((r) => r.status === "PENDENTE" && new Date(r.data_vencimento) >= new Date()).reduce((s, r) => s + Number(r.valor), 0);
  const totalVencido = recebiveis.filter((r) => r.status === "VENCIDO" || (r.status === "PENDENTE" && new Date(r.data_vencimento) < new Date())).reduce((s, r) => s + Number(r.valor), 0);
  const totalPago = recebiveis.filter((r) => r.status === "PAGO").reduce((s, r) => s + Number(r.valor_pago ?? r.valor), 0);

  // Formulário criar
  const formNovo = useForm<FormCreate>({ resolver: zodResolver(schemaCreate) });
  const onSubmitNovo = (data: FormCreate) => {
    startTransition(async () => {
      try {
        const res = await criarRecebivel({ ...data, valor: Number(data.valor) });
        setRecebiveis((prev) => [...prev, res.data as unknown as Recebivel]);
        toast.success("Lançamento criado");
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
        await baixarRecebivel(modalBaixar.id, {
          ...data,
          valor_pago: Number(data.valor_pago),
          juros_valor: data.juros_valor ? Number(data.juros_valor) : undefined,
          multa_valor: data.multa_valor ? Number(data.multa_valor) : undefined,
          desconto_valor: data.desconto_valor ? Number(data.desconto_valor) : undefined,
        });
        const novoStatus: Status = Number(data.valor_pago) < Number(modalBaixar.valor) ? "PARCIAL" : "PAGO";
        setRecebiveis((prev) => prev.map((r) => r.id === modalBaixar.id ? { ...r, status: novoStatus, data_pagamento: new Date(data.data_pagamento), valor_pago: data.valor_pago, forma_pagamento: data.forma_pagamento } : r));
        toast.success("Baixa registrada");
        setModalBaixar(null);
        formBaixar.reset();
      } catch { toast.error("Erro ao baixar recebível"); }
    });
  };

  // Formulário refaturar
  const formRefaturar = useForm<FormRefaturar>({ resolver: zodResolver(schemaRefaturarForm) });
  const jurosValorWatch = Number(formRefaturar.watch("juros_valor") ?? 0);
  const multaValorWatch = Number(formRefaturar.watch("multa_valor") ?? 0);
  const descontoValorWatch = Number(formRefaturar.watch("desconto_valor") ?? 0);
  const novoTotalRefaturar = modalRefaturar
    ? Number(modalRefaturar.valor) + jurosValorWatch + multaValorWatch - descontoValorWatch
    : 0;

  const abrirRefaturar = (r: Recebivel) => {
    // pré-calcula juros e multa com base nos dados do contrato
    let jurosPreCalc = 0;
    let multaPreCalc = 0;
    if (r.contrato) {
      const diasAtraso = r.data_vencimento < new Date()
        ? Math.floor((new Date().getTime() - new Date(r.data_vencimento).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      if (r.contrato.juros_ao_mes_percentual && diasAtraso > 0) {
        jurosPreCalc = Math.round(Number(r.valor) * (r.contrato.juros_ao_mes_percentual / 100) * (diasAtraso / 30) * 100) / 100;
      }
      if (r.contrato.multa_percentual) {
        multaPreCalc = Math.round(Number(r.valor) * (r.contrato.multa_percentual / 100) * 100) / 100;
      }
    }
    formRefaturar.reset({
      juros_valor: jurosPreCalc,
      multa_valor: multaPreCalc,
      desconto_valor: 0,
      nova_data_vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      observacoes: "",
    });
    setModalRefaturar(r);
  };

  const onSubmitRefaturar = (data: FormRefaturar) => {
    if (!modalRefaturar) return;
    startTransition(async () => {
      try {
        await refaturarRecebivel(modalRefaturar.id, data);
        setRecebiveis((prev) => prev.map((r) => r.id === modalRefaturar.id ? { ...r, status: "RENEGOCIADO" as Status } : r));
        toast.success("Recebível refaturado com sucesso");
        setModalRefaturar(null);
        formRefaturar.reset();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao refaturar");
      }
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
        toast.success("Lançamento excluído");
        setExcluindo(null);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      }
    });
  };

  const handleEstornar = (id: string) => {
    startTransition(async () => {
      try {
        const res = await estornarRecebivel(id);
        setRecebiveis(prev => prev.map(r => r.id === id ? { ...r, status: res.data.status as Status, data_pagamento: null, valor_pago: null, forma_pagamento: null } : r));
        toast.success("Estorno realizado");
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao estornar"); }
    });
  };

  const handleBaixarLote = () => {
    if (!formLoteData.forma_pagamento) { toast.error("Informe a forma de pagamento"); return; }
    startTransition(async () => {
      try {
        const res = await baixarLoteRecebiveis(Array.from(selecionados), {
          data_pagamento: formLoteData.data_pagamento,
          forma_pagamento: formLoteData.forma_pagamento,
          conta_bancaria_id: formLoteData.conta_bancaria_id || undefined,
        });
        setRecebiveis(prev => prev.map(r =>
          selecionados.has(r.id) ? { ...r, status: "PAGO" as Status, forma_pagamento: formLoteData.forma_pagamento } : r
        ));
        setSelecionados(new Set());
        setModalLote(false);
        toast.success(`${res.data.qtd} lançamento(s) baixado(s)`);
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro na baixa em lote"); }
    });
  };

  const handleGerarBoleto = (id: string) => {
    startTransition(async () => {
      try {
        const res = await gerarBoleto(id);
        setRecebiveis(prev => prev.map(r => r.id === id ? { ...r, boleto: { id: res.data.id, status: res.data.status, linha_digitavel: res.data.linha_digitavel, url_boleto: res.data.url_boleto, url_fatura: res.data.url_fatura } } : r));
        toast.success("Boleto gerado com sucesso");
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao gerar boleto"); }
    });
  };

  const handleConsultarBoleto = (boletoId: string, recebivelId: string) => {
    startTransition(async () => {
      try {
        const res = await consultarBoleto(boletoId);
        setRecebiveis(prev => prev.map(r => r.id === recebivelId ? { ...r, boleto: { ...r.boleto!, status: res.data.status, url_boleto: res.data.url_boleto, url_fatura: res.data.url_fatura } } : r));
        toast.success(`Status: ${res.data.status}`);
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  const handleCancelarBoleto = (boletoId: string, recebivelId: string) => {
    startTransition(async () => {
      try {
        await cancelarBoleto(boletoId);
        setRecebiveis(prev => prev.map(r => r.id === recebivelId ? { ...r, boleto: null } : r));
        toast.success("Boleto cancelado");
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro"); }
    });
  };

  const toggleSelecionado = (id: string) => setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const elegiveisLote = statusFiltrados.filter(r => r.status === "PENDENTE" || r.status === "VENCIDO" || r.status === "PARCIAL");
  const todosElegivelsSelecionados = elegiveisLote.length > 0 && elegiveisLote.every(r => selecionados.has(r.id));
  const toggleTodos = () => {
    if (todosElegivelsSelecionados) setSelecionados(new Set());
    else setSelecionados(new Set(elegiveisLote.map(r => r.id)));
  };

  const tabs: { key: string; label: string }[] = [
    { key: "TODOS", label: "Todos" },
    { key: "PENDENTE", label: "Pendente" },
    { key: "PARCIAL", label: "Parcial" },
    { key: "VENCIDO", label: "Vencido" },
    { key: "PAGO", label: "Pago" },
    { key: "CANCELADO", label: "Cancelado" },
    { key: "RENEGOCIADO", label: "Renegociado" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Contas a Receber</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { formParcelas.reset(); setModalParcelas(true); }}>
            Gerar parcelas de contrato
          </Button>
          <Button size="sm" onClick={() => { formNovo.reset(); setModalNovo(true); }}>
            <Plus className="size-4 mr-1.5" /> Nova conta a receber
          </Button>
        </div>
      </div>

      {/* Filtro de período + totais */}
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
          {totalVencido > 0 && <span className="text-muted-foreground">Vencido: <strong className="text-destructive">{formatBRL(totalVencido)}</strong></span>}
          <span className="text-muted-foreground">Recebido: <strong className="text-primary">{formatBRL(totalPago)}</strong></span>
        </div>
      </div>

      {/* Tabs de status */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/financeiro/recebiveis?de=${filtroDe}&ate=${filtroAte}&status=${tab.key}`)}
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

      {/* Toolbar de lote */}
      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selecionados.size} selecionado(s)</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => setModalLote(true)}>
            <CheckCircle className="size-3 mr-1" /> Baixar selecionados
          </Button>
          <button className="text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" className="accent-primary" checked={todosElegivelsSelecionados} onChange={toggleTodos} disabled={elegiveisLote.length === 0} />
              </TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {statusFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Nenhum recebível encontrado
                </TableCell>
              </TableRow>
            )}
            {statusFiltrados.map((r) => {
              const vencido = isVencido(r.data_vencimento, r.status);
              const cfg = STATUS_CONFIG[vencido ? "VENCIDO" : r.status];
              const elegivel = r.status === "PENDENTE" || r.status === "VENCIDO" || r.status === "PARCIAL";
              return (
                <TableRow key={r.id} className={selecionados.has(r.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    {elegivel && (
                      <input type="checkbox" className="accent-primary" checked={selecionados.has(r.id)} onChange={() => toggleSelecionado(r.id)} />
                    )}
                  </TableCell>
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
                  <TableCell>
                    <Badge variant={cfg.variant} className={r.status === "PARCIAL" ? "border-amber-400 text-amber-700" : ""}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.forma_pagamento ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(r.status === "PENDENTE" || r.status === "PARCIAL" || r.status === "VENCIDO") && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-primary hover:text-primary"
                          title="Registrar baixa"
                          onClick={() => { formBaixar.setValue("valor_pago", String(Number(r.valor).toFixed(2))); formBaixar.setValue("data_pagamento", new Date().toISOString().split("T")[0]); setModalBaixar(r); }}
                        >
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {(r.status === "VENCIDO" || (r.status === "PENDENTE" && vencido)) && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-amber-600 hover:text-amber-600"
                          title="Refaturar com juros e multa"
                          onClick={() => abrirRefaturar(r)}
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                      )}
                      {(r.status === "PAGO" || r.status === "PARCIAL") && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-amber-600 hover:text-amber-600"
                          title="Estornar"
                          onClick={() => handleEstornar(r.id)}
                        >
                          <Undo2 className="size-3.5" />
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
                      {/* Boleto */}
                      {!r.boleto && (r.status === "PENDENTE" || r.status === "PARCIAL") && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-blue-600 hover:text-blue-600"
                          title="Gerar boleto (Asaas)"
                          onClick={() => handleGerarBoleto(r.id)}
                          disabled={isPending}
                        >
                          <FileText className="size-3.5" />
                        </Button>
                      )}
                      {r.boleto && (
                        <>
                          {r.boleto.url_fatura && (
                            <a href={r.boleto.url_fatura} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="size-7 text-blue-600 hover:text-blue-600" title="Ver boleto">
                                <FileText className="size-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button
                            size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground"
                            title="Atualizar status boleto"
                            onClick={() => handleConsultarBoleto(r.boleto!.id, r.id)}
                            disabled={isPending}
                          >
                            <RefreshCw className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                            title="Cancelar boleto"
                            onClick={() => handleCancelarBoleto(r.boleto!.id, r.id)}
                            disabled={isPending}
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        </>
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

      {/* Modal baixa em lote */}
      <Dialog open={modalLote} onOpenChange={setModalLote}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Baixar {selecionados.size} lançamento(s)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Cada item será baixado pelo seu valor integral.</p>
            <div className="space-y-1">
              <Label>Data de pagamento *</Label>
              <Input type="date" value={formLoteData.data_pagamento} onChange={e => setFormLoteData(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento *</Label>
              <Select value={formLoteData.forma_pagamento} onValueChange={v => setFormLoteData(p => ({ ...p, forma_pagamento: v ?? "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {(value: string | null) => value || undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {["PIX","Transferência","Boleto","Cartão","Dinheiro","Cheque"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conta bancária</Label>
              <Select value={formLoteData.conta_bancaria_id || "_none"} onValueChange={v => setFormLoteData(p => ({ ...p, conta_bancaria_id: !v || v === "_none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma">
                    {(value: string | null) => value && value !== "_none" ? (contasBancarias.find((c) => c.id === value)?.nome ?? value) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhuma</SelectItem>
                  {contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLote(false)}>Cancelar</Button>
            <Button onClick={handleBaixarLote} disabled={isPending}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum">
                    {(value: string | null) => value && value !== "nenhum" ? (clientes.find((c) => c.id === value)?.nome ?? value) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={formNovo.watch("plano_contas_id") ?? ""} onValueChange={(v) => formNovo.setValue("plano_contas_id", v === "nenhuma" ? undefined : v ?? undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma">
                    {(value: string | null) => value && value !== "nenhuma" ? (categorias.find((c) => c.id === value)?.nome ?? value) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {centrosCusto.length > 0 && (
              <div className="space-y-1">
                <Label>Centro de custo</Label>
                <Select value={formNovo.watch("centro_custo_id") ?? ""} onValueChange={(v) => formNovo.setValue("centro_custo_id", v === "nenhum" ? undefined : v ?? undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {centrosCusto.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo ? `[${c.codigo}] ` : ""}{c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {(value: string | null) => value || undefined}
                  </SelectValue>
                </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma">
                      {(value: string | null) => value && value !== "nenhuma" ? (contasBancarias.find((c) => c.id === value)?.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    {contasBancarias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Juros (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formBaixar.register("juros_valor")} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Multa (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formBaixar.register("multa_valor")} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desconto (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formBaixar.register("desconto_valor")} className="h-8 text-sm" />
              </div>
            </div>
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato">
                    {(value: string | null) => {
                      if (!value) return undefined;
                      const c = contratos.find((c) => c.id === value);
                      return c ? `${c.titulo} — ${c.cliente.nome}` : undefined;
                    }}
                  </SelectValue>
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma">
                    {(value: string | null) => value && value !== "nenhuma" ? (categorias.find((c) => c.id === value)?.nome ?? value) : undefined}
                  </SelectValue>
                </SelectTrigger>
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

      {/* Modal refaturar */}
      <Dialog open={!!modalRefaturar} onOpenChange={(v) => !v && setModalRefaturar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refaturar recebível vencido</DialogTitle>
          </DialogHeader>
          <form onSubmit={formRefaturar.handleSubmit(onSubmitRefaturar)} className="space-y-3">
            {modalRefaturar && (
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm space-y-0.5">
                <p className="font-medium truncate">{modalRefaturar.descricao}</p>
                <p className="text-muted-foreground text-xs">
                  Valor original: <strong>{formatBRL(modalRefaturar.valor)}</strong> · Vencido em: {new Date(modalRefaturar.data_vencimento).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Juros (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formRefaturar.register("juros_valor")} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Multa (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formRefaturar.register("multa_valor")} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desconto (R$)</Label>
                <Input type="number" step="0.01" min={0} placeholder="0,00" {...formRefaturar.register("desconto_valor")} className="h-8 text-sm" />
              </div>
            </div>
            {modalRefaturar && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Novo total:</span>
                <span className={`font-bold text-base ${novoTotalRefaturar <= 0 ? "text-destructive" : "text-primary"}`}>
                  {formatBRL(Math.max(0, novoTotalRefaturar))}
                </span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Nova data de vencimento *</Label>
              <Input type="date" {...formRefaturar.register("nova_data_vencimento")} />
              {formRefaturar.formState.errors.nova_data_vencimento && (
                <p className="text-xs text-destructive">{formRefaturar.formState.errors.nova_data_vencimento.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Input placeholder="Opcional" {...formRefaturar.register("observacoes")} className="h-8 text-sm" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalRefaturar(null)}>Cancelar</Button>
              <Button type="submit" disabled={isPending || novoTotalRefaturar <= 0}>
                {isPending ? "Refaturando..." : "Refaturar"}
              </Button>
            </DialogFooter>
          </form>
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
