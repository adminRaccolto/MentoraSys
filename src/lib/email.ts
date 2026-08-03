import { Resend } from "resend";

const FROM = process.env.RESEND_EMAIL_FROM ?? "Raccolto Financeiro <financeiro@raccolto.com.br>";

function getResend() {
  return new Resend(process.env.RESEND_EMAIL_API_KEY);
}

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
  await getResend().emails.send({
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

  await getResend().emails.send({
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

// ─── Diagnóstico O Conselho Agro ─────────────────────────────────────────────

interface DiagnosticoAgroScore {
  bloco1: { percentual: number; nivel: string; diagnostico: string };
  bloco2: { percentual: number; nivel: string; diagnostico: string };
  bloco3: { percentual: number; nivel: string; diagnostico: string };
  bloco4: { percentual: number; nivel: string; diagnostico: string };
  geral: { percentual: number; nivel: string; diagnostico: string };
}

const NIVEL_LABELS: Record<string, string> = {
  CRITICO: "Crítico",
  ATENCAO: "Atenção",
  BOM: "Bom",
  EXCELENTE: "Excelente",
};

const NIVEL_COLORS: Record<string, string> = {
  CRITICO: "#dc2626",
  ATENCAO: "#d97706",
  BOM: "#16a34a",
  EXCELENTE: "#0369a1",
};

function blocoRow(titulo: string, pct: number, nivel: string): string {
  const cor = NIVEL_COLORS[nivel] ?? "#475569";
  const label = NIVEL_LABELS[nivel] ?? nivel;
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span style="color:#374151;font-size:14px;font-weight:600;">${titulo}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="color:${cor};font-size:14px;font-weight:700;">${pct}%</span>
        <span style="color:${cor};font-size:12px;margin-left:6px;background:${cor}22;padding:2px 8px;border-radius:99px;">${label}</span>
      </td>
    </tr>`;
}

export async function enviarDiagnosticoAgro(
  para: string,
  primeiroNome: string,
  score: DiagnosticoAgroScore,
) {
  const cor = NIVEL_COLORS[score.geral.nivel] ?? "#475569";
  const label = NIVEL_LABELS[score.geral.nivel] ?? score.geral.nivel;

  await getResend().emails.send({
    from: FROM,
    to: para,
    subject: `Seu diagnóstico de gestão — O Conselho Agro`,
    html: emailWrapper(`
      <h2 style="margin:0 0 4px;color:#1B4F72;font-size:22px;">Olá, ${primeiroNome}!</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 24px;">
        Aqui está o resultado do seu diagnóstico de gestão de fazenda.
      </p>

      <!-- Pontuação geral -->
      <div style="text-align:center;background:#f8fafc;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Pontuação Geral</p>
        <p style="margin:0;font-size:56px;font-weight:900;color:${cor};line-height:1;">${score.geral.percentual}%</p>
        <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:${cor};background:${cor}22;display:inline-block;padding:4px 16px;border-radius:99px;">${label}</p>
      </div>

      <!-- Blocos -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${blocoRow("Bloco 1 — Operação", score.bloco1.percentual, score.bloco1.nivel)}
        ${blocoRow("Bloco 2 — Custos", score.bloco2.percentual, score.bloco2.nivel)}
        ${blocoRow("Bloco 3 — Financeiro", score.bloco3.percentual, score.bloco3.nivel)}
        ${blocoRow("Bloco 4 — Gestão", score.bloco4.percentual, score.bloco4.nivel)}
      </table>

      <!-- Diagnóstico geral -->
      <div style="background:#f0f9ff;border-left:4px solid #0369a1;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">Análise Geral</p>
        <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">${score.geral.diagnostico}</p>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0 0 24px;">
        Nossa equipe entrará em contato em breve para apresentar as recomendações específicas para a sua fazenda.
      </p>

      <div style="text-align:center;">
        <a href="https://oconselhoagro.com.br" style="background:#1B4F72;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Conhecer O Conselho Agro
        </a>
      </div>
    `),
  });
}

// ─── Fatura não-fiscal ───────────────────────────────────────────────────────

interface EnviarFaturaOpts {
  para: string;
  clienteNome: string;
  empresaNome: string;
  descricao: string;
  valor: number;
  dataVencimento: Date;
  numeroParcela: number | null;
  totalParcelas: number | null;
  formaPagamento: string | null;
  pixChave: string | null;
  link: string;
}

export async function enviarFatura(opts: EnviarFaturaOpts) {
  const {
    para, clienteNome, empresaNome, descricao, valor,
    dataVencimento, numeroParcela, totalParcelas,
    formaPagamento, pixChave, link,
  } = opts;

  const valorFmt = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vencFmt  = new Date(dataVencimento).toLocaleDateString("pt-BR");
  const parcelaInfo = numeroParcela && totalParcelas
    ? `<span style="color:#64748b;font-size:13px;">Parcela ${numeroParcela}/${totalParcelas}</span>`
    : "";

  const pixRow = pixChave
    ? `<tr>
        <td style="padding:8px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Chave PIX</td>
        <td style="padding:8px 16px;font-size:13px;font-weight:600;color:#1B4F72;font-family:monospace;border-bottom:1px solid #f1f5f9;">${pixChave}</td>
      </tr>`
    : "";

  const pagamentoRow = formaPagamento
    ? `<tr>
        <td style="padding:8px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Pagamento</td>
        <td style="padding:8px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;">${formaPagamento}</td>
      </tr>`
    : "";

  await getResend().emails.send({
    from: FROM,
    to: para,
    subject: `Fatura — ${empresaNome} · ${valorFmt} vence em ${vencFmt}`,
    html: emailWrapper(`
      <h2 style="margin:0 0 4px;color:#1B4F72;font-size:20px;">Olá, ${clienteNome}!</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 24px;">
        Segue a fatura emitida por <strong>${empresaNome}</strong>.
      </p>

      <!-- Resumo da fatura -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 24px;">
        <thead>
          <tr style="background:#1B4F72;">
            <th colspan="2" style="padding:12px 16px;text-align:left;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;">
              Detalhes da cobrança
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Descrição</td>
            <td style="padding:8px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;">${descricao} ${parcelaInfo}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Vencimento</td>
            <td style="padding:8px 16px;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">${vencFmt}</td>
          </tr>
          ${pagamentoRow}
          ${pixRow}
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;color:#374151;font-size:14px;font-weight:700;">Total</td>
            <td style="padding:12px 16px;font-size:20px;font-weight:900;color:#1B4F72;">${valorFmt}</td>
          </tr>
        </tbody>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${link}"
          style="background:#1B4F72;color:#ffffff;padding:14px 36px;border-radius:8px;
          text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Ver fatura completa
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:12px 0 0;">
        Você também pode salvar a fatura como PDF diretamente na página acima.
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

  await getResend().emails.send({
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
