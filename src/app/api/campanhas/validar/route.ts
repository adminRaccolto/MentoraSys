import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400, headers: CORS_HEADERS })
  }

  const { codigo, canal } = body

  if (!codigo || typeof codigo !== "string") {
    return NextResponse.json({ valido: false, mensagem: "Código obrigatório." }, { headers: CORS_HEADERS })
  }

  const codigoNorm = codigo.toUpperCase().trim()

  // Busca o serviço pelo canal (ex: "CONSELHO_AGRO") para restringir cupons ao produto
  let servicoId: string | undefined
  if (canal && typeof canal === "string") {
    const servico = await prisma.servico.findFirst({
      where: { canal: canal.toUpperCase(), ativo: true },
      select: { id: true },
    })
    if (servico) servicoId = servico.id
  }

  // Cupom válido para o serviço específico OU global (servico_id null)
  const cupom = await prisma.campanhaCupom.findFirst({
    where: {
      codigo: codigoNorm,
      ativo: true,
      OR: [
        ...(servicoId ? [{ servico_id: servicoId }] : []),
        { servico_id: null },
      ],
    },
  })

  if (!cupom) {
    console.log("[campanhas/validar] cupom não encontrado:", codigoNorm)
    return NextResponse.json({ valido: false, mensagem: "Cupom inválido ou inativo." }, { headers: CORS_HEADERS })
  }

  if (cupom.validade_ate && cupom.validade_ate < new Date()) {
    return NextResponse.json({ valido: false, mensagem: "Cupom expirado." }, { headers: CORS_HEADERS })
  }

  if (cupom.usos_maximos != null && cupom.usos_count >= cupom.usos_maximos) {
    return NextResponse.json({ valido: false, mensagem: "Cupom esgotado." }, { headers: CORS_HEADERS })
  }

  console.log("[campanhas/validar] cupom válido:", codigoNorm, cupom.tipo_desconto, cupom.valor_desconto.toString())

  const valorDesc = Number(cupom.valor_desconto)
  return NextResponse.json(
    {
      valido: true,
      codigo: cupom.codigo,
      nome: cupom.nome,
      tipo_desconto: cupom.tipo_desconto,
      desconto_pct:   cupom.tipo_desconto === "PERCENTUAL" ? valorDesc : 0,
      desconto_fixo:  cupom.tipo_desconto === "FIXO"       ? valorDesc : 0,
      mensagem:
        cupom.tipo_desconto === "PERCENTUAL"
          ? `${valorDesc}% de desconto aplicado`
          : `R$ ${valorDesc.toFixed(2).replace(".", ",")} de desconto aplicado`,
    },
    { headers: CORS_HEADERS }
  )
}
