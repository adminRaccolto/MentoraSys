import { prisma } from "@/lib/prisma"
import { obterEmpresaAtiva } from "@/lib/permissoes"
import CampanhasCupomClient from "./campanhas-cupom-client"

export const metadata = { title: "Cupons de Desconto" }

export default async function CampanhasCupomPage() {
  const empresaId = await obterEmpresaAtiva()

  const [cupons, servicos] = await Promise.all([
    prisma.campanhaCupom.findMany({
      where: { empresa_id: empresaId },
      include: { servico: { select: { id: true, nome: true, canal: true } } },
      orderBy: { criado_em: "desc" },
    }),
    prisma.servico.findMany({
      where: { empresa_id: empresaId, ativo: true },
      select: { id: true, nome: true, canal: true },
      orderBy: { nome: "asc" },
    }),
  ])

  return (
    <CampanhasCupomClient
      cupons={cupons.map((c) => ({
        ...c,
        valor_desconto: Number(c.valor_desconto),
        validade_ate: c.validade_ate?.toISOString() ?? null,
        criado_em: c.criado_em.toISOString(),
        atualizado_em: c.atualizado_em.toISOString(),
      }))}
      servicos={servicos}
    />
  )
}
