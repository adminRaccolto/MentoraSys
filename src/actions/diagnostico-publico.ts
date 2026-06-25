"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { enviarSms, gerarOtp } from "@/lib/sms";
import { PERGUNTAS, calcularPontuacao, gerarRecomendacoes } from "@/lib/diagnostico-perguntas";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const schemaEtapa1 = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido"),
  celular: z.string().min(10, "Celular inválido"),
  email: z.string().email("E-mail inválido"),
});

const schemaOtp = z.object({
  participanteId: z.string(),
  codigo: z.string().length(6, "Código deve ter 6 dígitos"),
});

// ─── Carregar campanha ────────────────────────────────────────────────────────

export async function carregarCampanha(slug: string) {
  const campanha = await prisma.campanhaDiagnostico.findUnique({
    where: { slug, ativo: true },
    select: {
      id: true,
      titulo: true,
      subtitulo: true,
      video_youtube: true,
      url_checkout: true,
      empresa_id: true,
    },
  });
  return campanha;
}

// ─── Etapa 1: Cadastro básico + envio OTP ────────────────────────────────────

export async function iniciarDiagnostico(
  campanhaId: string,
  empresaId: string,
  input: z.infer<typeof schemaEtapa1>
) {
  const data = schemaEtapa1.parse(input);

  const otp = gerarOtp();
  const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Upsert: mesmo celular na mesma campanha reutiliza o registro
  const existente = await prisma.diagnosticoParticipante.findFirst({
    where: { campanha_id: campanhaId, celular: data.celular },
  });

  let participante;
  if (existente) {
    participante = await prisma.diagnosticoParticipante.update({
      where: { id: existente.id },
      data: {
        nome: data.nome,
        cpf_cnpj: data.cpf_cnpj,
        email: data.email,
        otp_code: otp,
        otp_expira_em: expira,
        celular_verificado: false,
      },
    });
  } else {
    participante = await prisma.diagnosticoParticipante.create({
      data: {
        campanha_id: campanhaId,
        nome: data.nome,
        cpf_cnpj: data.cpf_cnpj,
        celular: data.celular,
        email: data.email,
        otp_code: otp,
        otp_expira_em: expira,
      },
    });
  }

  await enviarSms(
    data.celular,
    `Seu código de verificação é: ${otp}. Válido por 10 minutos.`
  );

  return { participanteId: participante.id };
}

// ─── Etapa 2: Verificar OTP ───────────────────────────────────────────────────

export async function verificarOtp(input: z.infer<typeof schemaOtp>) {
  const { participanteId, codigo } = schemaOtp.parse(input);

  const p = await prisma.diagnosticoParticipante.findUnique({
    where: { id: participanteId },
  });

  if (!p) throw new Error("Participante não encontrado");
  if (p.celular_verificado) return { ok: true };
  if (!p.otp_code || p.otp_code !== codigo) throw new Error("Código inválido");
  if (p.otp_expira_em && p.otp_expira_em < new Date()) throw new Error("Código expirado");

  await prisma.diagnosticoParticipante.update({
    where: { id: participanteId },
    data: { celular_verificado: true, otp_code: null },
  });

  return { ok: true };
}

// ─── Etapa 3: Salvar respostas + criar Lead + enviar e-mail ──────────────────

export async function finalizarDiagnostico(
  participanteId: string,
  empresaId: string,
  respostas: Record<string, number>
) {
  const p = await prisma.diagnosticoParticipante.findUnique({
    where: { id: participanteId },
    include: { campanha: true },
  });

  if (!p) throw new Error("Participante não encontrado");
  if (!p.celular_verificado) throw new Error("Celular não verificado");

  const pontuacao = calcularPontuacao(respostas);
  const recomendacoes = gerarRecomendacoes(pontuacao, respostas);

  // Cria ou recupera lead no CRM
  let leadId = p.lead_id;
  if (!leadId) {
    const etapaPadrao = await prisma.etapaCrm.findFirst({
      where: { empresa_id: empresaId },
      orderBy: { ordem: "asc" },
    });

    const lead = await prisma.lead.create({
      data: {
        empresa_id: empresaId,
        nome: `${p.nome} — Diagnóstico`,
        empresa_nome: p.nome,
        contato_nome: p.nome,
        email: p.email,
        telefone: p.celular,
        whatsapp: p.celular,
        etapa_chave: etapaPadrao?.chave ?? "NOVO",
        etapa_id: etapaPadrao?.id ?? null,
        origem: "Diagnóstico Online",
        tags: ["O Conselho Agro"],
      },
    });
    leadId = lead.id;
  }

  await prisma.diagnosticoParticipante.update({
    where: { id: participanteId },
    data: { respostas, pontuacao: pontuacao.total, lead_id: leadId },
  });

  // Envia e-mail com o diagnóstico
  if (!p.email_enviado) {
    await enviarEmailDiagnostico(p.nome, p.email, pontuacao, recomendacoes);
    await prisma.diagnosticoParticipante.update({
      where: { id: participanteId },
      data: { email_enviado: true },
    });
  }

  return {
    pontuacao,
    recomendacoes,
    videoYoutube: p.campanha.video_youtube,
    urlCheckout: p.campanha.url_checkout,
  };
}

