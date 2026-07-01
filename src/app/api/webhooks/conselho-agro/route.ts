import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

// Recebe leads do site oconselhoagro.com.br/diagnostico
// Variáveis de ambiente necessárias no Vercel:
//   CONSELHO_AGRO_WEBHOOK_SECRET  — segredo compartilhado (header X-Conselho-Agro-Secret)
//   CONSELHO_AGRO_EMPRESA_ID      — ID da empresa no MentoraSys

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://oconselhoagro.com.br",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Conselho-Agro-Secret",
};

// Preflight CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.CONSELHO_AGRO_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-conselho-agro-secret");
    if (!incoming || incoming !== secret) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401, headers: CORS_HEADERS }
      );
    }
  }

  const empresaId = process.env.CONSELHO_AGRO_EMPRESA_ID;
  if (!empresaId) {
    console.error("[conselho-agro] CONSELHO_AGRO_EMPRESA_ID não configurado");
    return NextResponse.json(
      { error: "Configuração ausente no servidor." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // ── Payload ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Payload JSON inválido." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const {
    nome,
    email,
    telefone,
    whatsapp,
    cpf_cnpj,
    origem,
    observacoes,
    tags,
    // Campos opcionais do diagnóstico
    pontuacao,       // número (ex: 72)
    pontuacao_max,   // número (ex: 100)
    nivel,           // string (ex: "Intermediário")
    respostas,       // objeto { modulo: { obtido, maximo, label } }
  } = body;

  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    return NextResponse.json(
      { error: "Campo 'nome' obrigatório (mínimo 2 caracteres)." },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  // ── Busca primeira etapa do CRM ─────────────────────────────────────────
  const etapaPadrao = await prisma.etapaCrm.findFirst({
    where: { empresa_id: empresaId },
    orderBy: { ordem: "asc" },
  });

  // ── Monta observação com diagnóstico se vier ─────────────────────────────
  let obsCompleta = observacoes ? String(observacoes) : "";
  if (pontuacao !== undefined && pontuacao_max !== undefined) {
    const pct = Math.round((Number(pontuacao) / Number(pontuacao_max)) * 100);
    const nivelStr = nivel ? ` — ${nivel}` : "";
    obsCompleta = [
      obsCompleta,
      `Diagnóstico: ${pct}%${nivelStr} (${pontuacao}/${pontuacao_max})`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // ── Cria lead no CRM ─────────────────────────────────────────────────────
  const lead = await prisma.lead.create({
    data: {
      empresa_id: empresaId,
      nome: nome.trim(),
      contato_nome: nome.trim(),
      empresa_nome: nome.trim(),
      email: email ? String(email) : null,
      telefone: telefone ? String(telefone) : null,
      whatsapp: whatsapp ? String(whatsapp) : (telefone ? String(telefone) : null),
      origem: origem ? String(origem) : "oconselhoagro.com.br",
      observacoes: obsCompleta || null,
      tags: Array.isArray(tags) ? (tags as string[]) : ["O Conselho Agro", "Diagnóstico"],
      etapa_chave: etapaPadrao?.chave ?? "NOVO",
      etapa_id: etapaPadrao?.id ?? null,
      probabilidade: 20,
    },
  });

  // ── Salva diagnóstico em background (não bloqueia a resposta) ─────────────
  if (respostas && typeof respostas === "object") {
    after(async () => {
      try {
        await prisma.diagnostico.create({
          data: {
            empresa_id: empresaId,
            titulo: `Diagnóstico — ${nome.trim()}`,
            tipo: "CINCO_W_DOIS_H",
            conteudo: JSON.parse(JSON.stringify({
              origem: "oconselhoagro.com.br",
              lead_id: lead.id,
              pontuacao,
              pontuacao_max,
              nivel,
              respostas,
            })),
          },
        });
      } catch (err) {
        console.error("[conselho-agro] erro ao salvar diagnóstico:", err);
      }
    });
  }

  console.log("[conselho-agro] lead criado:", lead.id, "— nome:", nome);
  return NextResponse.json(
    { ok: true, lead_id: lead.id },
    { status: 201, headers: CORS_HEADERS }
  );
}
