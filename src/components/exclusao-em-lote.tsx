"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirRegistrosEmLote } from "@/actions/exclusao-lote";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ItemSelecionavel {
  id: string;
  nome: string;
}

export function useSelecaoEmLote(itens: ItemSelecionavel[]) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const visiveis = new Set(itens.map(({ id }) => id));
  const selecionados = itens.filter(({ id }) => ids.has(id));
  const todos = itens.length > 0 && selecionados.length === itens.length;

  const limpar = () => setIds(new Set());
  const remover = (concluidos: Set<string>) => {
    setIds((prev) => new Set([...prev].filter((id) => !concluidos.has(id))));
  };
  const selecionarTodos = (
    <Checkbox
      aria-label="Selecionar todos os registros visíveis"
      checked={todos}
      indeterminate={selecionados.length > 0 && !todos}
      disabled={itens.length === 0}
      onCheckedChange={(marcado) => setIds(marcado ? visiveis : new Set())}
    />
  );

  function seletor(id: string, nome: string) {
    if (!visiveis.has(id)) return null;

    return (
      <Checkbox
        aria-label={`Selecionar ${nome}`}
        checked={ids.has(id)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onCheckedChange={(marcado) => setIds((prev) => {
          const proximos = new Set(prev);
          if (marcado) proximos.add(id);
          else proximos.delete(id);
          return proximos;
        })}
      />
    );
  }

  return { selecionados, selecionarTodos, seletor, estaSelecionado: (id: string) => ids.has(id), limpar, remover };
}

export function BarraSelecaoEmLote({
  quantidade, limpar, children,
}: { quantidade: number; limpar: () => void; children: React.ReactNode }) {
  return (
    <div className={quantidade ? "flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2" : "hidden"}>
      <span className="text-sm font-medium text-primary">{quantidade} {quantidade === 1 ? "selecionado" : "selecionados"}</span>
      {children}
      <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={limpar}>
        Limpar seleção
      </Button>
    </div>
  );
}

type TipoExclusao = Parameters<typeof excluirRegistrosEmLote>[0];
type Falha = { nome: string; motivo: string };

interface BotaoExclusaoEmLoteProps {
  tipo: TipoExclusao;
  itens: ItemSelecionavel[];
  aviso?: string;
  verbo?: "Excluir" | "Desativar";
  onConcluido: (ids: Set<string>) => void;
}

export function BotaoExclusaoEmLote({
  tipo, itens, aviso, verbo = "Excluir", onConcluido,
}: BotaoExclusaoEmLoteProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmados, setConfirmados] = useState<ItemSelecionavel[]>([]);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const concluidos = new Set<string>();
      const erros: Falha[] = [];
      const nomes = new Map(confirmados.map(({ id, nome }) => [id, nome]));

      for (let inicio = 0; inicio < confirmados.length; inicio += 10) {
        const grupo = confirmados.slice(inicio, inicio + 10);
        try {
          const resultado = await excluirRegistrosEmLote(tipo, grupo.map(({ id }) => id));
          resultado.excluidos.forEach((id) => concluidos.add(id));
          for (const { id, motivo } of resultado.falhas) {
            erros.push({ nome: nomes.get(id) ?? "Registro", motivo });
          }
        } catch (erro) {
          erros.push({
            nome: "Lote interrompido",
            motivo: erro instanceof Error ? erro.message : "Não foi possível concluir. Atualize a lista e confira os registros.",
          });
          break;
        }
      }

      if (concluidos.size) {
        onConcluido(concluidos);
        const resultado = verbo === "Desativar" ? "desativado" : "excluído";
        toast.success(`${concluidos.size} ${concluidos.size === 1 ? "registro" : "registros"} ${resultado}${concluidos.size === 1 ? "" : "s"}`);
      }
      router.refresh();

      if (erros.length) setFalhas(erros);
      else setAberto(false);
    });
  }

  const titulo = `${verbo} ${confirmados.length} ${confirmados.length === 1 ? "registro" : "registros"}?`;

  return (
    <AlertDialog open={aberto} onOpenChange={(open) => {
      if (isPending) return;
      if (open) {
        setConfirmados(itens);
        setFalhas([]);
      }
      setAberto(open);
    }}>
      <AlertDialogTrigger
        disabled={itens.length === 0}
        render={<Button type="button" size="sm" variant="outline" className="text-destructive" />}
      >
        <Trash2 className="size-3.5" /> {verbo} selecionados
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{falhas.length ? "Alguns registros precisam de atenção" : titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            {falhas.length ? "Confira o resultado dos itens que não foram concluídos."
              : aviso ?? (verbo === "Excluir"
                ? "Os registros listados serão excluídos permanentemente."
                : "Os registros listados ficarão inativos.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {falhas.length ? (
          <ul className="max-h-48 space-y-2 overflow-auto text-sm" aria-live="polite">
            {falhas.map(({ nome, motivo }, indice) => (
              <li key={indice}><strong>{nome}</strong><div className="text-muted-foreground">{motivo}</div></li>
            ))}
          </ul>
        ) : (
          <ul className="max-h-40 list-inside list-disc overflow-auto text-sm">
            {confirmados.map(({ id, nome }) => <li key={id}>{nome}</li>)}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{falhas.length ? "Fechar" : "Cancelar"}</AlertDialogCancel>
          {!falhas.length && (
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirmar}>
              {isPending ? "Processando..." : verbo}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
