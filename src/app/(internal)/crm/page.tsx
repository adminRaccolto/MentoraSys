import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { listarEtapas } from "@/actions/crm";
import CrmClient from "./crm-client";

export default async function CrmPage() {
  const empresaId = await obterEmpresaAtiva();

  const [etapas, leads, clientes, servicos, membros] = await Promise.all([
    listarEtapas(),
    prisma.lead.findMany({
      where: { empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        servico: { select: { id: true, nome: true } },
        comentarios: { orderBy: { criado_em: "asc" } },
      },
      orderBy: { criado_em: "desc" },
    }),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.servico.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, canal: true, plano: true, valor_base: true },
      orderBy: { nome: "asc" },
    }),
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId, ativo: true },
      include: { usuario: { select: { id: true, nome: true } } },
    }),
  ]);

  const usuarios = membros.map((m) => ({ id: m.usuario.id, nome: m.usuario.nome }));

  return (
    <CrmClient
      etapasIniciais={etapas}
      leadsIniciais={leads.map((l) => ({
        ...l,
        criado_em: l.criado_em.toISOString(),
        atualizado_em: l.atualizado_em.toISOString(),
        valor_estimado: l.valor_estimado ? Number(l.valor_estimado) : null,
        previsao_fechamento: l.previsao_fechamento?.toISOString() ?? null,
        data_proxima_acao: l.data_proxima_acao?.toISOString() ?? null,
        comentarios: l.comentarios.map((c) => ({ ...c, criado_em: c.criado_em.toISOString() })),
      }))}
      clientes={clientes}
      servicos={servicos.map((s) => ({ ...s, valor_base: s.valor_base ? Number(s.valor_base) : null }))}
      usuarios={usuarios}
    />
  );
}
