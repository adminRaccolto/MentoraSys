"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, ListTree, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarConta, editarConta, seedPlanoContas } from "@/actions/plano-contas";

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoPlano = "RECEITA" | "CUSTO" | "DESPESA" | "INVESTIMENTO" | "TESOURARIA";

interface Conta {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: TipoPlano;
  parent_id: string | null;
  aceita_lancamento: boolean;
  ativo: boolean;
  _count: { recebiveis: number; contas_pagar: number; servicos: number; filhos: number };
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["RECEITA", "CUSTO", "DESPESA", "INVESTIMENTO", "TESOURARIA"]),
  codigo: z.string().optional(),
  parent_id: z.string().optional().nullable(),
  aceita_lancamento: z.boolean(),
});

type FormData = z.infer<typeof schema>;

// ─── Config ──────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoPlano, { label: string; color: string }> = {
  RECEITA:     { label: "Receita",     color: "bg-emerald-100 text-emerald-800" },
  CUSTO:       { label: "Custo",       color: "bg-orange-100 text-orange-800"   },
  DESPESA:     { label: "Despesa",     color: "bg-red-100 text-red-800"         },
  INVESTIMENTO:{ label: "Investimento",color: "bg-blue-100 text-blue-800"       },
  TESOURARIA:  { label: "Tesouraria",  color: "bg-purple-100 text-purple-800"   },
};

const nivel = (codigo: string | null) => (codigo?.split(".").length ?? 1) - 1;

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanoContasClient({ contas: inicial }: { contas: Conta[] }) {
  const [contas, setContas] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoPlano | "">("");
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "RECEITA", aceita_lancamento: true },
  });

  const contasFiltradas = filtroTipo ? contas.filter((c) => c.tipo === filtroTipo) : contas;
  const contasLancaveis = contas.filter((c) => c.aceita_lancamento && c.ativo);

  const abrirCriar = () => {
    setContaEditando(null);
    reset({ tipo: "RECEITA", aceita_lancamento: true });
    setModalAberto(true);
  };

  const abrirEditar = (conta: Conta) => {
    setContaEditando(conta);
    reset({
      nome: conta.nome,
      tipo: conta.tipo,
      codigo: conta.codigo ?? "",
      parent_id: conta.parent_id ?? null,
      aceita_lancamento: conta.aceita_lancamento,
    });
    setModalAberto(true);
  };

  const onSubmit = (data: FormData): void => {
    startTransition(async () => {
      try {
        if (contaEditando) {
          const res = await editarConta(contaEditando.id, data);
          setContas((prev) => prev.map((c) => (c.id === contaEditando.id ? { ...c, ...res.data } : c)));
          toast.success("Conta atualizada");
        } else {
          const res = await criarConta(data);
          setContas((prev) => [...prev, { ...res.data, _count: { recebiveis: 0, contas_pagar: 0, servicos: 0, filhos: 0 } }]);
          toast.success("Conta criada");
        }
        setModalAberto(false);
      } catch {
        toast.error("Erro ao salvar conta");
      }
    });
  };

  const handleSeed = () => {
    startTransition(async () => {
      try {
        const res = await seedPlanoContas();
        toast.success(res.message ?? "Plano de contas padrão criado");
        window.location.reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Erro: ${msg}`);
        console.error("[seedPlanoContas]", err);
      }
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Plano de Contas</h1>
          <Badge variant="secondary">{contas.length} contas</Badge>
          <Badge variant="outline" className="text-emerald-700">{contasLancaveis.length} analíticas</Badge>
        </div>
        <div className="flex gap-2">
          {contas.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={isPending}>
              <Sparkles className="size-4 mr-1.5" /> Criar plano padrão
            </Button>
          )}
          <Button onClick={abrirCriar} size="sm">
            <Plus className="size-4 mr-1.5" /> Nova conta
          </Button>
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 flex-wrap">
        {(["", "RECEITA", "CUSTO", "DESPESA", "INVESTIMENTO", "TESOURARIA"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filtroTipo === t
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border text-muted-foreground"
            }`}
          >
            {t === "" ? "Todos" : TIPO_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="w-32">Tipo</TableHead>
              <TableHead className="w-24 text-center">Lançável</TableHead>
              <TableHead className="w-40 text-right text-xs text-muted-foreground">Uso</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contasFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {contas.length === 0
                    ? "Nenhuma conta cadastrada. Use o botão \"Criar plano padrão\" para iniciar."
                    : "Nenhuma conta neste tipo."}
                </TableCell>
              </TableRow>
            )}
            {contasFiltradas.map((conta) => {
              const indent = nivel(conta.codigo);
              return (
                <TableRow
                  key={conta.id}
                  className={`cursor-pointer hover:bg-muted/50 ${!conta.ativo ? "opacity-50" : ""}`}
                  onClick={() => abrirEditar(conta)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {conta.codigo ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${indent * 16}px` }}
                    >
                      {indent > 0 && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
                      <span className={conta.aceita_lancamento ? "font-medium" : "text-muted-foreground"}>
                        {conta.nome}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_CONFIG[conta.tipo].color}`}>
                      {TIPO_CONFIG[conta.tipo].label}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {conta.aceita_lancamento ? (
                      <span className="text-emerald-600 text-xs font-medium">Sim</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Grupo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {conta._count.recebiveis > 0 && <span>{conta._count.recebiveis} rec. </span>}
                    {conta._count.contas_pagar > 0 && <span>{conta._count.contas_pagar} pg. </span>}
                    {conta._count.servicos > 0 && <span>{conta._count.servicos} serv.</span>}
                    {conta._count.recebiveis === 0 && conta._count.contas_pagar === 0 && conta._count.servicos === 0 && "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEditar(conta)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{contaEditando ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input {...register("codigo")} className="h-9" placeholder="Ex.: 1.1.1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo *</Label>
                <Select
                  value={watch("tipo")}
                  onValueChange={(v) => setValue("tipo", v as TipoPlano)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue>
                      {TIPO_CONFIG[watch("tipo")]?.label ?? ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TIPO_CONFIG) as [TipoPlano, { label: string }][]).map(([v, cfg]) => (
                      <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input {...register("nome")} className="h-9" placeholder="Ex.: Consultoria" />
              {errors.nome && <p className="text-destructive text-[10px]">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Conta pai</Label>
              <Select
                value={watch("parent_id") ?? ""}
                onValueChange={(v) => setValue("parent_id", v === "" ? null : v)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue>
                    {watch("parent_id")
                      ? contas.find((c) => c.id === watch("parent_id"))?.nome ?? ""
                      : "Sem conta pai (nível raiz)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem conta pai (nível raiz)</SelectItem>
                  {contas
                    .filter((c) => c.id !== contaEditando?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo ? `${c.codigo} · ` : ""}{c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aceita_lancamento"
                {...register("aceita_lancamento")}
                className="size-4 rounded"
              />
              <Label htmlFor="aceita_lancamento" className="text-sm cursor-pointer">
                Aceita lançamento direto (conta analítica)
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : contaEditando ? "Salvar alterações" : "Cadastrar conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
