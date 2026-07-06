import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";

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

export default async function ConselhoAgroListPage() {
  const empresaId = await obterEmpresaAtiva();

  const diagnosticos = await prisma.diagnostico.findMany({
    where: {
      empresa_id: empresaId,
      conteudo: { path: ["origem"], equals: "oconselhoagro.com.br" },
    },
    orderBy: { criado_em: "desc" },
  });

  const ATIVIDADE_LABEL: Record<string, string> = {
    soja: "Soja", milho: "Milho", algodao: "Algodão",
    cana: "Cana", gado: "Gado", outro: "Outro",
  };

  type ConteudoAgro = {
    lead_id?: string;
    score?: { geral?: { percentual?: number; nivel?: string } };
    respostas?: Record<string, unknown>;
  };

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
      criado_em: d.criado_em,
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
                    {r.criado_em.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
