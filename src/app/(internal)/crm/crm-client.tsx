"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, TrendingUp, ChevronRight, ChevronLeft, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { criarLead, editarLead, moverLead, criarAtividade } from "@/actions/leads";

type StatusLead = "NOVO" | "QUALIFICADO" | "PROPOSTA" | "GANHO" | "PERDIDO";

const COLUNAS: { status: StatusLead; label: string; cor: string }[] = [
  { status: "NOVO", label: "Novo", cor: "bg-blue-100 text-blue-800" },
  { status: "QUALIFICADO", label: "Qualificado", cor: "bg-yellow-100 text-yellow-800" },
  { status: "PROPOSTA", label: "Proposta", cor: "bg-purple-100 text-purple-800" },
  { status: "GANHO", label: "Ganho", cor: "bg-green-100 text-green-800" },
  { status: "PERDIDO", label: "Perdido", cor: "bg-red-100 text-red-800" },
];

const ORDEM_STATUS = COLUNAS.map((c) => c.status);

const schemaLead = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  empresa_nome: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
  cliente_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  valor_estimado: z.string().optional(),
  origem: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaAtividade = z.object({
  tipo: z.enum(["LIGACAO", "EMAIL", "REUNIAO", "NOTA", "WHATSAPP"]),
  descricao: z.string().min(1),
});

type LeadForm = z.input<typeof schemaLead>;
type AtividadeForm = z.input<typeof schemaAtividade>;

interface Lead {
  id: string;
  nome: string;
  empresa_nome: string | null;
  email: string | null;
  telefone: string | null;
  status: StatusLead;
  valor_estimado: unknown;
  cliente_id: string | null;
  responsavel_id: string | null;
  origem: string | null;
  observacoes: string | null;
  cliente: { id: string; nome: string } | null;
}

interface Props {
  leads: Lead[];
  clientes: { id: string; nome: string }[];
  membros: { usuario: { id: string; nome: string } }[];
}

