import { NextResponse } from "next/server"
import { after } from "next/server"
import { prisma } from "@/lib/prisma"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Conselho-Agro-Secret",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  const secret = process.env.CONSELHO_AGRO_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get("x-conselho-agro-secret")
    if (!incoming || incoming !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: CORS_HEADERS })
    }
  }

  const empresaId = process.env.CONSELHO_AGRO_EMPRESA_ID
  if (!empresaId) {
    return NextResponse.json({ error: "Configuração ausente." }, { status: 500, headers: CORS_HEADERS })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400, headers: CORS_HEADERS })
  }

  const { email, produto, plano, valor, valor_original, cupom, desconto_pct, data_inicio } = body

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Campo 'email' obrigatório." }, { status: 422, headers: CORS_HEADERS })
  }

  // Busca cliente pelo email
  const cliente = await prisma.cliente.findFirst({
    where: { empresa_id: empresaId, email },
    select: { id: true, nome: true },
  })

  if (!cliente) {
    console.warn("[api/contratos] cliente não encontrado para email:", email)
    return NextResponse.json({ ok: true, aviso: "Cliente não encontrado, venda registrada sem vínculo." }, { headers: CORS_HEADERS })
  }

  const valorNum = typeof valor === "number" ? valor : parseFloat(String(valor ?? 0))
  const valorOrigNum = typeof valor_original === "number" ? valor_original : parseFloat(String(valor_original ?? valorNum))
  const dataInicio = data_inicio ? new Date(String(data_inicio)) : new Date()

  const tags = [
    "O Conselho Agro",
    plano === "anual" ? "Plano Anual" : "Plano Mensal",
    ...(cupom ? [`Cupom: ${cupom}`] : []),
  ]

  // Registra como Lead convertido com tags de cupom
  after(async () => {
    try {
      // Atualiza lead existente com tags de conversão
      const lead = await prisma.lead.findFirst({
        where: { empresa_id: empresaId, email },
        orderBy: { criado_em: "desc" },
        select: { id: true, tags: true, observacoes: true },
      })

      if (lead) {
        const obsVenda = [
          `✅ Venda realizada em ${dataInicio.toLocaleDateString("pt-BR")}`,
          `Produto: ${String(produto ?? "conselho_agro")}`,
          `Plano: ${String(plano ?? "anual")}`,
          `Valor: R$ ${valorNum.toFixed(2).replace(".", ",")}`,
          valorOrigNum !== valorNum
            ? `Valor original: R$ ${valorOrigNum.toFixed(2).replace(".", ",")} (${desconto_pct}% de desconto)`
            : null,
          cupom ? `Cupom: ${cupom}` : null,
        ].filter(Boolean).join("\n")

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            etapa_chave: "GANHO",
            tags: [...new Set([...lead.tags, ...tags])],
            observacoes: [lead.observacoes, obsVenda].filter(Boolean).join("\n\n"),
          },
        })

        // Incrementa uso do cupom
        if (cupom && typeof cupom === "string") {
          await prisma.campanhaCupom.updateMany({
            where: { empresa_id: empresaId, codigo: String(cupom).toUpperCase().trim() },
            data: { usos_count: { increment: 1 } },
          })
        }

        console.log("[api/contratos] venda registrada para lead:", lead.id, "email:", email, "cupom:", cupom ?? "—")
      }

      // Cria Recebíveis (Contas a Receber)
      const totalParcelas = plano === "anual" ? 12 : 1
      const valorParcela  = Math.round((valorNum / totalParcelas) * 100) / 100
      const descBase      = plano === "anual" ? "O Conselho Agro — Plano Anual" : "O Conselho Agro — Mensalidade"

      const recebiveis = Array.from({ length: totalParcelas }, (_, i) => {
        const venc = new Date(dataInicio)
        venc.setMonth(venc.getMonth() + i)
        return {
          empresa_id:      empresaId,
          cliente_id:      cliente.id,
          descricao:       totalParcelas > 1 ? `${descBase} — Parcela ${i + 1}/${totalParcelas}` : descBase,
          valor:           valorParcela,
          data_vencimento: venc,
          numero_parcela:  i + 1,
          total_parcelas:  totalParcelas,
          observacoes:     cupom ? `Cupom: ${cupom} (${desconto_pct}% de desconto)` : undefined,
        }
      })

      await prisma.recebivel.createMany({ data: recebiveis })
      console.log("[api/contratos] recebíveis criados:", recebiveis.length, "parcelas de R$", valorParcela)
    } catch (err) {
      console.error("[api/contratos] erro ao registrar venda:", err)
    }
  })

  return NextResponse.json({ ok: true, cliente_id: cliente.id }, { headers: CORS_HEADERS })
}
