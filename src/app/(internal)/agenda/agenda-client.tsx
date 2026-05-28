"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Trash2,
  Clock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { criarEvento, editarEvento, excluirEvento } from "@/actions/agenda";

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  dia_todo: boolean;
  lembrete_minutos: number | null;
  lembrete_em: string | null;
  responsavel_id: string | null;
  cliente_id: string | null;
  contrato_id: string | null;
  projeto_id: string | null;
  cliente: { id: string; nome: string } | null;
  contrato: { id: string; titulo: string } | null;
  projeto: { id: string; titulo: string } | null;
  responsavel: { id: string; nome: string } | null;
}

interface Props {
  eventos: Evento[];
  clientes: { id: string; nome: string }[];
  contratos: { id: string; titulo: string }[];
  projetos: { id: string; titulo: string }[];
  usuarios: { id: string; nome: string }[];
  mes: number;
  ano: number;
}

const schema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  inicio: z.string().min(1, "Data obrigatória"),
  fim: z.string().optional(),
  dia_todo: z.boolean().optional(),
  lembrete_minutos: z.string().optional(),
  responsavel_id: z.string().optional(),
  cliente_id: z.string().optional(),
  contrato_id: z.string().optional(),
  projeto_id: z.string().optional(),
});
type FormData = z.input<typeof schema>;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CORES_EVENTO = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function corEvento(id: string) {
  const hash = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return CORES_EVENTO[hash % CORES_EVENTO.length];
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendaClient({
  eventos,
  clientes,
  contratos,
  projetos,
  usuarios,
  mes,
  ano,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [vista, setVista] = useState<"calendario" | "lista">("calendario");
  const [modalAberto, setModalAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titulo: "",
      descricao: "",
      inicio: "",
      fim: "",
      dia_todo: false,
      lembrete_minutos: "",
      responsavel_id: "",
      cliente_id: "",
      contrato_id: "",
      projeto_id: "",
    },
  });

  const abrirNovo = () => {
    setEventoEditando(null);
    form.reset({
      titulo: "",
      descricao: "",
      inicio: "",
      fim: "",
      dia_todo: false,
      lembrete_minutos: "",
      responsavel_id: "",
      cliente_id: "",
      contrato_id: "",
      projeto_id: "",
    });
    setModalAberto(true);
  };

  const abrirEditar = (evento: Evento) => {
    setEventoEditando(evento);
    form.reset({
      titulo: evento.titulo,
      descricao: evento.descricao ?? "",
      inicio: evento.inicio.slice(0, 16),
      fim: evento.fim?.slice(0, 16) ?? "",
      dia_todo: evento.dia_todo,
      lembrete_minutos: evento.lembrete_minutos?.toString() ?? "",
      responsavel_id: evento.responsavel_id ?? "",
      cliente_id: evento.cliente_id ?? "",
      contrato_id: evento.contrato_id ?? "",
      projeto_id: evento.projeto_id ?? "",
    });
    setModalAberto(true);
  };

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const payload = {
        ...data,
        lembrete_minutos: data.lembrete_minutos ? parseInt(data.lembrete_minutos) : undefined,
        responsavel_id: data.responsavel_id || undefined,
        cliente_id: data.cliente_id || undefined,
        contrato_id: data.contrato_id || undefined,
        projeto_id: data.projeto_id || undefined,
      };

      if (eventoEditando) {
        await editarEvento(eventoEditando.id, payload);
      } else {
        await criarEvento(payload);
      }

      setModalAberto(false);
      router.refresh();
    });
  });

  const handleExcluir = () => {
    if (!excluirId) return;
    startTransition(async () => {
      await excluirEvento(excluirId);
      setExcluirId(null);
      setModalAberto(false);
      router.refresh();
    });
  };

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    router.push(`/agenda?mes=${novoMes}&ano=${novoAno}`);
  };

  // Monta grid do calendário
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const eventosPorDia = (dia: number) =>
    eventos.filter((e) => new Date(e.inicio).getDate() === dia);

  const hoje = new Date();
  const ehHoje = (dia: number) =>
    dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navMes(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-lg font-semibold w-44 text-center">
              {MESES[mes]} {ano}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navMes(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setVista("calendario")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                vista === "calendario"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Calendar className="size-3.5" />
              Calendário
            </button>
            <button
              onClick={() => setVista("lista")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                vista === "lista"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <List className="size-3.5" />
              Lista
            </button>
          </div>
        </div>
        <Button onClick={abrirNovo} size="sm">
          <Plus className="size-4 mr-1.5" />
          Novo Evento
        </Button>
      </div>

      {/* Vista Calendário */}
      {vista === "calendario" && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 bg-muted">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {/* Células */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {celulas.map((dia, idx) => (
              <div
                key={idx}
                className={`min-h-[100px] p-1.5 ${dia ? "bg-card" : "bg-muted/30"}`}
              >
                {dia && (
                  <>
                    <span
                      className={`text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full mb-1 ${
                        ehHoje(dia)
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {dia}
                    </span>
                    <div className="space-y-0.5">
                      {eventosPorDia(dia).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => abrirEditar(ev)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] text-white truncate ${corEvento(ev.id)}`}
                        >
                          {ev.dia_todo ? "" : formatHora(ev.inicio) + " "}
                          {ev.titulo}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista Lista */}
      {vista === "lista" && (
        <div className="border border-border rounded-lg overflow-hidden">
          {eventos.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Nenhum evento neste mês.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Evento</th>
                  <th className="px-4 py-2 text-left font-medium">Data / Hora</th>
                  <th className="px-4 py-2 text-left font-medium">Vínculo</th>
                  <th className="px-4 py-2 text-left font-medium">Responsável</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventos.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => abrirEditar(ev)}
                  >
                    <td className="px-4 py-2.5 font-medium">{ev.titulo}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {ev.dia_todo
                          ? new Date(ev.inicio).toLocaleDateString("pt-BR")
                          : new Date(ev.inicio).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {ev.cliente?.nome ?? ev.contrato?.titulo ?? ev.projeto?.titulo ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {ev.responsavel?.nome ?? "—"}
                    </td>
                    <td
                      className="px-2 py-2.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExcluirId(ev.id);
                      }}
                    >
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {eventoEditando ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input {...form.register("titulo")} />
              {form.formState.errors.titulo && (
                <p className="text-xs text-destructive">{form.formState.errors.titulo.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início *</Label>
                <Input type="datetime-local" {...form.register("inicio")} />
                {form.formState.errors.inicio && (
                  <p className="text-xs text-destructive">{form.formState.errors.inicio.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input type="datetime-local" {...form.register("fim")} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dia_todo"
                className="rounded"
                {...form.register("dia_todo")}
              />
              <Label htmlFor="dia_todo" className="cursor-pointer">Dia todo</Label>
            </div>

            <div className="space-y-1">
              <Label>Lembrete</Label>
              <Select
                value={form.watch("lembrete_minutos") ?? ""}
                onValueChange={(v) => form.setValue("lembrete_minutos", v ?? undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem lembrete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem lembrete</SelectItem>
                  <SelectItem value="30">30 minutos antes</SelectItem>
                  <SelectItem value="60">1 hora antes</SelectItem>
                  <SelectItem value="1440">1 dia antes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Select
                  value={form.watch("cliente_id") ?? ""}
                  onValueChange={(v) => form.setValue("cliente_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select
                  value={form.watch("responsavel_id") ?? ""}
                  onValueChange={(v) => form.setValue("responsavel_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contrato</Label>
                <Select
                  value={form.watch("contrato_id") ?? ""}
                  onValueChange={(v) => form.setValue("contrato_id", v ?? undefined)}
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
                <Label>Projeto</Label>
                <Select
                  value={form.watch("projeto_id") ?? ""}
                  onValueChange={(v) => form.setValue("projeto_id", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={3} {...form.register("descricao")} />
            </div>

            <DialogFooter className="gap-2">
              {eventoEditando && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setExcluirId(eventoEditando.id)}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Excluir
                </Button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {eventoEditando ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!excluirId} onOpenChange={() => setExcluirId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir evento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. O evento será permanentemente removido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
