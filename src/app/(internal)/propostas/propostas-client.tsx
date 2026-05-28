"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Send, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { criarProposta, editarProposta, enviarProposta, excluirProposta } from "@/actions/propostas";

type StatusProposta = "RASCUNHO" | "ENVIADA" | "VISUALIZADA" | "ACEITA" | "RECUSADA" | "EXPIRADA";

const STATUS_CONFIG: Record<StatusProposta, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  ENVIADA: { label: "Enviada", className: "bg-blue-100 text-blue-700" },
  VISUALIZADA: { label: "Visualizada", className: "bg-yellow-100 text-yellow-700" },
  ACEITA: { label: "Aceita", className: "bg-green-100 text-green-700" },
  RECUSADA: { label: "Recusada", className: "bg-red-100 text-red-700" },
  EXPIRADA: { label: "Expirada", className: "bg-orange-100 text-orange-700" },
};

const FORMAS_PAGAMENTO = [
  "À vista",
  "Parcelado",
  "Recorrente",
  "Mensal",
  "Trimestral",
  "Semestral",
  "Anual",
];

const PERIODICIDADES = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Única"];

const schemaItem = z.object({
  servico_id: z.string().optional(),
  descricao: z.string().min(1, "Obrigatório"),
  quantidade: z.number().positive(),
  valor_unitario: z.number().min(0),
  desconto: z.number().min(0).max(100),
  ordem: z.number(),
});

const schemaParcela = z.object({
  numero: z.number(),
  vencimento: z.string(),
  valor: z.number().min(0),
});

