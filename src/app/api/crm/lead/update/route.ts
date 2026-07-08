import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Conselho-Agro-Secret",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function PATCH(req: Request) {
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

  const { email, cpf, endereco, status } = body

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Campo 'email' obrigatório." }, { status: 422, headers: CORS_HEADERS })
  }

  // Busca lead mais recente por email na empresa
  const lead = await prisma.lead.findFirst({
    where: { empresa_id: empresaId, email },
    orderBy: { criado_em: "desc" },
    select: { id: true, observacoes: true },
  })

  if (!lead) {
    console.warn("[crm/lead/update] lead não encontrado para email:", email)
    return NextResponse.json({ ok: true, aviso: "Lead não encontrado." }, { headers: CORS_HEADERS })
  }

  // Monta observações adicionais com endereço
  const enderecoStr = endereco && typeof endereco === "object"
    ? Object.entries(endereco as Record<string, string>)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : null

  const obsExtra = [
    cpf ? `CPF: ${cpf}` : null,
    enderecoStr ? `Endereço: ${enderecoStr}` : null,
  ].filter(Boolean).join("\n")

  const novasObs = [lead.observacoes, obsExtra].filter(Boolean).join("\n")

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(status ? { etapa_chave: String(status) } : {}),
      ...(novasObs ? { observacoes: novasObs } : {}),
      ...(cpf ? { } : {}), // CPF fica nas observações por ora (Lead não tem campo cpf direto)
    },
  })

  // Atualiza CPF no Cliente vinculado, se existir
  if (cpf) {
    const leadCompleto = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { cliente_id: true },
    })
    if (leadCompleto?.cliente_id) {
      await prisma.cliente.update({
        where: { id: leadCompleto.cliente_id },
        data: { cpf_cnpj: String(cpf) },
      })
    }
  }

  console.log("[crm/lead/update] lead atualizado:", lead.id, "email:", email)
  return NextResponse.json({ ok: true, lead_id: lead.id }, { headers: CORS_HEADERS })
}
