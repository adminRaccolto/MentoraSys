import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import DocumentosClient from "./documentos-client";

export default async function DocumentosPage() {
  const empresaId = await obterEmpresaAtiva();

  const [documentos, pastas, clientes, projetos, contratos] = await Promise.all([
    prisma.documento.findMany({
      where: { empresa_id: empresaId },
      include: {
        criador: { select: { id: true, nome: true, avatar_url: true } },
        projeto: { select: { id: true, titulo: true } },
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, titulo: true } },
        pasta: { select: { id: true, nome: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
    prisma.pastaDocumento.findMany({
      where: { empresa_id: empresaId },
      include: { _count: { select: { documentos: true, filhos: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
  ]);

  return (
    <DocumentosClient
      documentos={documentos.map((d) => ({
        ...d,
        criado_em: d.criado_em.toISOString(),
      }))}
      pastas={pastas}
      clientes={clientes}
      projetos={projetos}
      contratos={contratos}
    />
  );
}
