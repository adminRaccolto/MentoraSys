import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import DiagnosticosClient from "./diagnosticos-client";

export default async function DiagnosticosPage() {
  const empresaId = await obterEmpresaAtiva();

  const [diagnosticos, clientes, projetos] = await Promise.all([
    prisma.diagnostico.findMany({
      where: { empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true } },
        projeto: { select: { id: true, titulo: true } },
      },
      orderBy: { atualizado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
  ]);

  return (
    <DiagnosticosClient
      diagnosticos={diagnosticos.map((d) => ({
        ...d,
        conteudo: d.conteudo as object,
        criado_em: d.criado_em.toISOString(),
        atualizado_em: d.atualizado_em.toISOString(),
      }))}
      clientes={clientes}
      projetos={projetos}
    />
  );
}
