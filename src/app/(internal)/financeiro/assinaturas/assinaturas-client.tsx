"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Repeat2, Plus, RefreshCw, XCircle, TrendingUp, AlertTriangle, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarAssinatura, cancelarAssinatura, sincronizarAssinatura } from "@/actions/asaas";

type StatusAssinatura = "ATIVA" | "PAUSADA" | "CANCELADA" | "INADIMPLENTE" | "TRIAL";

const STATUS_CONFIG: Record<StatusAssinatura, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ATIVA:        { label: "Ativa",        variant: "default" },
  TRIAL:        { label: "Trial",        variant: "secondary" },
  PAUSADA:      { label: "Pausada",      variant: "outline" },
  CANCELADA:    { label: "Cancelada",    variant: "outline" },
  INADIMPLENTE: { label: "Inadimplente", variant: "destructive" },
};

const CANAL_LABELS: Record<string, string> = {
  ARATO:        "Arato SaaS",
  CONSELHO_AGRO: "O Conselho Agro",
  CONSULTORIA:  "Consultoria/Mentoria",
};

const PLANO_LABELS: Record<string, string> = {
  ESSENCIAL:        "Essencial",
  GESTAO:           "Gestão",
  PERFORMANCE:      "Performance",
  NOVO_AGRO:        "O Novo Agro",
  MESA_AGRO:        "Mesa Agro",
  CONSULTORIA_AGR:  "Consultoria Agro",
  MENTORIA:         "Mentoria",
  PROJETO:          "Projeto",
};

const schemaNova = z.object({
  nome_cliente:       z.string().min(1),
  email_cliente:      z.string().email().optional().or(z.literal("")),
  telefone_cliente:   z.string().optional(),
  cliente_id:         z.string().optional(),
  servico_id:         z.string().optional(),
  canal:              z.string().min(1),
  plano:              z.string().optional(),
  valor:              z.coerce.number().positive("Valor deve ser positivo"),
  ciclo:              z.enum(["MONTHLY", "YEARLY", "WEEKLY"]).default("MONTHLY"),
  proximo_vencimento: z.string().min(1, "Data obrigatória"),
  observacoes:        z.string().optional(),
});

type FormNova = z.input<typeof schemaNova>;

interface Assinatura {
  id: string;
  nome_cliente: string;
  email_cliente: string | null;
  cliente: { id: string; nome: string } | null;
  servico: { id: string; nome: string } | null;
  canal: string;
  plano: string | null;
  valor: number;
  ciclo: string;
  status: string;
  asaas_subscription_id: string | null;
  proximo_vencimento: string | null;
  data_inicio: string;
  data_cancelamento: string | null;
  observacoes: string | null;
}

interface Servico {
  id: string; nome: string; canal: string | null; plano: string | null;
  valor_base: number | null; tipo_cobranca: string | null;
}

interface Kpis {
  mrr: number;
  ativas: number;
  inadimplentes: number;
  mrrPorCanal: { ARATO: number; CONSELHO_AGRO: number; CONSULTORIA: number };
}