function formatarValor(v: unknown) {
  if (v == null) return null;
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmClient({ leads: inicial, clientes, membros }: Props) {
  const [leads, setLeads] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [leadEditando, setLeadEditando] = useState<Lead | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<LeadForm>({ resolver: zodResolver(schemaLead) });

  const {
    register: regAtiv,
    handleSubmit: handleAtiv,
    reset: resetAtiv,
    setValue: setAtivValue,
    watch: watchAtiv,
    formState: { errors: errAtiv },
  } = useForm<AtividadeForm>({ resolver: zodResolver(schemaAtividade), defaultValues: { tipo: "NOTA" } });

  const leadsPorStatus = (status: StatusLead) => leads.filter((l) => l.status === status);

  const totalPorStatus = (status: StatusLead) =>
    leads
      .filter((l) => l.status === status)
      .reduce((acc, l) => acc + Number(l.valor_estimado ?? 0), 0);

  const abrirCriar = () => {
    setLeadEditando(null);
    reset({});
    setModalAberto(true);
  };

  const onSubmitLead = (data: LeadForm) => {
    startTransition(async () => {
      try {
        if (leadEditando) {
          const res = await editarLead(leadEditando.id, data);
          setLeads((prev) => prev.map((l) => (l.id === leadEditando.id ? { ...l, ...res.data } : l)));
          toast.success("Lead atualizado");
        } else {
          const res = await criarLead(data);
          setLeads((prev) => [...prev, { ...res.data, cliente: null } as Lead]);
          toast.success("Lead criado");
        }
        setModalAberto(false);
        setLeadSelecionado(null);
      } catch {
        toast.error("Erro ao salvar lead");
      }
    });
  };

  const mover = (lead: Lead, direcao: "avancar" | "retroceder") => {
    const idx = ORDEM_STATUS.indexOf(lead.status);
    const novoIdx = direcao === "avancar" ? idx + 1 : idx - 1;
    if (novoIdx < 0 || novoIdx >= ORDEM_STATUS.length) return;

    const novoStatus = ORDEM_STATUS[novoIdx];
    startTransition(async () => {
      try {
        await moverLead(lead.id, novoStatus);
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: novoStatus } : l))
        );
        if (leadSelecionado?.id === lead.id) {
          setLeadSelecionado((prev) => prev && { ...prev, status: novoStatus });
        }
      } catch {
        toast.error("Erro ao mover lead");
      }
    });
  };

  const onSubmitAtividade = (data: AtividadeForm) => {
    if (!leadSelecionado) return;
    startTransition(async () => {
      try {
        await criarAtividade(leadSelecionado.id, data);
        toast.success("Atividade registrada");
        resetAtiv({ tipo: "NOTA" });
      } catch {
        toast.error("Erro ao registrar atividade");
      }
    });
  };

  const abrirEditar = (lead: Lead) => {
    setLeadEditando(lead);
    reset({
      nome: lead.nome,
      empresa_nome: lead.empresa_nome ?? "",
      email: lead.email ?? "",
      telefone: lead.telefone ?? "",
      cliente_id: lead.cliente_id ?? "",
      responsavel_id: lead.responsavel_id ?? "",
      valor_estimado: lead.valor_estimado != null ? String(lead.valor_estimado) : "",
      origem: lead.origem ?? "",
      observacoes: lead.observacoes ?? "",
    });
    setModalAberto(true);
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">CRM</h1>
          <Badge variant="secondary">{leads.length} leads</Badge>
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus className="size-4 mr-1.5" /> Novo lead
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2 flex-1">
        {COLUNAS.map(({ status, label, cor }) => (
          <div key={status} className="flex flex-col w-64 shrink-0">
            {/* Cabeçalho da coluna */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {leadsPorStatus(status).length}
                </span>
              </div>
              {totalPorStatus(status) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {totalPorStatus(status).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  })}
                </span>
              )}
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 max-h-[calc(100vh-200px)]">
              <div className="space-y-2 pr-1">
                {leadsPorStatus(status).map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-card rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
                    onClick={() => setLeadSelecionado(lead)}
                  >
                    <p className="text-sm font-medium leading-tight">{lead.nome}</p>
                    {lead.empresa_nome && (
                      <p className="text-xs text-muted-foreground">{lead.empresa_nome}</p>
                    )}
                    {lead.valor_estimado != null && (
                      <p className="text-xs font-medium text-primary">
                        {formatarValor(lead.valor_estimado)}
                      </p>
                    )}
                    <div
                      className="flex gap-1 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ORDEM_STATUS.indexOf(status) > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => mover(lead, "retroceder")}
                          disabled={isPending}
                        >
                          <ChevronLeft className="size-3" />
                        </Button>
                      )}
                      {ORDEM_STATUS.indexOf(status) < ORDEM_STATUS.length - 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => mover(lead, "avancar")}
                          disabled={isPending}
                        >
                          <ChevronRight className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {leadsPorStatus(status).length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                    Sem leads
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Sheet de detalhe do lead */}
      <Sheet open={!!leadSelecionado} onOpenChange={(v) => !v && setLeadSelecionado(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
          {leadSelecionado && (
            <>
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-base">{leadSelecionado.nome}</SheetTitle>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setLeadSelecionado(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-1">
                  {COLUNAS.find((c) => c.status === leadSelecionado.status) && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLUNAS.find((c) => c.status === leadSelecionado.status)!.cor}`}>
                      {COLUNAS.find((c) => c.status === leadSelecionado.status)!.label}
                    </span>
                  )}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-4">
                  {/* Dados */}
                  <div className="space-y-2 text-sm">
                    {leadSelecionado.empresa_nome && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Empresa</span>
                        <span>{leadSelecionado.empresa_nome}</span>
                      </div>
                    )}
                    {leadSelecionado.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">E-mail</span>
                        <span>{leadSelecionado.email}</span>
                      </div>
                    )}
                    {leadSelecionado.telefone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Telefone</span>
                        <span>{leadSelecionado.telefone}</span>
                      </div>
                    )}
                    {leadSelecionado.valor_estimado != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor estimado</span>
                        <span className="font-medium text-primary">{formatarValor(leadSelecionado.valor_estimado)}</span>
                      </div>
                    )}
                  </div>

                  <Button size="sm" variant="outline" className="w-full" onClick={() => abrirEditar(leadSelecionado)}>
                    Editar lead
                  </Button>

                  <Separator />

                  {/* Registrar atividade */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="size-3.5" /> Registrar atividade
                    </p>
                    <form onSubmit={handleAtiv(onSubmitAtividade)} className="space-y-2">
                      <Select
                        value={watchAtiv("tipo")}
                        onValueChange={(v) => setAtivValue("tipo", v as AtividadeForm["tipo"])}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            {(value: string | null) => value || undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {["LIGACAO", "EMAIL", "REUNIAO", "NOTA", "WHATSAPP"].map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        {...regAtiv("descricao")}
                        placeholder="Descreva a atividade..."
                        className="text-xs"
                        rows={3}
                      />
                      {errAtiv.descricao && (
                        <p className="text-destructive text-xs">{errAtiv.descricao.message}</p>
                      )}
                      <Button type="submit" size="sm" className="w-full" disabled={isPending}>
                        Salvar atividade
                      </Button>
                    </form>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal criar/editar lead */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{leadEditando ? "Editar lead" : "Novo lead"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitLead)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome do contato *</Label>
                <Input {...register("nome")} placeholder="João Silva" />
                {errors.nome && <p className="text-destructive text-xs">{errors.nome.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Input {...register("empresa_nome")} placeholder="Empresa ABC" />
              </div>
              <div className="space-y-1">
                <Label>Valor estimado (R$)</Label>
                <Input {...register("valor_estimado")} type="number" step="0.01" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input {...register("email")} type="email" />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input {...register("telefone")} />
              </div>
              <div className="space-y-1">
                <Label>Cliente vinculado</Label>
                <Select value={watch("cliente_id") ?? ""} onValueChange={(v) => setValue("cliente_id", v ?? undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione...">
                      {(value: string | null) => value ? (clientes.find((c) => c.id === value)?.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select value={watch("responsavel_id") ?? ""} onValueChange={(v) => setValue("responsavel_id", v ?? undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione...">
                      {(value: string | null) => value ? (membros.find((m) => m.usuario.id === value)?.usuario.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {membros.map((m) => (
                      <SelectItem key={m.usuario.id} value={m.usuario.id}>{m.usuario.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Origem</Label>
                <Input {...register("origem")} placeholder="Ex: Indicação, LinkedIn, Site..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Observações</Label>
                <Textarea {...register("observacoes")} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
