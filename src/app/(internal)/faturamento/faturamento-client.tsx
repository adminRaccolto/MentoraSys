"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Receipt,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  SendHorizonal,
  XCircle,
  Trash2,
  ArrowDownCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarNota,
  editarNota,
  emitirNota,
  baixarNota,
  cancelarNota,
  excluirNota,
  gerarRecebivel,
} from "@/actions/faturamento";

interface Nota {
  id: string;
  numero: string | null;
  competencia: string;
  valor: number;
  descricao: string;
  status: "PENDENTE" | "EMITIDA" | "PAGA" | "CANCELADA";
  data_emissao: string | null;
  data_vencimento: string | null;
  observacoes: string | null;
  cliente_id: string;
  contrato_id: string | null;
  cliente: { id: string; nome: string };
  contrato: { id: string; titulo: string } | null;
}

interface KpiData {
  valor: number;
  count: number;
}

interface Props {
  notas: Nota[];
  clientes: { id: string; nome: string }[];
  contratos: { id: string; titulo: string }[];
  kpis: Record<string, KpiData>;
  mes: number;
  ano: number;
  filtros: { cliente_id: string; status: string };
}

const schemaCreate = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  contrato_id: z.string().optional(),
  numero: z.string().optional(),
  competencia: z.string().min(1, "Competência obrigatória"),
  valor: z.string().min(1, "Valor obrigatório"),
  descricao: z.string().min(1, "Descrição obrigatória"),
  data_emissao: z.string().optional(),
  data_vencimento: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormCreate = z.input<typeof schemaCreate>;