// ─── Reenviar OTP ─────────────────────────────────────────────────────────────

export async function reenviarOtp(participanteId: string) {
  const p = await prisma.diagnosticoParticipante.findUnique({ where: { id: participanteId } });
  if (!p) throw new Error("Participante não encontrado");

  const otp = gerarOtp();
  const expira = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.diagnosticoParticipante.update({
    where: { id: participanteId },
    data: { otp_code: otp, otp_expira_em: expira },
  });

  await enviarSms(p.celular, `Seu novo código de verificação é: ${otp}. Válido por 10 minutos.`);
  return { ok: true };
}

// ─── E-mail de diagnóstico ───────────────────────────────────────────────────

async function enviarEmailDiagnostico(
  nome: string,
  email: string,
  pontuacao: { total: number; maximo: number; modulos: Record<string, { obtido: number; maximo: number; label: string }> },
  recomendacoes: string[]
) {
  const percentual = Math.round((pontuacao.total / pontuacao.maximo) * 100);
  const nivel = percentual >= 75 ? "Avançado" : percentual >= 50 ? "Intermediário" : "Iniciante";
  const corNivel = percentual >= 75 ? "#22c55e" : percentual >= 50 ? "#f59e0b" : "#ef4444";

  const modulosHtml = Object.values(pontuacao.modulos).map((m) => {
    const pct = Math.round((m.obtido / m.maximo) * 100);
    return `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#374151;">${m.label}</td>
        <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#1B4F72;">${pct}%</td>
      </tr>
      <tr>
        <td colspan="2" style="padding-bottom:12px;">
          <div style="background:#e5e7eb;border-radius:4px;height:8px;">
            <div style="background:#1B4F72;border-radius:4px;height:8px;width:${pct}%;"></div>
          </div>
        </td>
      </tr>`;
  }).join("");

  const recsHtml = recomendacoes.map((r) => `<li style="margin-bottom:8px;color:#374151;">${r}</li>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1B4F72;padding:32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;">Diagnóstico Empresarial</h1>
          <p style="color:#AED6F1;margin:8px 0 0;">O Conselho Agro</p>
        </td></tr>

        <!-- Saudação -->
        <tr><td style="padding:32px 32px 0;">
          <p style="font-size:16px;color:#374151;">Olá, <strong>${nome}</strong>!</p>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;">
            Seu diagnóstico foi concluído. Confira abaixo seus resultados e as recomendações personalizadas para sua gestão.
          </p>
        </td></tr>

        <!-- Score geral -->
        <tr><td style="padding:24px 32px;">
          <div style="background:#f8fafc;border-radius:12px;padding:24px;text-align:center;border:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Pontuação Geral</p>
            <p style="margin:0;font-size:52px;font-weight:700;color:#1B4F72;">${percentual}%</p>
            <span style="display:inline-block;margin-top:8px;padding:4px 16px;background:${corNivel};color:#fff;border-radius:999px;font-size:13px;font-weight:600;">${nivel}</span>
          </div>
        </td></tr>

        <!-- Módulos -->
        <tr><td style="padding:0 32px 24px;">
          <h3 style="font-size:16px;color:#1B4F72;margin:0 0 16px;">Resultado por módulo</h3>
          <table width="100%">${modulosHtml}</table>
        </td></tr>

        <!-- Recomendações -->
        <tr><td style="padding:0 32px 32px;">
          <div style="background:#fffbeb;border-left:4px solid #D4AC0D;border-radius:0 8px 8px 0;padding:20px 24px;">
            <h3 style="font-size:16px;color:#92400e;margin:0 0 12px;">Recomendações para você</h3>
            <ul style="margin:0;padding-left:20px;">${recsHtml}</ul>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">O Conselho Agro · Raccolto Gestão Empresarial</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: "O Conselho Agro <noreply@raccolto.com.br>",
    to: email,
    subject: `${nome}, seu Diagnóstico Empresarial está pronto`,
    html,
  });
}