const schema = z.object({
  cliente_id: z.string().min(1, "Selecione um cliente"),
  lead_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  titulo: z.string().min(2, "Título obrigatório"),
  objeto: z.string().optional(),
  introducao: z.string().optional(),
  condicoes: z.string().optional(),
  validade: z.string().optional(),
  forma_pagamento: z.string().optional(),
  periodicidade: z.string().optional(),
  numero_parcelas: z.coerce.number().int().positive().optional(),
  primeiro_vencimento: z.string().optional(),
  contato_nome: z.string().optional(),
  contato_email: z.string().optional(),
  contato_telefone: z.string().optional(),
  parcelas_json: z.array(schemaParcela).optional(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type FormData = z.input<typeof schema>;
type ParcelaForm = z.input<typeof schemaParcela>;

function periodoParaMeses(p?: string): number {
  const map: Record<string, number> = {
    Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12, "Única": 0,
  };
  return map[p ?? ""] ?? 1;
}

function gerarParcelasIguais(n: number, primeiroVencimento: string, periodicidade: string | undefined, total: number): ParcelaForm[] {
  const meses = periodoParaMeses(periodicidade);
  const valorBase = Math.floor((total / n) * 100) / 100;
  const resto = Math.round((total - valorBase * n) * 100) / 100;

  return Array.from({ length: n }, (_, i) => {
    const d = new Date(primeiroVencimento + "T12:00:00");
    if (meses > 0) d.setMonth(d.getMonth() + i * meses);
    return {
      numero: i + 1,
      vencimento: d.toISOString().split("T")[0],
      valor: i === n - 1 ? Math.round((valorBase + resto) * 100) / 100 : valorBase,
    };
  });
}

interface ItemProposta {
  id: string;
  descricao: string;
  quantidade: unknown;
  valor_unitario: unknown;
  desconto: unknown;
  servico_id: string | null;
  ordem: number;
}

interface Proposta {
  id: string;
  titulo: string;
  status: StatusProposta;
  token_aceite: string;
  valor_total: unknown;
  validade: Date | null;
  criado_em: Date;
  objeto: string | null;
  forma_pagamento: string | null;
  periodicidade: string | null;
  numero_parcelas: number | null;
  primeiro_vencimento: Date | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  responsavel_id: string | null;
  lead_id: string | null;
  introducao: string | null;
  condicoes: string | null;
  parcelas_json: unknown;
  cliente: { id: string; nome: string };
  responsavel: { id: string; nome: string } | null;
  itens: ItemProposta[];
}

interface ModeloDoc { id: string; nome: string }
interface Usuario { id: string; nome: string }

interface Props {
  propostas: Proposta[];
  clientes: { id: string; nome: string; contato_principal: string | null; email: string | null; telefone: string | null }[];
  servicos: { id: string; nome: string; valor_base: number }[];
  leads: { id: string; nome: string; empresa_nome: string | null }[];
  modelosProposta: ModeloDoc[];
  usuarios: Usuario[];
}

function formatarValor(v: unknown) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SelectField({
  label, value, onValueChange, placeholder, children, error, resolvedLabel,
}: {
  label: string; value: string; onValueChange: (v: string) => void;
  placeholder?: string; children: React.ReactNode; error?: string; resolvedLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Select value={value} onValueChange={(v: string | null) => onValueChange(v ?? "")}>
        <SelectTrigger className="w-full h-9 text-sm">
          {resolvedLabel
            ? <span className="truncate">{resolvedLabel}</span>
            : <SelectValue placeholder={placeholder ?? "Selecione..."} />
          }
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export default function PropostasClient({ propostas: inicial, clientes, servicos, leads, modelosProposta, usuarios }: Props) {
  const [propostas, setPropostas] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [propostaEnviando, setPropostaEnviando] = useState<Proposta | null>(null);
  const [propostaExcluindo, setPropostaExcluindo] = useState<Proposta | null>(null);
  const [propostaDocumento, setPropostaDocumento] = useState<Proposta | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { itens: [{ descricao: "", quantidade: 1, valor_unitario: 0, desconto: 0, ordem: 0 }] },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "itens" });
  const { fields: parcelasFields, replace: replaceParcelas } = useFieldArray({ control, name: "parcelas_json" });
  const itensWatch = watch("itens");
  const clienteIdWatch = watch("cliente_id");
  const numeroParcelas = watch("numero_parcelas");
  const primeiroVencimento = watch("primeiro_vencimento");
  const periodicidade = watch("periodicidade");

  const distribuirIgualmente = () => {
    const n = Number(numeroParcelas) || 0;
    if (n < 1 || !primeiroVencimento) return;
    replaceParcelas(gerarParcelasIguais(n, primeiroVencimento, periodicidade, calcularTotal()));
  };

  useEffect(() => {
    const n = Number(numeroParcelas) || 0;
    if (n < 1 || !primeiroVencimento || parcelasFields.length > 0) return;
    replaceParcelas(gerarParcelasIguais(n, primeiroVencimento, periodicidade, calcularTotal()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroParcelas, primeiroVencimento]);

  useEffect(() => {
    if (!clienteIdWatch) return;
    const c = clientes.find((cl) => cl.id === clienteIdWatch);
    if (!c) return;
    if (!watch("contato_nome")) setValue("contato_nome", c.contato_principal ?? "");
    if (!watch("contato_email")) setValue("contato_email", c.email ?? "");
    if (!watch("contato_telefone")) setValue("contato_telefone", c.telefone ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIdWatch]);

  const calcularTotal = () =>
    (itensWatch || []).reduce((acc, item) => {
      const sub = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
      return acc + sub * (1 - (Number(item.desconto) || 0) / 100);
    }, 0);

  const aplicarServico = (idx: number, servicoId: string) => {
    const s = servicos.find((sv) => sv.id === servicoId);
    if (!s) return;
    setValue(`itens.${idx}.servico_id`, s.id);
    setValue(`itens.${idx}.descricao`, s.nome);
    setValue(`itens.${idx}.valor_unitario`, Number(s.valor_base) || 0);
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const abrirCriar = () => {
    setPropostaEditando(null);
    reset({ itens: [{ descricao: "", quantidade: 1, valor_unitario: 0, desconto: 0, ordem: 0 }] });
    setModalAberto(true);
  };

  const abrirEditar = (p: Proposta) => {
    setPropostaEditando(p);
    reset({
      cliente_id: p.cliente.id,
      lead_id: p.lead_id ?? undefined,
      responsavel_id: p.responsavel_id ?? undefined,
      titulo: p.titulo,
      objeto: p.objeto ?? undefined,
      introducao: p.introducao ?? undefined,
      condicoes: p.condicoes ?? undefined,
      validade: p.validade ? new Date(p.validade).toISOString().split("T")[0] : undefined,
      forma_pagamento: p.forma_pagamento ?? undefined,
      periodicidade: p.periodicidade ?? undefined,
      numero_parcelas: p.numero_parcelas ?? undefined,
      primeiro_vencimento: p.primeiro_vencimento
        ? new Date(p.primeiro_vencimento).toISOString().split("T")[0]
        : undefined,
      contato_nome: p.contato_nome ?? undefined,
      contato_email: p.contato_email ?? undefined,
      contato_telefone: p.contato_telefone ?? undefined,
      parcelas_json: Array.isArray(p.parcelas_json) ? (p.parcelas_json as ParcelaForm[]) : undefined,
      itens: p.itens.map((item) => ({
        servico_id: item.servico_id ?? undefined,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        desconto: Number(item.desconto),
        ordem: item.ordem,
      })),
    });
    setModalAberto(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const totalItens = data.itens.reduce((acc, item) => {
          const sub = Number(item.quantidade) * Number(item.valor_unitario);
          return acc + sub * (1 - Number(item.desconto) / 100);
        }, 0);

        const parcelasSerializadas = (() => {
          const p = data.parcelas_json;
          if (!p?.length) return undefined;
          const totalParcelas = p.reduce((s, x) => s + (Number(x.valor) || 0), 0);
          // Auto-distribui se parcelas ainda estão zeradas mas há valor nos itens
          if (totalParcelas < 0.01 && totalItens > 0) {
            const n = p.length;
            const valorBase = Math.floor((totalItens / n) * 100) / 100;
            const resto = Math.round((totalItens - valorBase * n) * 100) / 100;
            return p.map(({ numero, vencimento }, i) => ({
              numero: Number(numero),
              vencimento: String(vencimento),
              valor: i === n - 1 ? Math.round((valorBase + resto) * 100) / 100 : valorBase,
            }));
          }
          return p.map(({ numero, vencimento, valor }) => ({
            numero: Number(numero),
            vencimento: String(vencimento),
            valor: Number(valor),
          }));
        })();

        const payload = {
          ...data,
          numero_parcelas: data.numero_parcelas ? Number(data.numero_parcelas) : undefined,
          parcelas_json: parcelasSerializadas,
          itens: data.itens.map((item) => ({
            servico_id: item.servico_id,
            descricao: item.descricao,
            quantidade: Number(item.quantidade),
            valor_unitario: Number(item.valor_unitario),
            desconto: Number(item.desconto),
            ordem: item.ordem,
          })),
        };

        if (propostaEditando) {
          const res = await editarProposta(propostaEditando.id, payload);
          setPropostas((prev) =>
            prev.map((p) =>
              p.id === propostaEditando.id
                ? {
                    ...p,
                    ...res.data,
                    cliente: clientes.find((c) => c.id === data.cliente_id) ?? p.cliente,
                    responsavel: usuarios.find((u) => u.id === data.responsavel_id) ?? null,
                    itens: (res.data as unknown as { itens: ItemProposta[] }).itens ?? [],
                  }
                : p
            )
          );
          toast.success("Proposta atualizada");
        } else {
          const res = await criarProposta(payload);
          setPropostas((prev) => [
            {
              ...res.data,
              cliente: clientes.find((c) => c.id === data.cliente_id)!,
              responsavel: usuarios.find((u) => u.id === data.responsavel_id) ?? null,
              itens: res.data.itens as unknown as ItemProposta[],
            } as Proposta,
            ...prev,
          ]);
          toast.success("Proposta criada");
        }
        setModalAberto(false);
        reset();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Erro ao salvar proposta: ${msg}`);
        console.error("editarProposta error:", e);
      }
    });
  };

  const confirmarEnvio = () => {
    if (!propostaEnviando) return;
    startTransition(async () => {
      try {
        await enviarProposta(propostaEnviando.id);
        setPropostas((prev) =>
          prev.map((p) => (p.id === propostaEnviando.id ? { ...p, status: "ENVIADA" as StatusProposta } : p))
        );
        toast.success("Proposta marcada como enviada");
        copiarLink(propostaEnviando.token_aceite);
        setPropostaEnviando(null);
      } catch {
        toast.error("Erro ao enviar proposta");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!propostaExcluindo) return;
    startTransition(async () => {
      try {
        await excluirProposta(propostaExcluindo.id);
        setPropostas((prev) => prev.filter((p) => p.id !== propostaExcluindo.id));
        toast.success("Proposta excluída");
        setPropostaExcluindo(null);
      } catch {
        toast.error("Erro ao excluir proposta");
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Propostas</h1>
          <Badge variant="secondary">{propostas.length}</Badge>
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus className="size-4 mr-1.5" /> Nova proposta
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proposta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Condições</TableHead>
              <TableHead>Valor total</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {propostas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhuma proposta criada
                </TableCell>
              </TableRow>
            )}
            {propostas.map((p) => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <TableRow key={p.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => abrirEditar(p)}>
                  <TableCell>
                    <p className="font-medium">{p.titulo}</p>
                    {p.objeto && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.objeto}</p>}
                    {p.responsavel && <p className="text-xs text-muted-foreground">Resp.: {p.responsavel.nome}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.cliente.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.forma_pagamento && <p>{p.forma_pagamento}</p>}
                    {p.numero_parcelas && p.periodicidade && (
                      <p>{p.numero_parcelas}x {p.periodicidade}</p>
                    )}
                    {!p.forma_pagamento && !p.numero_parcelas && "—"}
                  </TableCell>
                  <TableCell className="font-medium">{formatarValor(p.valor_total)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.validade ? new Date(p.validade).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {modelosProposta.length > 0 && (
                        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" title="Gerar documento"
                          onClick={() => setPropostaDocumento(p)}>
                          <FileText className="size-3.5" />
                        </Button>
                      )}
                      {p.status === "RASCUNHO" && (
                        <Button size="icon" variant="ghost" className="size-8" title="Enviar proposta"
                          onClick={() => setPropostaEnviando(p)}>
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" title="Copiar link de aceite"
                        onClick={() => copiarLink(p.token_aceite)}>
                        <Copy className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" title="Abrir link de aceite"
                        onClick={() => window.open(`/p/${p.token_aceite}`, "_blank")}>
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setPropostaExcluindo(p)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw] w-[92vw] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              {propostaEditando ? "Editar proposta" : "Nova proposta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Tabs defaultValue="dados" className="w-full">
              <div className="px-6 pt-3">
                <TabsList>
                  <TabsTrigger value="dados">Dados gerais</TabsTrigger>
                  <TabsTrigger value="itens">
                    Itens{itensWatch?.length > 0 && ` (${itensWatch.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="condicoes">Condições e texto</TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Dados gerais — 3 colunas */}
              <TabsContent value="dados" className="mt-0">
                <div className="grid grid-cols-3 divide-x">
                  {/* Coluna 1: Identificação */}
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Identificação</p>
                    <SelectField
                      label="Cliente *"
                      value={watch("cliente_id") ?? ""}
                      resolvedLabel={clientes.find((c) => c.id === watch("cliente_id"))?.nome}
                      onValueChange={(v) => setValue("cliente_id", v)}
                      error={errors.cliente_id?.message}
                    >
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectField>
                    <SelectField
                      label="Responsável"
                      value={watch("responsavel_id") ?? ""}
                      resolvedLabel={usuarios.find((u) => u.id === watch("responsavel_id"))?.nome}
                      onValueChange={(v) => setValue("responsavel_id", v || undefined)}
                      placeholder="Sem responsável"
                    >
                      <SelectItem value="">Sem responsável</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectField>
                    <Field label="Título *" error={errors.titulo?.message}>
                      <Input {...register("titulo")} className="h-9 text-sm" placeholder="Ex: Proposta de consultoria" />
                    </Field>
                    <Field label="Objeto / Escopo">
                      <Input {...register("objeto")} className="h-9 text-sm" placeholder="Breve descrição do escopo" />
                    </Field>
                    <SelectField
                      label="Lead vinculado"
                      value={watch("lead_id") ?? ""}
                      onValueChange={(v) => setValue("lead_id", v || undefined)}
                      placeholder="Nenhum"
                    >
                      <SelectItem value="">Nenhum</SelectItem>
                      {leads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}{l.empresa_nome ? ` — ${l.empresa_nome}` : ""}
                        </SelectItem>
                      ))}
                    </SelectField>
                    <Field label="Validade">
                      <Input {...register("validade")} type="date" className="h-9 text-sm" />
                    </Field>
                  </div>

                  {/* Coluna 2: Condições comerciais */}
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Condições Comerciais</p>
                    <SelectField
                      label="Forma de pagamento"
                      value={watch("forma_pagamento") ?? ""}
                      onValueChange={(v) => setValue("forma_pagamento", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectField>
                    <SelectField
                      label="Periodicidade"
                      value={watch("periodicidade") ?? ""}
                      onValueChange={(v) => setValue("periodicidade", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectField>
                    <Field label="Nº de parcelas">
                      <Input
                        {...register("numero_parcelas", { valueAsNumber: true })}
                        type="number" min="1" className="h-9 text-sm"
                        placeholder="Ex: 12"
                      />
                    </Field>
                    <Field label="1º vencimento">
                      <Input {...register("primeiro_vencimento")} type="date" className="h-9 text-sm" />
                    </Field>

                    {/* Grid de parcelas */}
                    {parcelasFields.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Grade de Parcelas</p>
                          <button
                            type="button"
                            onClick={distribuirIgualmente}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Distribuir igualmente
                          </button>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="px-2 py-1.5 text-left text-muted-foreground font-medium w-8">#</th>
                                <th className="px-2 py-1.5 text-left text-muted-foreground font-medium">Vencimento</th>
                                <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Valor (R$)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parcelasFields.map((p, idx) => (
                                <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                                  <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                                  <td className="px-2 py-1">
                                    <input
                                      {...register(`parcelas_json.${idx}.vencimento`)}
                                      type="date"
                                      className="w-full border-0 bg-transparent text-xs outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      {...register(`parcelas_json.${idx}.valor`, { valueAsNumber: true })}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="w-full border-0 bg-transparent text-xs text-right outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t bg-muted/30">
                                <td colSpan={2} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-right">Total parcelas:</td>
                                <td className="px-2 py-1.5 text-xs font-bold text-right">
                                  {watch("parcelas_json")?.reduce((s, p) => s + (Number(p.valor) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {Number(numeroParcelas) >= 1 && primeiroVencimento && parcelasFields.length === 0 && (
                      <button
                        type="button"
                        onClick={distribuirIgualmente}
                        className="w-full text-xs text-primary border border-dashed border-primary/40 rounded-md py-2 hover:bg-primary/5 transition-colors"
                      >
                        + Gerar grade de parcelas
                      </button>
                    )}
                  </div>

                  {/* Coluna 3: Contato cliente */}
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Contato do Cliente</p>
                    <Field label="Nome do contato">
                      <Input {...register("contato_nome")} className="h-9 text-sm" placeholder="Nome" />
                    </Field>
                    <Field label="E-mail do contato">
                      <Input {...register("contato_email")} type="email" className="h-9 text-sm" placeholder="email@empresa.com" />
                    </Field>
                    <Field label="Telefone do contato">
                      <Input {...register("contato_telefone")} className="h-9 text-sm" placeholder="(xx) 9xxxx-xxxx" />
                    </Field>
                    <Field label="Introdução / Apresentação">
                      <Textarea {...register("introducao")} rows={5} className="text-sm resize-none"
                        placeholder="Texto de abertura da proposta..." />
                    </Field>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Itens */}
              <TabsContent value="itens" className="mt-0 px-6 py-5 space-y-4">
                {errors.itens?.root && (
                  <p className="text-destructive text-xs">{errors.itens.root.message}</p>
                )}
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</p>
                        {fields.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => remove(idx)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Serviço (opcional)</Label>
                          <Select onValueChange={(v: string | null) => { if (v) aplicarServico(idx, v); }}>
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Importar serviço..." />
                            </SelectTrigger>
                            <SelectContent>
                              {servicos.map((s) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-8 space-y-1">
                          <Label className="text-xs">Descrição *</Label>
                          <Input {...register(`itens.${idx}.descricao`)} className="h-8 text-sm"
                            placeholder="Descrição do item" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input {...register(`itens.${idx}.quantidade`, { valueAsNumber: true })}
                            type="number" step="0.001" min="0.001" className="h-8 text-sm" />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Valor unit. (R$)</Label>
                          <Input {...register(`itens.${idx}.valor_unitario`, { valueAsNumber: true })}
                            type="number" step="0.01" min="0" className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Desc. (%)</Label>
                          <Input {...register(`itens.${idx}.desconto`, { valueAsNumber: true })}
                            type="number" step="0.01" min="0" max="100" className="h-8 text-sm" />
                        </div>
                        <div className="col-span-5 flex items-end pb-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Subtotal</p>
                            <p className="text-sm font-semibold text-primary">
                              {formatarValor(
                                ((Number(itensWatch?.[idx]?.quantidade) || 0) *
                                  (Number(itensWatch?.[idx]?.valor_unitario) || 0)) *
                                  (1 - (Number(itensWatch?.[idx]?.desconto) || 0) / 100)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => append({ descricao: "", quantidade: 1, valor_unitario: 0, desconto: 0, ordem: fields.length })}
                >
                  <Plus className="size-3.5 mr-1" /> Adicionar item
                </Button>
                <Separator />
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total da proposta</p>
                    <p className="text-2xl font-bold text-primary">{formatarValor(calcularTotal())}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Condições e texto */}
              <TabsContent value="condicoes" className="mt-0 px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Condições gerais / Termos">
                    <Textarea {...register("condicoes")} rows={14} className="text-sm resize-none"
                      placeholder="Termos de pagamento, prazo de execução, garantias, penalidades..." />
                  </Field>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="px-6 py-4 border-t bg-muted/20">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : propostaEditando ? "Salvar alterações" : "Criar proposta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal gerar documento */}
      <Dialog open={!!propostaDocumento} onOpenChange={(v) => !v && setPropostaDocumento(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerar documento — {propostaDocumento?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o modelo de proposta:</p>
          <div className="space-y-2">
            {modelosProposta.map((m) => (
              <button
                key={m.id}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
                onClick={() => {
                  setPropostaDocumento(null);
                  window.open(`/modelos/${m.id}/preview?proposta_id=${propostaDocumento!.id}`, "_blank");
                }}
              >
                {m.nome}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropostaDocumento(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar envio */}
      <AlertDialog open={!!propostaEnviando} onOpenChange={(v) => !v && setPropostaEnviando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como enviada?</AlertDialogTitle>
            <AlertDialogDescription>
              A proposta <strong>{propostaEnviando?.titulo}</strong> será marcada como enviada e o link de aceite será copiado para sua área de transferência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEnvio} disabled={isPending}>
              Confirmar e copiar link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!propostaExcluindo} onOpenChange={(v) => !v && setPropostaExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
