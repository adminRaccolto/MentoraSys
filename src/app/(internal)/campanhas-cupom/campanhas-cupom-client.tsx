"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Ticket, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { criarCupom, editarCupom, excluirCupom, alternarAtivoCupom } from "@/actions/campanhas-cupom"

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  codigo: z.string().min(2, "Código obrigatório"),
  tipo_desconto: z.enum(["PERCENTUAL", "FIXO"]),
  valor_desconto: z.string().min(1, "Valor obrigatório"),
  servico_id: z.string().optional().nullable(),
  ativo: z.boolean(),
  validade_ate: z.string().optional().nullable(),
  usos_maximos: z.string().optional().nullable(),
})

type FormData = z.infer<typeof schema>

interface Servico {
  id: string
  nome: string
  canal: string | null
}

interface Cupom {
  id: string
  nome: string
  codigo: string
  tipo_desconto: "PERCENTUAL" | "FIXO"
  valor_desconto: number
  ativo: boolean
  servico_id: string | null
  servico: Servico | null
  validade_ate: string | null
  usos_maximos: number | null
  usos_count: number
  criado_em: string
  atualizado_em: string
}

export default function CampanhasCupomClient({
  cupons,
  servicos,
}: {
  cupons: Cupom[]
  servicos: Servico[]
}) {
  const [lista, setLista] = useState(cupons)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<Cupom | null>(null)
  const [excluindo, setExcluindo] = useState<Cupom | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      codigo: "",
      tipo_desconto: "PERCENTUAL",
      valor_desconto: "",
      servico_id: null,
      ativo: true,
      validade_ate: null,
      usos_maximos: null,
    },
  })

  function abrirNovo() {
    form.reset({
      nome: "",
      codigo: "",
      tipo_desconto: "PERCENTUAL",
      valor_desconto: "",
      servico_id: null,
      ativo: true,
      validade_ate: null,
      usos_maximos: null,
    })
    setEditando(null)
    setDialogAberto(true)
  }

  function abrirEditar(cupom: Cupom) {
    form.reset({
      nome: cupom.nome,
      codigo: cupom.codigo,
      tipo_desconto: cupom.tipo_desconto,
      valor_desconto: String(cupom.valor_desconto),
      servico_id: cupom.servico_id ?? null,
      ativo: cupom.ativo,
      validade_ate: cupom.validade_ate ? cupom.validade_ate.slice(0, 10) : null,
      usos_maximos: cupom.usos_maximos != null ? String(cupom.usos_maximos) : null,
    })
    setEditando(cupom)
    setDialogAberto(true)
  }

  function onSubmit(data: FormData) {
    startTransition(async () => {
      try {
        if (editando) {
          const result = await editarCupom(editando.id, data)
          setLista((prev) =>
            prev.map((c) =>
              c.id === editando.id
                ? {
                    ...c,
                    ...result.data,
                    valor_desconto: Number(result.data.valor_desconto),
                    validade_ate: result.data.validade_ate?.toISOString() ?? null,
                    criado_em: result.data.criado_em.toISOString(),
                    atualizado_em: result.data.atualizado_em.toISOString(),
                    servico: servicos.find((s) => s.id === data.servico_id) ?? null,
                  }
                : c
            )
          )
          toast.success("Cupom atualizado.")
        } else {
          const result = await criarCupom(data)
          setLista((prev) => [
            {
              ...result.data,
              valor_desconto: Number(result.data.valor_desconto),
              validade_ate: result.data.validade_ate?.toISOString() ?? null,
              criado_em: result.data.criado_em.toISOString(),
              atualizado_em: result.data.atualizado_em.toISOString(),
              servico: servicos.find((s) => s.id === data.servico_id) ?? null,
            },
            ...prev,
          ])
          toast.success("Cupom criado.")
        }
        setDialogAberto(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar.")
      }
    })
  }

  function onExcluir() {
    if (!excluindo) return
    startTransition(async () => {
      try {
        await excluirCupom(excluindo.id)
        setLista((prev) => prev.filter((c) => c.id !== excluindo.id))
        toast.success("Cupom excluído.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir.")
      } finally {
        setExcluindo(null)
      }
    })
  }

  function onToggleAtivo(cupom: Cupom) {
    startTransition(async () => {
      try {
        await alternarAtivoCupom(cupom.id, !cupom.ativo)
        setLista((prev) => prev.map((c) => (c.id === cupom.id ? { ...c, ativo: !c.ativo } : c)))
      } catch {
        toast.error("Erro ao alterar status.")
      }
    })
  }

  const tipoDesconto = form.watch("tipo_desconto")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Cupons de Desconto</h1>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Cupom
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome / Campanha</TableHead>
            <TableHead>Desconto</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Usos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                Nenhum cupom cadastrado.
              </TableCell>
            </TableRow>
          )}
          {lista.map((cupom) => (
            <TableRow key={cupom.id}>
              <TableCell className="font-mono font-semibold tracking-wider">{cupom.codigo}</TableCell>
              <TableCell>{cupom.nome}</TableCell>
              <TableCell>
                {cupom.tipo_desconto === "PERCENTUAL"
                  ? `${cupom.valor_desconto}%`
                  : `R$ ${cupom.valor_desconto.toFixed(2).replace(".", ",")}`}
              </TableCell>
              <TableCell>{cupom.servico?.nome ?? <span className="text-muted-foreground">Todos</span>}</TableCell>
              <TableCell>
                {cupom.validade_ate
                  ? new Date(cupom.validade_ate).toLocaleDateString("pt-BR")
                  : <span className="text-muted-foreground">Sem prazo</span>}
              </TableCell>
              <TableCell>
                {cupom.usos_count}
                {cupom.usos_maximos != null ? ` / ${cupom.usos_maximos}` : ""}
              </TableCell>
              <TableCell>
                <Badge variant={cupom.ativo ? "default" : "secondary"}>
                  {cupom.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="flex gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  title={cupom.ativo ? "Desativar" : "Ativar"}
                  onClick={() => onToggleAtivo(cupom)}
                >
                  {cupom.ativo
                    ? <ToggleRight className="h-4 w-4 text-green-600" />
                    : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => abrirEditar(cupom)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setExcluindo(cupom)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog criar/editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nome da Campanha</Label>
                <Input placeholder="Ex: Lançamento 2025" {...form.register("nome")} />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Código do Cupom</Label>
                <Input
                  placeholder="Ex: LAUNCH20"
                  className="uppercase font-mono"
                  {...form.register("codigo")}
                  onChange={(e) => form.setValue("codigo", e.target.value.toUpperCase())}
                />
                {form.formState.errors.codigo && (
                  <p className="text-xs text-destructive">{form.formState.errors.codigo.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo de Desconto</Label>
                <Select
                  value={form.watch("tipo_desconto")}
                  onValueChange={(v) => form.setValue("tipo_desconto", v as "PERCENTUAL" | "FIXO")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                    <SelectItem value="FIXO">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tipoDesconto === "PERCENTUAL" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={tipoDesconto === "PERCENTUAL" ? "20" : "500,00"}
                  {...form.register("valor_desconto")}
                />
                {form.formState.errors.valor_desconto && (
                  <p className="text-xs text-destructive">{form.formState.errors.valor_desconto.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Serviço (opcional — vazio = válido para qualquer serviço)</Label>
              <Select
                value={form.watch("servico_id") ?? "__all__"}
                onValueChange={(v) => form.setValue("servico_id", v === "__all__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Todos os serviços" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os serviços</SelectItem>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Válido até (opcional)</Label>
                <Input type="date" {...form.register("validade_ate")} />
              </div>
              <div className="space-y-1">
                <Label>Limite de usos (opcional)</Label>
                <Input type="number" min="1" placeholder="Ilimitado" {...form.register("usos_maximos")} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : editando ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={() => setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              O cupom <strong>{excluindo?.codigo}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
