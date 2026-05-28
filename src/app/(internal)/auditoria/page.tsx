import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import AuditoriaClient from "./auditoria-client";

const PAGE_SIZE = 50;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    recurso?: string;
    usuario_id?: string;
    data_inicio?: string;
    data_fim?: string;
    pagina?: string;
  }>;
}) {
  const empresaId = await obterEmpresaAtiva();
  const params = await searchParams;

  const pagina = params.pagina ? parseInt(params.pagina) : 1;
  const skip = (pagina - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = { empresa_id: empresaId };
  if (params.recurso) where.recurso = params.recurso;
  if (params.usuario_id) where.usuario_id = params.usuario_id;
  if (params.data_inicio || params.data_fim) {
    where.criado_em = {
      ...(params.data_inicio ? { gte: new Date(params.data_inicio) } : {}),
      ...(params.data_fim ? { lte: new Date(params.data_fim + "T23:59:59") } : {}),
    };
  }

  const [registros, total, usuarios] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where,
      orderBy: { criado_em: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.registroAuditoria.count({ where }),
    prisma.usuario.findMany({
      where: { membros: { some: { empresa_id: empresaId, ativo: true } } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <AuditoriaClient
      registros={registros.map((r) => ({
        ...r,
        criado_em: r.criado_em.toISOString(),
        detalhes: r.detalhes as Record<string, unknown> | null,
      }))}
      total={total}
      pagina={pagina}
      pageSize={PAGE_SIZE}
      usuarios={usuarios}
      filtros={{
        recurso: params.recurso ?? "",
        usuario_id: params.usuario_id ?? "",
        data_inicio: params.data_inicio ?? "",
        data_fim: params.data_fim ?? "",
      }}
    />
  );
}
