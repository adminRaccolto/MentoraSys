import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { notFound } from "next/navigation";
import ProjetoDetalheClient from "./projeto-detalhe-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjetoDetalhePage({ params }: Props) {
  const { id } = await params;
  const empresaId = await obterEmpresaAtiva();

  const [projeto, membros] = await Promise.all([
    prisma.projeto.findUnique({
      where: { id, empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true, email: true } },
        contrato: { select: { id: true, titulo: true } },
        etapas: {
          orderBy: { ordem: "asc" },
          include: {
            tarefas: {
              orderBy: { criado_em: "asc" },
              include: {
                responsavel: { select: { id: true, nome: true } },
              },
            },
          },
        },
        documentos: {
          orderBy: { criado_em: "desc" },
          include: {
            criador: { select: { id: true, nome: true } },
          },
        },
      },
    }),
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId, ativo: true },
      include: { usuario: { select: { id: true, nome: true } } },
    }),
  ]);

  if (!projeto) notFound();

  return <ProjetoDetalheClient projeto={projeto} membros={membros} />;
}
