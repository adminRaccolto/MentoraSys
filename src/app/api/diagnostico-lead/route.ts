import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularDiagnostico } from "@/lib/diagnostico-agro";
import { enviarDiagnosticoAgro } from "@/lib/email";
import { asaasGetOrCreateCustomer } from "@/lib/asaas";

// Recebe o diagnóstico completo do site oconselhoagro.com.br
// Migrado do módulo diagnostico-lead do raccolto-starter (NestJS)
// OTP/validação desabilitado por ora — será adicionado via WhatsApp (Evolution API)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://oconselhoagro.com.br",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Conselho-Agro-Secret",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CONSELHO_AGRO_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-conselho-agro-secret");
    if (!incoming || incoming !== secret) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401, headers: CORS_HEADERS },
      );
    }
  }

  const empresaId = process.env.CONSELHO_AGRO_EMPRESA_ID;
  if (!empresaId) {
    console.error("[diagnostico-lead] CONSELHO_AGRO_EMPRESA_ID não configurado");
    return NextResponse.json(
      { error: "Configuração ausente no servidor." },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Payload JSON inválido." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { nome, email, telefone, cpfCnpj, canal, produto, ...diagnosticoFields } = body;

  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    return NextResponse.json(
      { error: "Campo 'nome' obrigatório." },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  const score = calcularDiagnostico(diagnosticoFields as Record<string, unknown>);

  const nivelLabel =
    score.geral.nivel === "CRITICO"
      ? "Crítico"
      : score.geral.nivel === "ATENCAO"
        ? "Atenção"
        : score.geral.nivel === "BOM"
          ? "Bom"
          : "Excelente";

  const obsLines = [
    cpfCnpj ? `CPF/CNPJ: ${cpfCnpj}` : null,
    `Diagnóstico: ${score.geral.percentual}% — ${nivelLabel}`,
    [
      `Operação: ${score.bloco1.percentual}%`,
      `Custos: ${score.bloco2.percentual}%`,
      `Financeiro: ${score.bloco3.percentual}%`,
      `Gestão: ${score.bloco4.percentual}%`,
    ].join(" | "),
  ]
    .filter(Boolean)
    .join("\n");

  // ── Primeira etapa CRM ────────────────────────────────────────────────────
  const etapaPadrao = await prisma.etapaCrm.findFirst({
    where: { empresa_id: empresaId },
    orderBy: { ordem: "asc" },
  });

  // ── Cria lead ─────────────────────────────────────────────────────────────
  const lead = await prisma.lead.create({
    data: {
      empresa_id: empresaId,
      nome: nome.trim(),
      contato_nome: nome.trim(),
      empresa_nome: nome.trim(),
      email: email ? String(email) : null,
      telefone: telefone ? String(telefone) : null,
      whatsapp: telefone ? String(telefone) : null,
      origem: "oconselhoagro.com.br",
      observacoes: obsLines,
      tags: ["O Conselho Agro", "Diagnóstico"],
      etapa_chave: etapaPadrao?.chave ?? "NOVO",
      etapa_id: etapaPadrao?.id ?? null,
      probabilidade: 20,
    },
  });

  console.log(
    "[diagnostico-lead] lead criado:",
    lead.id,
    "— score:",
    score.geral.percentual + "%",
    score.geral.nivel,
  );

  // ── Salva respostas + cria cliente + envia email em background ───────────
  after(async () => {
    // Persiste respostas no modelo Diagnostico
    try {
      await prisma.diagnostico.create({
        data: {
          empresa_id: empresaId,
          titulo: `Diagnóstico — ${nome.trim()}`,
          tipo: "CINCO_W_DOIS_H",
          conteudo: JSON.parse(
            JSON.stringify({
              origem: "oconselhoagro.com.br",
              lead_id: lead.id,
              score,
              respostas: diagnosticoFields,
            }),
          ),
        },
      });
    } catch (err) {
      console.error("[diagnostico-lead] erro ao salvar diagnóstico:", err);
    }

    // Se veio de página de produto (canal definido) → criar Cliente + sincronizar Asaas
    if (canal && typeof canal === "string") {
      try {
        // Verifica se já existe cliente com mesmo email/CPF na empresa
        const emailStr = email ? String(email) : undefined;
        const cpfStr = cpfCnpj ? String(cpfCnpj) : undefined;

        let clienteExistente = null;
        if (emailStr) {
          clienteExistente = await prisma.cliente.findFirst({
            where: { empresa_id: empresaId, email: emailStr },
          });
        }
        if (!clienteExistente && cpfStr) {
          clienteExistente = await prisma.cliente.findFirst({
            where: { empresa_id: empresaId, cpf_cnpj: cpfStr },
          });
        }

        let clienteId: string;
        if (clienteExistente) {
          clienteId = clienteExistente.id;
          console.log("[diagnostico-lead] cliente já existe:", clienteId);
        } else {
          const novoCliente = await prisma.cliente.create({
            data: {
              empresa_id: empresaId,
              nome: nome.trim(),
              tipo: "PESSOA_FISICA",
              email: emailStr ?? null,
              telefone: telefone ? String(telefone) : null,
              whatsapp: telefone ? String(telefone) : null,
              cpf_cnpj: cpfStr ?? null,
            },
          });
          clienteId = novoCliente.id;
          console.log("[diagnostico-lead] cliente criado:", clienteId, "canal:", canal);
        }

        // Vincula o lead ao cliente
        await prisma.lead.update({
          where: { id: lead.id },
          data: { cliente_id: clienteId },
        });

        // Sync Asaas
        try {
          const customer = await asaasGetOrCreateCustomer(
            nome.trim(),
            cpfStr,
            emailStr,
          );
          await prisma.cliente.update({
            where: { id: clienteId },
            data: { asaas_id: customer.id },
          });
          console.log("[diagnostico-lead] Asaas customer:", customer.id);
        } catch (asaasErr) {
          console.error("[diagnostico-lead] erro Asaas:", asaasErr);
        }
      } catch (err) {
        console.error("[diagnostico-lead] erro ao criar cliente:", err);
      }
    }

    // Envia email com resultado
    if (email && typeof email === "string") {
      try {
        const primeiroNome = nome.trim().split(" ")[0];
        await enviarDiagnosticoAgro(email, primeiroNome, score);
      } catch (err) {
        console.error("[diagnostico-lead] erro ao enviar email:", err);
      }
    }
  });

  return NextResponse.json(
    { ok: true, lead_id: lead.id, score },
    { status: 201, headers: CORS_HEADERS },
  );
}
