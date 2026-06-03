"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { criarDocumentoAuthentique } from "@/lib/authentique";
import { registrar } from "@/lib/auditoria";

const schemaEnviar = z.object({
  contrato_id: z.string().min(1),
  modelo_id: z.string().optional(), // opcional quando há anexo_url
  email_empresa: z.string().email("E-mail da empresa inválido"),
  nome_empresa: z.string().min(1, "Nome do representante obrigatório"),
  email_cliente: z.string().email("E-mail do cliente inválido"),
  nome_cliente: z.string().min(1, "Nome do cliente obrigatório"),
  sandbox: z.boolean().default(false),
});

type Input = z.input<typeof schemaEnviar>;

// ─── Helpers (mesma lógica do preview page) ───────────────────────────────────

function fmt(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtMoney(v: unknown) {
  const n =
    typeof v === "object" && v !== null && "toNumber" in v
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtTelefone(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

function fmtCnpj(v: string | null | undefined): string {
  const digits = (v ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return v ?? "";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function buildTabelaParcelas(linhas: string): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:11pt;margin:12px 0;">
    <thead><tr style="background:#1B4F72;color:white;">
      <th style="padding:6px 12px;text-align:center;width:80px;">Parcela</th>
      <th style="padding:6px 12px;text-align:left;">Vencimento</th>
      <th style="padding:6px 12px;text-align:right;">Valor (R$)</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

function substituir(html: string, vars: Record<string, string>): string {
  let resultado = html;
  for (const [chave, valor] of Object.entries(vars)) {
    resultado = resultado.replaceAll(`{{${chave}}}`, valor);
  }
  return resultado;
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function enviarParaAssinatura(input: Input) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const data = schemaEnviar.parse(input);

  const [contrato, recebiveis, empresa, modelo] = await Promise.all([
    prisma.contrato.findFirst({
      where: { id: data.contrato_id, empresa_id: empresaId },
      include: {
        cliente: true,
        proposta: {
          select: {
            parcelas_json: true,
            numero_parcelas: true,
            primeiro_vencimento: true,
            valor_total: true,
          },
        },
      },
    }),
    prisma.recebivel.findMany({
      where: { contrato_id: data.contrato_id, empresa_id: empresaId },
      orderBy: [{ numero_parcela: "asc" }, { data_vencimento: "asc" }],
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nome: true, cnpj: true, logo_url: true, configuracoes: true },
    }),
    prisma.modeloDocumento.findFirst({
      where: { id: data.modelo_id, empresa_id: empresaId },
    }),
  ]);

  if (!contrato) return { ok: false, error: "Contrato não encontrado" };
  if (!empresa) return { ok: false, error: "Empresa não encontrada" };
  // modelo obrigatório apenas quando não há PDF anexado
  if (!contrato.anexo_url && !modelo) return { ok: false, error: "Modelo de documento não encontrado" };
  if (contrato.status !== "RASCUNHO") {
    return { ok: false, error: "Apenas contratos em rascunho podem ser enviados para assinatura" };
  }

  const config = (empresa.configuracoes as Record<string, string>) ?? {};

  // ── Montar variáveis ────────────────────────────────────────────────────────
  const vars: Record<string, string> = {
    data_hoje: fmt(new Date()),
    data_hoje_extenso: new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    "empresa.nome": empresa.nome,
    "empresa.cnpj": fmtCnpj(empresa.cnpj),
    "empresa.logo_url": empresa.logo_url ?? "",
    "empresa.logo_img": empresa.logo_url
      ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
      : "",
    "empresa.telefone": fmtTelefone(config.telefone),
    "empresa.email": config.email_contato ?? "",
    "empresa.endereco": config.endereco ?? "",
    "empresa.cidade": config.cidade ?? "",
    "empresa.estado": config.estado ?? "",
    "empresa.cep": config.cep ?? "",
    "empresa.site": config.site ?? "",
    "empresa.razao_social": config.razao_social ?? empresa.nome,
    "empresa.nome_fantasia": config.nome_fantasia ?? empresa.nome,
    "empresa.representante": config.representante ?? "",
    "empresa.representante_cpf": config.representante_cpf ?? "",
    "empresa.representante_cargo": config.representante_cargo ?? "Sócio Administrador",
    "cliente.nome": contrato.cliente_nome ?? contrato.cliente.nome,
    "cliente.cpf_cnpj": fmtCnpj(contrato.cliente_cpf_cnpj ?? contrato.cliente.cpf_cnpj),
    "cliente.email": contrato.cliente.email ?? "",
    "cliente.telefone": contrato.cliente.telefone ?? "",
    "contrato.numero": contrato.numero_contrato ?? "",
    "contrato.titulo": contrato.titulo,
    "contrato.objeto": contrato.objeto ?? "",
    "contrato.valor_total": fmtMoney(contrato.valor_total),
    "contrato.data_inicio": fmt(contrato.data_inicio),
    "contrato.data_fim": fmt(contrato.data_fim),
    "contrato.data_emissao": fmt(contrato.data_emissao),
    "contrato.forma_pagamento": contrato.forma_pagamento ?? "",
    "contrato.periodicidade": contrato.periodicidade ?? "",
    "contrato.numero_parcelas": contrato.numero_parcelas ? String(contrato.numero_parcelas) : "",
    "contrato.primeiro_vencimento": fmt(contrato.primeiro_vencimento),
    "contrato.cliente_contato_nome": contrato.cliente_contato_nome ?? "",
    "contrato.cliente_contato_email": contrato.cliente_contato_email ?? "",
    "contrato.cliente_contato_tel": contrato.cliente_contato_tel ?? "",
    "contrato.tabela_parcelas": "",
  };

  // Tabela de parcelas — 3 fontes
  if (recebiveis.length > 0) {
    const linhas = recebiveis
      .map(
        (r) =>
          `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${r.numero_parcela ?? "—"}${r.total_parcelas ? `/${r.total_parcelas}` : ""}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${fmt(r.data_vencimento)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney(r.valor)}</td>
        </tr>`
      )
      .join("");
    vars["contrato.tabela_parcelas"] = buildTabelaParcelas(linhas);
  } else {
    type ParcelaJson = { numero: number; vencimento: string; valor: number };
    const propostaParcelas = Array.isArray(contrato.proposta?.parcelas_json)
      ? (contrato.proposta!.parcelas_json as ParcelaJson[])
      : [];

    if (propostaParcelas.length > 0) {
      const linhas = propostaParcelas
        .map(
          (p) =>
            `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.numero}/${propostaParcelas.length}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
          </tr>`
        )
        .join("");
      vars["contrato.tabela_parcelas"] = buildTabelaParcelas(linhas);
    } else if (
      contrato.numero_parcelas &&
      contrato.primeiro_vencimento &&
      Number(contrato.valor_total) > 0
    ) {
      const n = contrato.numero_parcelas;
      const valorParcela = Number(contrato.valor_total) / n;
      const linhas = Array.from({ length: n }, (_, i) => {
        const dt = new Date(contrato.primeiro_vencimento!);
        dt.setMonth(dt.getMonth() + i);
        return `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${i + 1}/${n}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${dt.toLocaleDateString("pt-BR")}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        </tr>`;
      }).join("");
      vars["contrato.tabela_parcelas"] = buildTabelaParcelas(linhas);
    }
  }

  // ── Criar documento no Authentique ─────────────────────────────────────────
  let doc: { id: string; signatarios: Array<{ email: string; link: string }> };
  try {
    if (contrato.anexo_url) {
      // Envia o PDF anexado diretamente
      const pdfRes = await fetch(contrato.anexo_url);
      if (!pdfRes.ok) throw new Error("Não foi possível baixar o PDF anexado");
      const pdfBuffer = await pdfRes.arrayBuffer();
      doc = await criarDocumentoAuthentique({
        nome: contrato.titulo,
        htmlContent: "",
        pdfBuffer,
        signatarios: [
          { email: data.email_empresa, nome: data.nome_empresa },
          { email: data.email_cliente, nome: data.nome_cliente },
        ],
        sandbox: data.sandbox,
      });
    } else {
      const htmlContent = substituir(modelo!.conteudo, vars);
      doc = await criarDocumentoAuthentique({
        nome: contrato.titulo,
        htmlContent,
        signatarios: [
          { email: data.email_empresa, nome: data.nome_empresa },
          { email: data.email_cliente, nome: data.nome_cliente },
        ],
        sandbox: data.sandbox,
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar documento na Authentique";
    return { ok: false as const, error: msg };
  }

  // Usa o link do primeiro signatário como URL de acompanhamento (admin)
  const authentique_url = doc.signatarios[0]?.link ?? null;

  await prisma.contrato.update({
    where: { id: data.contrato_id },
    data: {
      status: "AGUARDANDO_ASSINATURA",
      authentique_id: doc.id,
      authentique_url,
    },
  });

  await registrar({
    recurso: "contratos",
    acao: "enviar_assinatura",
    registroId: data.contrato_id,
    detalhes: { authentique_id: doc.id, email_empresa: data.email_empresa, email_cliente: data.email_cliente },
  });

  revalidatePath("/contratos");
  return { ok: true as const, authentique_id: doc.id };
}
