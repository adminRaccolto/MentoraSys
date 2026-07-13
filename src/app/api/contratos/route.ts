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

  const {
    email, produto, plano, valor, valor_original, cupom, desconto_pct, data_inicio,
    nome, cpf, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
    asaas_customer_id, asaas_subscription_id,
  } = body

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Campo 'email' obrigatório." }, { status: 422, headers: CORS_HEADERS })
  }

  // Upsert cliente: cria como PESSOA_FISICA se ainda não existir
  let cliente = await prisma.cliente.findFirst({
    where: { empresa_id: empresaId, email },
    select: { id: true, nome: true },
  })

  if (!cliente) {
    const nomeCliente = typeof nome === "string" && nome.trim()
      ? nome.trim()
      : (email as string).split("@")[0]

    cliente = await prisma.cliente.create({
      data: {
        empresa_id:  empresaId,
        nome:        nomeCliente,
        tipo:        "PESSOA_FISICA",
        email:       email as string,
        cpf_cnpj:    typeof cpf === "string" ? cpf.replace(/\D/g, "") : null,
        telefone:    typeof telefone === "string" ? telefone : null,
        cep:         typeof cep === "string" ? cep.replace(/\D/g, "") : null,
        logradouro:  typeof logradouro === "string" ? logradouro : null,
        numero:      typeof numero === "string" ? numero : null,
        complemento: typeof complemento === "string" ? complemento : null,
        bairro:      typeof bairro === "string" ? bairro : null,
        cidade:      typeof cidade === "string" ? cidade : null,
        estado:      typeof estado === "string" ? estado : null,
        asaas_id:    typeof asaas_customer_id === "string" ? asaas_customer_id : null,
      },
      select: { id: true, nome: true },
    })
    console.log("[api/contratos] cliente criado:", cliente.id, "email:", email)
  } else if (typeof asaas_customer_id === "string" && asaas_customer_id) {
    // Garante que o asaas_id está preenchido mesmo em clientes já existentes
    await prisma.cliente.updateMany({
      where: { id: cliente.id, asaas_id: null },
      data: { asaas_id: asaas_customer_id },
    })
  }

  const valorNum = typeof valor === "number" ? valor : parseFloat(String(valor ?? 0))
  const valorOrigNum = typeof valor_original === "number" ? valor_original : parseFloat(String(valor_original ?? valorNum))
  const dataInicio = data_inicio ? new Date(String(data_inicio)) : new Date()

  const tags = [
    "O Conselho Agro",
    plano === "anual" ? "Plano Anual" : "Plano Mensal",
    ...(cupom ? [`Cupom: ${cupom}`] : []),
  ]

  // Registra Lead convertido + cria Assinatura para segmentação
  after(async () => {
    try {
      // 1. Move lead para GANHO com tags e observação de venda
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
            cliente_id:  cliente.id,
            tags: [...new Set([...lead.tags, ...tags])],
            observacoes: [lead.observacoes, obsVenda].filter(Boolean).join("\n\n"),
          },
        })

        if (cupom && typeof cupom === "string") {
          await prisma.campanhaCupom.updateMany({
            where: { empresa_id: empresaId, codigo: String(cupom).toUpperCase().trim() },
            data: { usos_count: { increment: 1 } },
          })
        }

        console.log("[api/contratos] lead convertido:", lead.id, "email:", email)
      }

      // 2. Cria Assinatura local para segmentação O Conselho Agro / Novo Agro
      //    (os Recebíveis são criados pelo sync do Asaas com os IDs reais de pagamento)
      const assinaturaExistente = await prisma.assinatura.findFirst({
        where: { empresa_id: empresaId, email_cliente: email as string, canal: "CONSELHO_AGRO" },
        select: { id: true },
      })

      if (!assinaturaExistente) {
        await prisma.assinatura.create({
          data: {
            empresa_id:            empresaId,
            cliente_id:            cliente.id,
            nome_cliente:          cliente.nome,
            email_cliente:         email as string,
            canal:                 "CONSELHO_AGRO",
            plano:                 "NOVO_AGRO",
            valor:                 valorNum,
            ciclo:                 plano === "anual" ? "YEARLY" : "MONTHLY",
            status:                "ATIVA",
            asaas_customer_id:     typeof asaas_customer_id === "string" ? asaas_customer_id : null,
            asaas_subscription_id: typeof asaas_subscription_id === "string" ? asaas_subscription_id : null,
            proximo_vencimento:    dataInicio,
          },
        })
        console.log("[api/contratos] assinatura CONSELHO_AGRO criada para:", email)
      }
    } catch (err) {
      console.error("[api/contratos] erro ao registrar venda:", err)
    }
  })

  return NextResponse.json({ ok: true, cliente_id: cliente.id }, { headers: CORS_HEADERS })
}
