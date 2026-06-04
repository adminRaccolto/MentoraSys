"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegistroAuditoria {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  recurso: string;
  acao: string;
  registro_id: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
}

interface Props {
  registros: RegistroAuditoria[];
  total: number;
  pagina: number;
  pageSize: number;
  usuarios: { id: string; nome: string }[];
  filtros: {
    recurso: string;
    usuario_id: string;
    data_inicio: string;
    data_fim: string;
  };
}

const schema = z.object({
  recurso: z.string().optional(),
  usuario_id: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
});
type FormData = z.input<typeof schema>;

const ACAO_BADGE: Record<string, string> = {
  criar: "bg-emerald-100 text-emerald-700",
  editar: "bg-blue-100 text-blue-700",
  excluir: "bg-red-100 text-red-700",
  baixar: "bg-amber-100 text-amber-700",
};

const RECURSOS = [
  "clientes",
  "contratos",
  "propostas",
  "projetos",
  "agenda",
  "recebiveis",
  "contas-pagar",
  "modelos",
];

function badgeAcao(acao: string) {
  const cls = ACAO_BADGE[acao] ?? "bg-slate-100 text-slate-600";
  return (
    <Badge className={`${cls} border-0 capitalize`} variant="outline">
      {acao}
    </Badge>
  );
}

export default function AuditoriaClient({
  registros,
  total,
  pagina,
  pageSize,
  usuarios,
  filtros,
}: Props) {
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: filtros,
  });

  const totalPaginas = Math.ceil(total / pageSize);

  const aplicarFiltros = form.handleSubmit((data) => {
    const params = new URLSearchParams();
    if (data.recurso) params.set("recurso", data.recurso);
    if (data.usuario_id) params.set("usuario_id", data.usuario_id);
    if (data.data_inicio) params.set("data_inicio", data.data_inicio);
    if (data.data_fim) params.set("data_fim", data.data_fim);
    router.push(`/auditoria?${params.toString()}`);
  });

  const irPagina = (p: number) => {
    const params = new URLSearchParams();
    if (filtros.recurso) params.set("recurso", filtros.recurso);
    if (filtros.usuario_id) params.set("usuario_id", filtros.usuario_id);
    if (filtros.data_inicio) params.set("data_inicio", filtros.data_inicio);
    if (filtros.data_fim) params.set("data_fim", filtros.data_fim);
    params.set("pagina", String(p));
    router.push(`/auditoria?${params.toString()}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-primary" />
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <span className="ml-auto text-sm text-muted-foreground">{total} registros</span>
      </div>

      {/* Filtros */}
      <form onSubmit={aplicarFiltros} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Módulo</Label>
          <Select
            value={form.watch("recurso") ?? ""}
            onValueChange={(v) => form.setValue("recurso", v ?? undefined)}
          >
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Todos">
                {(value: string | null) => value || undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {RECURSOS.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Usuário</Label>
          <Select
            value={form.watch("usuario_id") ?? ""}
            onValueChange={(v) => form.setValue("usuario_id", v ?? undefined)}
          >
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Todos">
                {(value: string | null) => value ? (usuarios.find((u) => u.id === value)?.nome ?? value) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            className="h-8 text-sm w-36"
            {...form.register("data_inicio")}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            className="h-8 text-sm w-36"
            {...form.register("data_fim")}
          />
        </div>

        <Button type="submit" size="sm" className="h-8">
          <Search className="size-3.5 mr-1.5" />
          Filtrar
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            form.reset({ recurso: "", usuario_id: "", data_inicio: "", data_fim: "" });
            router.push("/auditoria");
          }}
        >
          Limpar
        </Button>
      </form>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden">
        {registros.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Nenhum registro encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Data / Hora</th>
                <th className="px-4 py-2.5 text-left font-medium">Usuário</th>
                <th className="px-4 py-2.5 text-left font-medium">Módulo</th>
                <th className="px-4 py-2.5 text-left font-medium">Ação</th>
                <th className="px-4 py-2.5 text-left font-medium">ID do Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {registros.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {new Date(r.criado_em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5">{r.usuario_nome ?? "—"}</td>
                  <td className="px-4 py-2.5 capitalize">{r.recurso}</td>
                  <td className="px-4 py-2.5">{badgeAcao(r.acao)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.registro_id ? r.registro_id.slice(0, 12) + "…" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pagina} de {totalPaginas} · {total} registros
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => irPagina(pagina - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas}
              onClick={() => irPagina(pagina + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
