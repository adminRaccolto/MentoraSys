"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { salvarConteudo } from "@/actions/diagnosticos";

interface CincoWConteudo {
  o_que: string;
  por_que: string;
  onde: string;
  quando: string;
  quem: string;
  como: string;
  quanto: string;
}

interface Props {
  id: string;
  titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const CAMPOS: Array<{
  key: keyof CincoWConteudo;
  sigla: string;
  label: string;
  pergunta: string;
  color: string;
}> = [
  { key: "o_que", sigla: "W", label: "O Quê?", pergunta: "O que será feito?", color: "bg-blue-100 text-blue-700" },
  { key: "por_que", sigla: "W", label: "Por Quê?", pergunta: "Por que será feito? Qual a justificativa?", color: "bg-purple-100 text-purple-700" },
  { key: "onde", sigla: "W", label: "Onde?", pergunta: "Onde será executado?", color: "bg-emerald-100 text-emerald-700" },
  { key: "quando", sigla: "W", label: "Quando?", pergunta: "Quando será feito? Qual o prazo?", color: "bg-amber-100 text-amber-700" },
  { key: "quem", sigla: "W", label: "Quem?", pergunta: "Quem será o responsável?", color: "bg-rose-100 text-rose-700" },
  { key: "como", sigla: "H", label: "Como?", pergunta: "Como será realizado?", color: "bg-cyan-100 text-cyan-700" },
  { key: "quanto", sigla: "H", label: "Quanto?", pergunta: "Quanto vai custar?", color: "bg-slate-100 text-slate-700" },
];

export default function EditorCincoW({ id, titulo, conteudo, cliente, projeto }: Props) {
  const router = useRouter();
  const [dados, setDados] = useState<CincoWConteudo>({
    o_que: String(conteudo.o_que ?? ""),
    por_que: String(conteudo.por_que ?? ""),
    onde: String(conteudo.onde ?? ""),
    quando: String(conteudo.quando ?? ""),
    quem: String(conteudo.quem ?? ""),
    como: String(conteudo.como ?? ""),
    quanto: String(conteudo.quanto ?? ""),
  });
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (key: keyof CincoWConteudo, value: string) => {
      const atualizado = { ...dados, [key]: value };
      setDados(atualizado);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSalvando(true);
        await salvarConteudo(id, atualizado);
        setSalvando(false);
      }, 1200);
    },
    [dados, id]
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{titulo}</h1>
            <p className="text-xs text-muted-foreground">
              5W2H
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAMPOS.map((c) => (
          <div key={c.key} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.color}`}>
                {c.sigla}
              </span>
              <div>
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.pergunta}</p>
              </div>
            </div>
            <Textarea
              rows={4}
              className="resize-none text-sm"
              placeholder="Escreva aqui…"
              value={dados[c.key]}
              onChange={(e) => handleChange(c.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
