import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import AgendaClient from "./agenda-client";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}) {
  const empresaId = await obterEmpresaAtiva();
  const params = await searchParams;

  const hoje = new Date();
  const mes = params.mes ? parseInt(params.mes) : hoje.getMonth();
  const ano = params.ano ? parseInt(params.ano) : hoje.getFullYear();

  const inicio = new Date(ano, mes, 1);
  const fim = new Date(ano, mes + 1, 0, 23, 59, 59);

  const [eventos, clientes, contratos, projetos, usuarios] = await Promise.all([
    prisma.evento.findMany({
      where: { empresa_id: empresaId, inicio: { gte: inicio, lte: fim } },
      include: {
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, titulo: true } },
        projeto: { select: { id: true, titulo: true } },
        responsavel: { select: { id: true, nome: true } },
      },
      orderBy: { inicio: "asc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, titulo: true },
      orderBy: { titulo: "asc" },
    }),
    prisma.usuario.findMany({
      where: { membros: { some: { empresa_id: empresaId, ativo: true } } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <AgendaClient
      eventos={eventos.map((e) => ({
        ...e,
        inicio: e.inicio.toISOString(),
        fim: e.fim?.toISOString() ?? null,
        lembrete_em: e.lembrete_em?.toISOString() ?? null,
        criado_em: e.criado_em.toISOString(),
        atualizado_em: e.atualizado_em.toISOString(),
      }))}
      clientes={clientes}
      contratos={contratos}
      projetos={projetos}
      usuarios={usuarios}
      mes={mes}
      ano={ano}
    />
  );
}
