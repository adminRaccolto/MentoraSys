import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjetoDetalheClient from "./projeto-detalhe-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjetoDetalhePage({ params }: Props) {
  const { id } = await params;
  const empresaId = await obterEmpresaAtiva();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [projeto, membros, diagnosticosColeta] = await Promise.all([
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
    prisma.aplicacaoDiagnostico.findMany({
      where: { projeto_id: id, empresa_id: empresaId },
      orderBy: { momento: "asc" },
    }),
  ]);

  if (!projeto) notFound();

  return (
    <ProjetoDetalheClient
      projeto={projeto}
      membros={membros}
      usuarioAtualId={user?.id}
      diagnosticosColeta={diagnosticosColeta}
    />
  );
}
