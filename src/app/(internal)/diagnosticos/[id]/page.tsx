import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import EditorSwot from "./editor-swot";
import EditorCanvas from "./editor-canvas";
import EditorCincoW from "./editor-cinco-w";
import EditorOrganograma from "./editor-organograma";
import EditorMapaProcesso from "./editor-mapa-processo";
import EditorGantt from "./editor-gantt";

export default async function DiagnosticoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const empresaId = await obterEmpresaAtiva();

  const diagnostico = await prisma.diagnostico.findUnique({
    where: { id, empresa_id: empresaId },
    include: {
      cliente: { select: { id: true, nome: true } },
      projeto: { select: { id: true, titulo: true } },
    },
  });

  if (!diagnostico) notFound();

  const base = {
    id: diagnostico.id,
    titulo: diagnostico.titulo,
    tipo: diagnostico.tipo,
    conteudo: diagnostico.conteudo as Record<string, unknown>,
    cliente: diagnostico.cliente,
    projeto: diagnostico.projeto,
  };

  if (diagnostico.tipo === "SWOT")          return <EditorSwot {...base} />;
  if (diagnostico.tipo === "CANVAS")        return <EditorCanvas {...base} />;
  if (diagnostico.tipo === "ORGANOGRAMA")   return <EditorOrganograma {...base} />;
  if (diagnostico.tipo === "MAPA_PROCESSO") return <EditorMapaProcesso {...base} />;
  if (diagnostico.tipo === "GANTT")         return <EditorGantt {...base} />;
  return <EditorCincoW {...base} />;
}
