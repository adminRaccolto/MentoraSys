import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);

export async function enviarOtpAceite(para: string, codigo: string, tituloProposta: string) {
  await resend.emails.send({
    from: process.env.RESEND_EMAIL_FROM ?? "MentoraSys <noreply@mentorasys.com.br>",
    to: para,
    subject: `Seu código de confirmação: ${codigo}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4F72;">Confirme o aceite da proposta</h2>
        <p style="font-size: 15px; color: #334155;">Para aceitar a proposta <strong>${tituloProposta}</strong>, use o código abaixo:</p>
        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #1B4F72; background: #F0F9FF; padding: 16px 32px; border-radius: 12px; display: inline-block;">${codigo}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">Este código é válido por 10 minutos e é de uso único.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Se você não solicitou este código, ignore este e-mail.</p>
      </div>
    `,
  });
}

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
    from: process.env.RESEND_EMAIL_FROM ?? "Raccolto <noreply@raccolto.com.br>",
    to: para,
    subject: `Você foi convidado para ${empresaNome}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4F72;">Convite para ${empresaNome}</h2>
        <p style="font-size: 15px; color: #334155;">
          <strong>${convidadoPorNome}</strong> convidou você para acessar a plataforma Raccolto como membro de <strong>${empresaNome}</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${link}" style="background:#1B4F72;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            Aceitar convite
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Este link expira em 7 dias.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Se você não esperava este convite, ignore este e-mail.</p>
      </div>
    `,
  });
}

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
    from: process.env.RESEND_EMAIL_FROM ?? "MentoraSys <noreply@mentorasys.com.br>",
    to: para,
    subject: `Lembrete: ${titulo}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4F72;">Lembrete de compromisso</h2>
        <p style="font-size: 16px;">Você tem um evento agendado:</p>
        <div style="background: #F8FAFC; border-left: 4px solid #1B4F72; padding: 16px; border-radius: 4px; margin: 16px 0;">
          <strong style="font-size: 18px;">${titulo}</strong>
          <p style="color: #64748b; margin: 8px 0 0;">${dataFormatada}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Este é um lembrete automático do MentoraSys.</p>
      </div>
    `,
  });
}
