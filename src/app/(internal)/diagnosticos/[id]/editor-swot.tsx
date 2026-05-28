"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarConteudo } from "@/actions/diagnosticos";

interface SwotConteudo {
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
}

interface Props {
  id: string;
  titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const QUADRANTES = [
  {
    key: "forcas" as const,
    label: "Forças",
    descricao: "Vantagens internas",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-300",
    badge: "bg-emerald-500",
  },
  {
    key: "fraquezas" as const,
    label: "Fraquezas",
    descricao: "Desvantagens internas",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    border: "border-rose-300",
    badge: "bg-rose-500",
  },
  {
    key: "oportunidades" as const,
    label: "Oportunidades",
    descricao: "Fatores externos favoráveis",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-300",
    badge: "bg-blue-500",
  },
  {
    key: "ameacas" as const,
    label: "Ameaças",
    descricao: "Fatores externos desfavoráveis",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-300",
    badge: "bg-amber-500",
  },
] as const;

export default function EditorSwot({ id, titulo, conteudo, cliente, projeto }: Props) {
  const router = useRouter();
  const [dados, setDados] = useState<SwotConteudo>({
    forcas: (conteudo.forcas as string[]) ?? [],
    fraquezas: (conteudo.fraquezas as string[]) ?? [],
    oportunidades: (conteudo.oportunidades as string[]) ?? [],
    ameacas: (conteudo.ameacas as string[]) ?? [],
  });
  const [novoItem, setNovoItem] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const salvar = useCallback(
    async (novosDados: SwotConteudo) => {
      setSalvando(true);
      await salvarConteudo(id, novosDados);
      setSalvando(false);
    },
    [id]
  );

  const adicionarItem = (quadrante: keyof SwotConteudo) => {
    const texto = (novoItem[quadrante] ?? "").trim();
    if (!texto) return;
    const atualizado = {
      ...dados,
      [quadrante]: [...dados[quadrante], texto],
    };
    setDados(atualizado);
    setNovoItem((prev) => ({ ...prev, [quadrante]: "" }));
    salvar(atualizado);
  };

  const removerItem = (quadrante: keyof SwotConteudo, idx: number) => {
    const atualizado = {
      ...dados,
      [quadrante]: dados[quadrante].filter((_, i) => i !== idx),
    };
    setDados(atualizado);
    salvar(atualizado);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{titulo}</h1>
            <p className="text-xs text-muted-foreground">
              SWOT
              {cliente && ` · ${cliente.nome}`}
              {projeto && ` · ${projeto.titulo}`}
              {salvando && " · salvando…"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4 mr-1.5" />
          Imprimir
        </Button>
      </div>

      {/* Grade SWOT */}
      <div className="grid grid-cols-2 gap-4 print:gap-2">
        {QUADRANTES.map((q) => (
          <div
            key={q.key}
            className={`${q.bg} border ${q.border} rounded-lg p-4 min-h-48`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-sm ${q.badge} shrink-0`} />
              <div>
                <p className="font-semibold text-sm">{q.label}</p>
                <p className="text-xs text-muted-foreground">{q.descricao}</p>
              </div>
            </div>

            <ul className="space-y-1.5 mb-3">
              {dados[q.key].map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 group/item">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
                  <span className="text-sm flex-1">{item}</span>
                  <button
                    onClick={() => removerItem(q.key, idx)}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5 no-print"
                  >
                    <X className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex gap-1.5 no-print">
              <Input
                className="h-7 text-xs"
                placeholder="Adicionar item…"
                value={novoItem[q.key] ?? ""}
                onChange={(e) => setNovoItem((p) => ({ ...p, [q.key]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && adicionarItem(q.key)}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => adicionarItem(q.key)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