interface Props {
  assinaturas: Assinatura[];
  clientes: { id: string; nome: string }[];
  servicos: Servico[];
  kpis: Kpis;
  canalFiltro: string;
  statusFiltro: string;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CANAIS = ["ARATO", "CONSELHO_AGRO", "CONSULTORIA"];
const PLANOS_POR_CANAL: Record<string, string[]> = {
  ARATO:        ["ESSENCIAL", "GESTAO", "PERFORMANCE"],
  CONSELHO_AGRO: ["NOVO_AGRO", "MESA_AGRO", "CONSULTORIA_AGR"],
  CONSULTORIA:  ["MENTORIA", "PROJETO"],
};

export default function AssinaturasClient({ assinaturas: inicial, clientes, servicos, kpis, canalFiltro, statusFiltro }: Props) {
  const router = useRouter();
  const [assinaturas, setAssinaturas] = useState(inicial);
  const [modalNova, setModalNova] = useState(false);
  const [cancelando, setCancelando] = useState<Assinatura | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [isPending, startTransition] = useTransition();

  const tabs = [
    { key: "TODOS", label: "Todas" },
    { key: "ATIVA", label: "Ativas" },
    { key: "INADIMPLENTE", label: "Inadimplentes" },
    { key: "PAUSADA", label: "Pausadas" },
    { key: "CANCELADA", label: "Canceladas" },
  ];

  const canaisTabs = [
    { key: "TODOS", label: "Todos canais" },
    { key: "ARATO", label: "Arato SaaS" },
    { key: "CONSELHO_AGRO", label: "O Conselho Agro" },
    { key: "CONSULTORIA", label: "Consultoria" },
  ];

  const form = useForm<FormNova>({ resolver: zodResolver(schemaNova) });
  const canalSelecionado = form.watch("canal");
  const planosDisponiveis = canalSelecionado ? (PLANOS_POR_CANAL[canalSelecionado] ?? []) : [];

  // Preenche valor ao selecionar serviço
  const servicoIdWatch = form.watch("servico_id");
  const servicoSelecionado = servicos.find((s) => s.id === servicoIdWatch);

  const onSubmit = (data: FormNova) => {
    startTransition(async () => {
      try {
        const nova = await criarAssinatura(data);
        setAssinaturas((prev) => [{ ...nova, valor: Number(nova.valor), proximo_vencimento: nova.proximo_vencimento?.toISOString() ?? null, data_inicio: nova.data_inicio.toISOString(), data_cancelamento: null, criado_em: nova.criado_em.toISOString(), cliente: null, servico: null, email_cliente: data.email_cliente || null } as unknown as Assinatura, ...prev]);
        toast.success("Assinatura criada");
        setModalNova(false);
        form.reset();
        router.refresh();
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao criar"); }
    });
  };

  const handleCancelar = () => {
    if (!cancelando) return;
    startTransition(async () => {
      try {
        await cancelarAssinatura(cancelando.id, motivoCancelamento || undefined);
        setAssinaturas((prev) => prev.map((a) => a.id === cancelando.id ? { ...a, status: "CANCELADA", data_cancelamento: new Date().toISOString() } : a));
        toast.success("Assinatura cancelada");
        setCancelando(null);
        setMotivoCancelamento("");
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao cancelar"); }
    });
  };

  const handleSincronizar = (id: string) => {
    startTransition(async () => {
      try {
        const res = await sincronizarAssinatura(id);
        toast.success(`Status Asaas: ${res.status}`);
        router.refresh();
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro ao sincronizar"); }
    });
  };

  const navigate = (canal: string, status: string) => {
    const params = new URLSearchParams();
    if (canal !== "TODOS") params.set("canal", canal);
    if (status !== "TODOS") params.set("status", status);
    router.push(`/financeiro/assinaturas?${params.toString()}`);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Assinaturas</h1>
        </div>
        <Button size="sm" onClick={() => { form.reset(); setModalNova(true); }}>
          <Plus className="size-4 mr-1.5" /> Nova assinatura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <TrendingUp className="size-3.5" /> MRR Total
          </div>
          <p className="text-2xl font-bold text-primary">{formatBRL(kpis.mrr)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Users className="size-3.5" /> Assinaturas Ativas
          </div>
          <p className="text-2xl font-bold">{kpis.ativas}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <AlertTriangle className="size-3.5 text-destructive" /> Inadimplentes
          </div>
          <p className="text-2xl font-bold text-destructive">{kpis.inadimplentes}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <DollarSign className="size-3.5" /> MRR por Canal
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Arato</span><span className="font-medium">{formatBRL(kpis.mrrPorCanal.ARATO)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Agro</span><span className="font-medium">{formatBRL(kpis.mrrPorCanal.CONSELHO_AGRO)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Consultoria</span><span className="font-medium">{formatBRL(kpis.mrrPorCanal.CONSULTORIA)}</span></div>
          </div>
        </div>
      </div>

      {/* Filtros canal */}
      <div className="flex gap-1 flex-wrap">
        {canaisTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.key, statusFiltro)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              canalFiltro === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros status */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate(canalFiltro, tab.key)}
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
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Próx. Venc.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assinaturas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhuma assinatura encontrada
                </TableCell>
              </TableRow>
            )}
            {assinaturas.map((a) => {
              const cfg = STATUS_CONFIG[a.status as StatusAssinatura] ?? STATUS_CONFIG.ATIVA;
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <span className="block">{a.cliente?.nome ?? a.nome_cliente}</span>
                    {a.email_cliente && <span className="text-xs text-muted-foreground">{a.email_cliente}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {CANAL_LABELS[a.canal] ?? a.canal}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.plano ? (PLANO_LABELS[a.plano] ?? a.plano) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(a.valor)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {{ MONTHLY: "Mensal", YEARLY: "Anual", WEEKLY: "Semanal" }[a.ciclo] ?? a.ciclo}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.proximo_vencimento
                      ? new Date(a.proximo_vencimento).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.asaas_subscription_id && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground"
                          title="Sincronizar com Asaas"
                          onClick={() => handleSincronizar(a.id)}
                          disabled={isPending}
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                      )}
                      {a.status !== "CANCELADA" && (
                        <Button
                          size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                          title="Cancelar assinatura"
                          onClick={() => setCancelando(a)}
                        >
                          <XCircle className="size-3.5" />
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

      {/* Modal nova assinatura */}
      <Dialog open={modalNova} onOpenChange={setModalNova}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova assinatura</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome do cliente *</Label>
                <Input {...form.register("nome_cliente")} placeholder="Nome completo" />
                {form.formState.errors.nome_cliente && <p className="text-xs text-destructive">{form.formState.errors.nome_cliente.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input {...form.register("email_cliente")} type="email" placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input {...form.register("telefone_cliente")} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Cliente cadastrado</Label>
              <Select value={form.watch("cliente_id") ?? ""} onValueChange={(v) => form.setValue("cliente_id", v === "nenhum" ? undefined : v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Nenhum (preencher acima)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Canal *</Label>
                <Select value={form.watch("canal") ?? ""} onValueChange={(v) => { form.setValue("canal", v || ""); form.setValue("plano", undefined); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => <SelectItem key={c} value={c}>{CANAL_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.canal && <p className="text-xs text-destructive">{form.formState.errors.canal.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Plano</Label>
                <Select value={form.watch("plano") ?? ""} onValueChange={(v) => form.setValue("plano", v === "nenhum" ? undefined : v || undefined)} disabled={!canalSelecionado}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {planosDisponiveis.map((p) => <SelectItem key={p} value={p}>{PLANO_LABELS[p] ?? p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Serviço vinculado</Label>
              <Select value={form.watch("servico_id") ?? ""} onValueChange={(v) => {
                form.setValue("servico_id", v === "nenhum" ? undefined : v || undefined);
                const s = servicos.find((s) => s.id === v);
                if (s?.valor_base) form.setValue("valor", s.valor_base);
                if (s?.canal) form.setValue("canal", s.canal);
                if (s?.plano) form.setValue("plano", s.plano ?? undefined);
              }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input {...form.register("valor")} type="number" step="0.01" min="0.01" placeholder="0,00" />
                {form.formState.errors.valor && <p className="text-xs text-destructive">{form.formState.errors.valor.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Ciclo</Label>
                <Select value={form.watch("ciclo") ?? "MONTHLY"} onValueChange={(v) => form.setValue("ciclo", v as "MONTHLY" | "YEARLY" | "WEEKLY")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Próx. vencimento *</Label>
                <Input {...form.register("proximo_vencimento")} type="date" />
                {form.formState.errors.proximo_vencimento && <p className="text-xs text-destructive">{form.formState.errors.proximo_vencimento.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Input {...form.register("observacoes")} placeholder="Opcional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNova(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar assinatura"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog cancelar */}
      <AlertDialog open={!!cancelando} onOpenChange={(v) => !v && setCancelando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A assinatura de <strong>{cancelando?.nome_cliente}</strong> ({CANAL_LABELS[cancelando?.canal ?? ""] ?? cancelando?.canal}) será cancelada. Se vinculada ao Asaas, a cobrança recorrente também será interrompida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label className="text-sm">Motivo (opcional)</Label>
            <Input
              className="mt-1"
              placeholder="Ex.: cliente solicitou cancelamento"
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar} disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
