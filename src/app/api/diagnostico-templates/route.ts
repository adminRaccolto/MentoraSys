import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple API key auth — callers must send X-Template-Secret matching env var
const SECRET = process.env.CONSELHO_AGRO_WEBHOOK_SECRET;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Conselho-Agro-Secret",
};

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: CORS });
}

function checkAuth(req: Request): boolean {
  if (!SECRET) return true; // dev: no secret configured, allow all
  return req.headers.get("x-conselho-agro-secret") === SECRET;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET /api/diagnostico-templates?empresa_id=xxx[&cultura=soja][&nivel=BOM]
export async function GET(req: Request) {
  if (!checkAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const empresa_id = searchParams.get("empresa_id");
  const cultura = searchParams.get("cultura");
  const nivel = searchParams.get("nivel");

  if (!empresa_id) {
    return NextResponse.json({ error: "empresa_id obrigatório." }, { status: 400, headers: CORS });
  }

  const templates = await prisma.diagnosticoTemplate.findMany({
    where: {
      empresa_id,
      ...(cultura ? { cultura } : {}),
      ...(nivel ? { nivel } : {}),
    },
    orderBy: [{ cultura: "asc" }, { nivel: "asc" }],
  });

  return NextResponse.json(templates, { headers: CORS });
}

// POST /api/diagnostico-templates — upsert by empresa_id + cultura + nivel
export async function POST(req: Request) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const {
    empresa_id,
    cultura,
    nivel,
    titulo,
    texto_receita,
    texto_custos,
    texto_caixa,
    texto_recomendacoes,
    parametros_dre,
  } = body;

  if (!empresa_id || !cultura || !nivel) {
    return NextResponse.json(
      { error: "empresa_id, cultura e nivel são obrigatórios." },
      { status: 400, headers: CORS },
    );
  }

  const template = await prisma.diagnosticoTemplate.upsert({
    where: { empresa_id_cultura_nivel: { empresa_id, cultura, nivel } },
    create: {
      empresa_id,
      cultura,
      nivel,
      titulo,
      texto_receita,
      texto_custos,
      texto_caixa,
      texto_recomendacoes,
      parametros_dre: parametros_dre ?? {},
    },
    update: {
      titulo,
      texto_receita,
      texto_custos,
      texto_caixa,
      texto_recomendacoes,
      parametros_dre: parametros_dre ?? {},
    },
  });

  return NextResponse.json(template, { status: 200, headers: CORS });
}

// DELETE /api/diagnostico-templates?empresa_id=xxx&cultura=soja&nivel=BOM
export async function DELETE(req: Request) {
  if (!checkAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const empresa_id = searchParams.get("empresa_id");
  const cultura = searchParams.get("cultura");
  const nivel = searchParams.get("nivel");

  if (!empresa_id || !cultura || !nivel) {
    return NextResponse.json(
      { error: "empresa_id, cultura e nivel são obrigatórios." },
      { status: 400, headers: CORS },
    );
  }

  await prisma.diagnosticoTemplate.delete({
    where: { empresa_id_cultura_nivel: { empresa_id, cultura, nivel } },
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
