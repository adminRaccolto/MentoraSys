import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Retorna o serviço (preço) para um dado canal — usado pelo checkout do Conselho Agro
// Slug é o valor do campo `canal` do Servico: conselho_agro, arato, etc.
// Mapeamento: slug URL → campo `canal` no BD (uppercase)
const CANAL_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CANAL_HEADERS })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const canal = slug.toUpperCase() // conselho_agro → CONSELHO_AGRO

  const servico = await prisma.servico.findFirst({
    where: { canal, ativo: true },
    select: {
      id: true,
      nome: true,
      canal: true,
      plano: true,
      tipo_cobranca: true,
      valor_base: true,
      descricao: true,
    },
    orderBy: { criado_em: "asc" },
  })

  if (!servico) {
    console.warn("[api/produtos] serviço não encontrado para canal:", canal)
    return NextResponse.json(
      { error: "Serviço não encontrado." },
      { status: 404, headers: CANAL_HEADERS }
    )
  }

  console.log("[api/produtos] retornando preço para canal:", canal, "valor:", servico.valor_base?.toString())

  return NextResponse.json(
    {
      slug,
      nome: servico.nome,
      canal: servico.canal,
      plano: servico.plano,
      tipo_cobranca: servico.tipo_cobranca,
      // valor_base é o valor anual (como cadastrado em Serviços)
      valor_anual: servico.valor_base != null ? Number(servico.valor_base) : null,
      valor_mensal: null, // não usado por enquanto
      descricao: servico.descricao,
    },
    { headers: CANAL_HEADERS }
  )
}
