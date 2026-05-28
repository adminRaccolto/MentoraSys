import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);

const FROM = process.env.RESEND_EMAIL_FROM ?? "Raccolto <noreply@raccolto.com.br>";

const LOGO_URL = "https://app.raccolto.com.br/favicon.png";

function emailWrapper(conteudo: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

            <!-- Cabeçalho -->
            <tr>
              <td style="background:#1B4F72;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
                <img src="${LOGO_URL}" alt="Raccolto" width="48" height="48"
                  style="display:inline-block;border-radius:8px;margin-bottom:10px;" />
                <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Raccolto</p>
                <p style="margin:4px 0 0;color:#AED6F1;font-size:12px;">Plataforma de gestão para consultoria</p>
              </td>
            </tr>

            <!-- Conteúdo -->
            <tr>
              <td style="background:#ffffff;padding:32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
                ${conteudo}
              </td>
            </tr>

            <!-- Rodapé -->
            <tr>
              <td style="background:#F1F5F9;border-radius:0 0 12px 12px;border:1px solid #E2E8F0;border-top:none;padding:16px 32px;text-align:center;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  © ${new Date().getFullYear()} Raccolto · Todos os direitos reservados
                </p>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">
                  Se você não esperava este e-mail, pode ignorá-lo com segurança.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ─── OTP para aceite de proposta ─────────────────────────────────────────────

export async function enviarOtpAceite(para: string, codigo: string, tituloProposta: string) {
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `Código de confirmação — ${tituloProposta}`,
    html: emailWrapper(`
      <h2 style="margin:0 0 8px;color:#1B4F72;font-size:20px;">Confirme o aceite da proposta</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 24px;">
        Para aceitar a proposta <strong>${tituloProposta}</strong>, insira o código abaixo:
      </p>
      <div style="text-align:center;margin:32px 0;">
        <span style="font-size:40px;font-weight:800;letter-spacing:14px;color:#1B4F72;
          background:#EFF6FF;padding:16px 28px;border-radius:12px;display:inline-block;
          border:2px solid #BFDBFE;">
          ${codigo}
        </span>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
        Este código é válido por <strong>10 minutos</strong> e é de uso único.
      </p>
    `),
  });
}

// ─── Convite de membro da equipe ──────────────────────────────────────────────

export async function enviarConviteEquipe(
  para: string,
  empresaNome: string,
  convidadoPorNome: string,
  token: string,
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const link = `${baseUrl}/membro/${token}`;

  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `Convite para ${empresaNome} — Raccolto`,
    html: emailWrapper(`
      <h2 style="margin:0 0 8px;color:#1B4F72;font-size:20px;">Você foi convidado!</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 8px;">
        <strong>${convidadoPorNome}</strong> convidou você para acessar a plataforma
        Raccolto como membro de <strong>${empresaNome}</strong>.
      </p>
      <p style="color:#64748b;font-size:13px;margin:0 0 28px;">
        Clique no botão abaixo para criar sua senha e começar a usar o sistema.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}"
          style="background:#1B4F72;color:#ffffff;padding:14px 32px;border-radius:8px;
          text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          Aceitar convite
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
        Este link expira em <strong>7 dias</strong>.
      </p>
    `),
  });
}

// ─── Lembrete de evento ───────────────────────────────────────────────────────

export async function enviarLembrete(para: string, titulo: string, inicio: Date) {
  const dataFormatada = inicio.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `Lembrete: ${titulo}`,
    html: emailWrapper(`
      <h2 style="margin:0 0 8px;color:#1B4F72;font-size:20px;">Lembrete de compromisso</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 20px;">Você tem um evento agendado:</p>
      <div style="background:#F8FAFC;border-left:4px solid #1B4F72;padding:16px 20px;
        border-radius:0 8px 8px 0;margin:0 0 20px;">
        <p style="margin:0;font-size:17px;font-weight:700;color:#1E293B;">${titulo}</p>
        <p style="margin:6px 0 0;color:#64748b;font-size:14px;">${dataFormatada}</p>
      </div>
    `),
  });
}
