import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ProjetosClient from "./projetos-client";

export default async function ProjetosPage() {
  const empresaId = await obterEmpresaAtiva();

  const [projetos, clientes, contratosDisponíveis] = await Promise.all([
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true } },
        tarefas: { select: { id: true, status: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contrato.findMany({
      where: {
        empresa_id: empresaId,
        status: "ASSINADO",
        projeto: { is: null },
      },
      select: {
        id: true,
        titulo: true,
        cliente_id: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { criado_em: "desc" },
    }),
  ]);

  return (
    <ProjetosClient
      projetos={projetos}
      clientes={clientes}
      contratos={contratosDisponíveis}
    />
  );
}