const schemaEmitir = z.object({
  numero: z.string().optional(),
  data_emissao: z.string().min(1, "Data de emissão obrigatória"),
  data_vencimento: z.string().optional(),
});
type FormEmitir = z.input<typeof schemaEmitir>;

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const STATUS_BADGE: Record<string, string> = {
  PENDENTE: "bg-slate-100 text-slate-600",
  EMITIDA: "bg-blue-100 text-blue-700",
  PAGA: "bg-emerald-100 text-emerald-700",
  CANCELADA: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EMITIDA: "Emitida",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FaturamentoClient({
  notas,
  clientes,
  contratos,
  kpis,
  mes,
  ano,
  filtros,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [notaEditando, setNotaEditando] = useState<Nota | null>(null);
  const [modalEmitir, setModalEmitir] = useState<Nota | null>(null);
  const [confirmarAcao, setConfirmarAcao] = useState<{
    tipo: "baixar" | "cancelar" | "excluir";
    nota: Nota;
  } | null>(null);

  const formCreate = useForm<FormCreate>({
    resolver: zodResolver(schemaCreate),
    defaultValues: {
      cliente_id: "",
      contrato_id: "",
      numero: "",
      competencia: `${ano}-${String(mes + 1).padStart(2, "0")}-01`,
      valor: "",
      descricao: "",
      data_emissao: "",
      data_vencimento: "",
      observacoes: "",
    },
  });

  const formEmitir = useForm<FormEmitir>({
    resolver: zodResolver(schemaEmitir),
    defaultValues: { numero: "", data_emissao: "", data_vencimento: "" },
  });

  // Filtros locais
  const [filtroCliente, setFiltroCliente] = useState(filtros.cliente_id);
  const [filtroStatus, setFiltroStatus] = useState(filtros.status);

  const aplicarFiltros = () => {
    const p = new URLSearchParams();
    p.set("mes", String(mes));
    p.set("ano", String(ano));
    if (filtroCliente) p.set("cliente_id", filtroCliente);
    if (filtroStatus) p.set("status", filtroStatus);
    router.push(`/faturamento?${p.toString()}`);
  };

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    router.push(`/faturamento?mes=${novoMes}&ano=${novoAno}`);
  };

  const abrirNova = () => {
    setNotaEditando(null);
    formCreate.reset({
      cliente_id: "",
      contrato_id: "",
      numero: "",
      competencia: `${ano}-${String(mes + 1).padStart(2, "0")}-01`,
      valor: "",
      descricao: "",
      data_emissao: "",
      data_vencimento: "",
      observacoes: "",
    });
    setModalAberto(true);
  };

  const abrirEditar = (nota: Nota) => {
    setNotaEditando(nota);
    formCreate.reset({
      cliente_id: nota.cliente_id,
      contrato_id: nota.contrato_id ?? "",
      numero: nota.numero ?? "",
      competencia: nota.competencia.slice(0, 10),
      valor: String(nota.valor),
      descricao: nota.descricao,
      data_emissao: nota.data_emissao?.slice(0, 10) ?? "",
      data_vencimento: nota.data_vencimento?.slice(0, 10) ?? "",
      observacoes: nota.observacoes ?? "",
    });
    setModalAberto(true);
  };

  const handleSalvar = formCreate.handleSubmit((data) => {
    startTransition(async () => {
      const payload = { ...data, valor: parseFloat(data.valor) };
      if (notaEditando) {
        await editarNota(notaEditando.id, payload);
      } else {
        await criarNota(payload);
      }
      setModalAberto(false);
      router.refresh();
    });
  });

  const handleEmitir = formEmitir.handleSubmit((data) => {
    if (!modalEmitir) return;
    startTransition(async () => {
      await emitirNota(modalEmitir.id, data);
      setModalEmitir(null);
      router.refresh();
    });
  });

  const handleConfirmar = () => {
    if (!confirmarAcao) return;
    startTransition(async () => {
      if (confirmarAcao.tipo === "baixar") await baixarNota(confirmarAcao.nota.id);
      if (confirmarAcao.tipo === "cancelar") await cancelarNota(confirmarAcao.nota.id);
      if (confirmarAcao.tipo === "excluir") await excluirNota(confirmarAcao.nota.id);
      setConfirmarAcao(null);
      router.refresh();
    });
  };

  const handleGerarRecebivel = (id: string) => {
    startTransition(async () => {
      await gerarRecebivel(id);
      router.refresh();
    });
  };

  const totalFaturado = notas
    .filter((n) => n.status !== "CANCELADA")
    .reduce((s, n) => s + n.valor, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Faturamento</h1>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navMes(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium w-28 text-center">
              {MESES[mes]} {ano}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navMes(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={abrirNova}>
          <Plus className="size-4 mr-1.5" />
          Nova Nota
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["PENDENTE", "EMITIDA", "PAGA", "CANCELADA"] as const).map((s) => (
          <div key={s} className="border border-border rounded-lg p-4 bg-card">
            <Badge className={`${STATUS_BADGE[s]} border-0 text-xs mb-2`} variant="outline">
              {STATUS_LABEL[s]}
            </Badge>
            <p className="text-xl font-bold">{fmtMoney(kpis[s]?.valor ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpis[s]?.count ?? 0} nota{(kpis[s]?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cliente</Label>
          <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v ?? "")}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? "")}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="EMITIDA">Emitida</SelectItem>
              <SelectItem value="PAGA">Paga</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8" onClick={aplicarFiltros}>Filtrar</Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => {
            setFiltroCliente("");
            setFiltroStatus("");
            router.push(`/faturamento?mes=${mes}&ano=${ano}`);
          }}
        >
          Limpar
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          Total: <span className="font-semibold">{fmtMoney(totalFaturado)}</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden">
        {notas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma nota fiscal neste período.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">NF / Descrição</th>
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium">Competência</th>
                <th className="px-4 py-2.5 text-left font-medium">Valor</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Vencimento</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notas.map((nota) => (
                <tr
                  key={nota.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => nota.status === "PENDENTE" && abrirEditar(nota)}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{nota.descricao}</p>
                    {nota.numero && (
                      <p className="text-xs text-muted-foreground">NF {nota.numero}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{nota.cliente.nome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {MESES[new Date(nota.competencia).getMonth()]}{" "}
                    {new Date(nota.competencia).getFullYear()}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                    {fmtMoney(nota.valor)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      className={`${STATUS_BADGE[nota.status]} border-0 text-xs`}
                      variant="outline"
                    >
                      {STATUS_LABEL[nota.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {nota.data_vencimento
                      ? new Date(nota.data_vencimento).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td
                    className="px-3 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      {nota.status === "PENDENTE" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                          disabled={isPending}
                          onClick={() => {
                            formEmitir.reset({ numero: "", data_emissao: "", data_vencimento: "" });
                            setModalEmitir(nota);
                          }}
                        >
                          <SendHorizonal className="size-3.5 mr-1" />
                          Emitir
                        </Button>
                      )}
                      {nota.status === "EMITIDA" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                            disabled={isPending}
                            onClick={() => setConfirmarAcao({ tipo: "baixar", nota })}
                          >
                            <CheckCircle className="size-3.5 mr-1" />
                            Pagar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={isPending}
                            onClick={() => handleGerarRecebivel(nota.id)}
                          >
                            <ArrowDownCircle className="size-3.5 mr-1" />
                            Recebível
                          </Button>
                        </>
                      )}
                      {nota.status !== "PAGA" && nota.status !== "CANCELADA" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={isPending}
                          onClick={() =>
                            setConfirmarAcao({
                              tipo: nota.status === "PENDENTE" ? "excluir" : "cancelar",
                              nota,
                            })
                          }
                        >
                          {nota.status === "PENDENTE" ? (
                            <Trash2 className="size-3.5" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criar/editar nota */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{notaEditando ? "Editar Nota" : "Nova Nota Fiscal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Descrição / Serviço *</Label>
                <Input {...formCreate.register("descricao")} placeholder="Ex: Consultoria financeira" />
                {formCreate.formState.errors.descricao && (
                  <p className="text-xs text-destructive">{formCreate.formState.errors.descricao.message}</p>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Cliente *</Label>
                <Select
                  value={formCreate.watch("cliente_id") ?? ""}
                  onValueChange={(v) => formCreate.setValue("cliente_id", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formCreate.formState.errors.cliente_id && (
                  <p className="text-xs text-destructive">{formCreate.formState.errors.cliente_id.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Contrato</Label>
                <Select
                  value={formCreate.watch("contrato_id") ?? ""}
                  onValueChange={(v) => formCreate.setValue("contrato_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Competência *</Label>
                <Input type="month" {...formCreate.register("competencia")} />
                {formCreate.formState.errors.competencia && (
                  <p className="text-xs text-destructive">{formCreate.formState.errors.competencia.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...formCreate.register("valor")}
                />
                {formCreate.formState.errors.valor && (
                  <p className="text-xs text-destructive">{formCreate.formState.errors.valor.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Número NF</Label>
                <Input placeholder="Ex: 00123" {...formCreate.register("numero")} />
              </div>
              <div className="space-y-1">
                <Label>Data de Emissão</Label>
                <Input type="date" {...formCreate.register("data_emissao")} />
              </div>
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Input type="date" {...formCreate.register("data_vencimento")} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} {...formCreate.register("observacoes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {notaEditando ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal emitir NF */}
      <Dialog open={!!modalEmitir} onOpenChange={() => setModalEmitir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir Nota Fiscal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmitir} className="space-y-4">
            <div className="space-y-1">
              <Label>Número da NF</Label>
              <Input placeholder="Ex: 00124" {...formEmitir.register("numero")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de Emissão *</Label>
                <Input type="date" {...formEmitir.register("data_emissao")} />
                {formEmitir.formState.errors.data_emissao && (
                  <p className="text-xs text-destructive">{formEmitir.formState.errors.data_emissao.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Input type="date" {...formEmitir.register("data_vencimento")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEmitir(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                <SendHorizonal className="size-4 mr-1.5" />
                Emitir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar ação */}
      <Dialog open={!!confirmarAcao} onOpenChange={() => setConfirmarAcao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmarAcao?.tipo === "excluir" && "Excluir nota?"}
              {confirmarAcao?.tipo === "cancelar" && "Cancelar nota?"}
              {confirmarAcao?.tipo === "baixar" && "Marcar como paga?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmarAcao?.tipo === "excluir" &&
              "A nota será removida permanentemente."}
            {confirmarAcao?.tipo === "cancelar" &&
              "A nota será marcada como cancelada. Esta ação não pode ser desfeita."}
            {confirmarAcao?.tipo === "baixar" &&
              `Confirmar pagamento de ${confirmarAcao ? fmtMoney(confirmarAcao.nota.valor) : ""}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarAcao(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmarAcao?.tipo === "baixar" ? "default" : "destructive"}
              onClick={handleConfirmar}
              disabled={isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
