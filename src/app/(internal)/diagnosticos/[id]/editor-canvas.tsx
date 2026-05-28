"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { salvarConteudo } from "@/actions/diagnosticos";

interface CanvasConteudo {
  parceiros: string;
  atividades_chave: string;
  recursos_chave: string;
  proposta_valor: string;
  relacionamento: string;
  canais: string;
  segmentos: string;
  estrutura_custos: string;
  fontes_receita: string;
}

interface Props {
  id: string;
  titulo: string;
  conteudo: Record<string, unknown>;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; titulo: string } | null;
}

const BLOCOS: Array<{
  key: keyof CanvasConteudo;
  label: string;
  descricao: string;
  color: string;
  gridClass: string;
}> = [
  { key: "parceiros", label: "Parceiros-Chave", descricao: "Quem são seus parceiros e fornecedores?", color: "border-purple-300 bg-purple-50/50", gridClass: "row-span-2" },
  { key: "atividades_chave", label: "Atividades-Chave", descricao: "O que você precisa fazer?", color: "border-blue-300 bg-blue-50/50", gridClass: "" },
  { key: "proposta_valor", label: "Proposta de Valor", descricao: "Que valor você entrega?", color: "border-amber-300 bg-amber-50/50", gridClass: "row-span-2" },
  { key: "relacionamento", label: "Relacionamento", descricao: "Como você se relaciona com clientes?", color: "border-rose-300 bg-rose-50/50", gridClass: "" },
  { key: "segmentos", label: "Segmentos", descricao: "Para quem você cria valor?", color: "border-emerald-300 bg-emerald-50/50", gridClass: "row-span-2" },
  { key: "recursos_chave", label: "Recursos-Chave", descricao: "Que recursos você precisa?", color: "border-blue-300 bg-blue-50/50", gridClass: "" },
  { key: "canais", label: "Canais", descricao: "Como você entrega valor?", color: "border-rose-300 bg-rose-50/50", gridClass: "" },
  { key: "estrutura_custos", label: "Estrutura de Custos", descricao: "Quais são os custos principais?", color: "border-slate-300 bg-slate-50/50", gridClass: "" },
  { key: "fontes_receita", label: "Fontes de Receita", descricao: "Como você gera receita?", color: "border-emerald-300 bg-emerald-50/50", gridClass: "" },
];

export default function EditorCanvas({ id, titulo, conteudo, cliente, projeto }: Props) {
  const router = useRouter();
  const [dados, setDados] = useState<CanvasConteudo>({
    parceiros: String(conteudo.parceiros ?? ""),
    atividades_chave: String(conteudo.atividades_chave ?? ""),
    recursos_chave: String(conteudo.recursos_chave ?? ""),
    proposta_valor: String(conteudo.proposta_valor ?? ""),
    relacionamento: String(conteudo.relacionamento ?? ""),
    canais: String(conteudo.canais ?? ""),
    segmentos: String(conteudo.segmentos ?? ""),
    estrutura_custos: String(conteudo.estrutura_custos ?? ""),
    fontes_receita: String(conteudo.fontes_receita ?? ""),
  });
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (key: keyof CanvasConteudo, value: string) => {
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

  // Layout: 5 colunas × 2 linhas + linha de baixo (custos + receita)
  const top: Array<keyof CanvasConteudo> = [
    "parceiros",
    "atividades_chave",
    "proposta_valor",
    "relacionamento",
    "segmentos",
  ];
  const middle: Array<keyof CanvasConteudo> = ["recursos_chave", "canais"];
  const bottom: Array<keyof CanvasConteudo> = ["estrutura_custos", "fontes_receita"];

  const Bloco = ({ k }: { k: keyof CanvasConteudo }) => {
    const b = BLOCOS.find((x) => x.key === k)!;
    return (
      <div className={`border ${b.color} rounded-lg p-3 flex flex-col gap-1.5`}>
        <div>
          <p className="text-xs font-semibold">{b.label}</p>
          <p className="text-[10px] text-muted-foreground">{b.descricao}</p>
        </div>
        <Textarea
          className="flex-1 text-xs resize-none min-h-[80px] bg-transparent border-0 p-0 focus-visible:ring-0 no-print-hide"
          placeholder="Escreva aqui…"
          value={dados[k]}
          onChange={(e) => handleChange(k, e.target.value)}
        />
        <p className="text-xs hidden print:block whitespace-pre-wrap">{dados[k]}</p>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{titulo}</h1>
            <p className="text-xs text-muted-foreground">
              Business Model Canvas
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

      {/* Grade Canvas — 5 colunas */}
      <div className="space-y-2">
        {/* Linha 1 — Parceiros | Atividades + Recursos | Proposta | Relacionamento + Canais | Segmentos */}
        <div className="grid grid-cols-5 gap-2">
          {/* Parceiros — 2 linhas */}
          <div className="row-span-2">
            <Bloco k="parceiros" />
          </div>
          <Bloco k="atividades_chave" />
          {/* Proposta — 2 linhas */}
          <div className="row-span-2">
            <Bloco k="proposta_valor" />
          </div>
          <Bloco k="relacionamento" />
          {/* Segmentos — 2 linhas */}
          <div className="row-span-2">
            <Bloco k="segmentos" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div /> {/* parceiros placeholder */}
          <Bloco k="recursos_chave" />
          <div /> {/* proposta placeholder */}
          <Bloco k="canais" />
          <div /> {/* segmentos placeholder */}
        </div>
        {/* Linha 3 — Custos | Receita */}
        <div className="grid grid-cols-2 gap-2">
          <Bloco k="estrutura_custos" />
          <Bloco k="fontes_receita" />
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
