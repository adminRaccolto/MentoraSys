import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import CrmClient from "./crm-client";

export default async function CrmPage() {
  const empresaId = await obterEmpresaAtiva();

  const [leads, clientes, membros] = await Promise.all([
    prisma.lead.findMany({
      where: { empresa_id: empresaId },
      include: { cliente: { select: { id: true, nome: true } } },
      orderBy: { criado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId, ativo: true },
      include: { usuario: { select: { id: true, nome: true } } },
    }),
  ]);

  return <CrmClient leads={leads} clientes={clientes} membros={membros} />;
}
