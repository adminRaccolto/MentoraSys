import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import PropostasClient from "./propostas-client";

export default async function PropostasPage() {
  const empresaId = await obterEmpresaAtiva();

  const [propostas, clientes, servicos, leads, modelosProposta, usuarios] = await Promise.all([
    prisma.proposta.findMany({
      where: { empresa_id: empresaId },
      include: {
        cliente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        itens: true,
      },
      orderBy: { criado_em: "desc" },
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        valor_total: Number(r.valor_total),
        itens: r.itens.map((item) => ({
          ...item,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto),
        })),
      }))
    ),
    prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO" },
      select: { id: true, nome: true, contato_principal: true, email: true, telefone: true },
      orderBy: { nome: "asc" },
    }),
    prisma.servico.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, valor_base: true },
      orderBy: { nome: "asc" },
    }),
    prisma.lead.findMany({
      where: { empresa_id: empresaId },
      select: { id: true, nome: true, empresa_nome: true },
      orderBy: { criado_em: "desc" },
    }),
    prisma.modeloDocumento.findMany({
      where: { empresa_id: empresaId, tipo: "PROPOSTA", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { usuario: { select: { id: true, nome: true } } },
      orderBy: { usuario: { nome: "asc" } },
    }),
  ]);

  return (
    <PropostasClient
      propostas={propostas}
      clientes={clientes}
      servicos={servicos.map((s) => ({ ...s, valor_base: Number(s.valor_base) }))}
      leads={leads}
      modelosProposta={modelosProposta}
      usuarios={usuarios.map((m) => m.usuario)}
    />
  );
}
