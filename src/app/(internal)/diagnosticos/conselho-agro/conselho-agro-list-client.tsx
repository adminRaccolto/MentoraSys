"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { excluirDiagnostico } from "@/actions/diagnosticos";

const NIVEL_LABEL: Record<string, string> = {
  CRITICO: "Crítico",
  ATENCAO: "Atenção",
  BOM: "Bom",
  EXCELENTE: "Excelente",
};

const NIVEL_COR: Record<string, string> = {
  CRITICO: "bg-red-100 text-red-700",
  ATENCAO: "bg-amber-100 text-amber-700",
  BOM: "bg-green-100 text-green-700",
  EXCELENTE: "bg-blue-100 text-blue-700",
};

interface Row {
  id: string;
  nome: string;
  atividade: string | null;
  percentual: number | null;
  nivel: string | null;
  criado_em: string;
}

export default function ConselhoAgroListClient({ rows: inicial }: { rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(inicial);
  const [excluindo, setExcluindo] = useState<Row | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmarExcluir = () => {
    if (!excluindo) return;
    const id = excluindo.id;
    startTransition(async () => {
      try {
        await excluirDiagnostico(id);
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("Diagnóstico excluído");
        setExcluindo(null);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      }
    });
  };

  return (
    <>
      {rows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Nenhum diagnóstico recebido ainda.</p>
          <p className="text-sm mt-1">As respostas do formulário aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Atividade</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Nível</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Data</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/diagnosticos/conselho-agro/${r.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {r.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    {r.atividade ? (
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                        {r.atividade}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.percentual !== null ? (
                      <span className="font-bold text-gray-800">{r.percentual}%</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.nivel ? (
                      <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${NIVEL_COR[r.nivel] ?? "bg-gray-100 text-gray-600"}`}>
                        {NIVEL_LABEL[r.nivel] ?? r.nivel}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {new Date(r.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive opacity-50 hover:opacity-100"
                      title="Excluir diagnóstico"
                      onClick={() => setExcluindo(r)}
                      disabled={isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir diagnóstico?</AlertDialogTitle>
            <AlertDialogDescription>
              O diagnóstico de <strong>{excluindo?.nome}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExcluir}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
