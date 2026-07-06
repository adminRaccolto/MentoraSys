import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ConselhoAgroListClient from "./conselho-agro-list-client";

const ATIVIDADE_LABEL: Record<string, string> = {
  soja: "Soja", milho: "Milho", algodao: "Algodão",
  cana: "Cana", gado: "Gado", outro: "Outro",
};

type ConteudoAgro = {
  score?: { geral?: { percentual?: number; nivel?: string } };
  respostas?: Record<string, unknown>;
};

export default async function ConselhoAgroListPage() {
  const empresaId = await obterEmpresaAtiva();

  const diagnosticos = await prisma.diagnostico.findMany({
    where: {
      empresa_id: empresaId,
      conteudo: { path: ["origem"], equals: "oconselhoagro.com.br" },
    },
    orderBy: { criado_em: "desc" },
  });

  const rows = diagnosticos.map((d) => {
    const c = (d.conteudo ?? {}) as ConteudoAgro;
    const nome = d.titulo.replace(/^Diagn[oó]stico\s*[—-]\s*/i, "");
    const atividade = String(c.respostas?.atividade ?? "");
    return {
      id: d.id,
      nome,
      atividade: ATIVIDADE_LABEL[atividade] ?? null,
      percentual: c.score?.geral?.percentual ?? null,
      nivel: c.score?.geral?.nivel ?? null,
      criado_em: d.criado_em.toISOString(),
    };
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Diagnósticos — O Conselho Agro</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length} resposta{rows.length !== 1 ? "s" : ""} recebida{rows.length !== 1 ? "s" : ""} via oconselhoagro.com.br
        </p>
      </div>
      <ConselhoAgroListClient rows={rows} />
    </div>
  );
}
