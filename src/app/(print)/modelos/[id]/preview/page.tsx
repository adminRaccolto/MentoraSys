import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { PrintButton } from "./print-button";

// Título em branco: remove o nome do app do cabeçalho/rodapé do browser ao imprimir
export const metadata: Metadata = { title: " " };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    contrato_id?: string;
    proposta_id?: string;
    recebivel_id?: string;
  }>;
}

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

export default async function PreviewModeloPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { contrato_id, proposta_id, recebivel_id } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const [modelo, empresa] = await Promise.all([
    prisma.modeloDocumento.findFirst({ where: { id, empresa_id: empresaId } }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nome: true, cnpj: true, logo_url: true, configuracoes: true },
    }),
  ]);

  if (!modelo || !empresa) notFound();

  const config = (empresa.configuracoes as Record<string, string>) ?? {};

  const vars: Record<string, string> = {
    data_hoje: fmt(new Date()),
    data_hoje_extenso: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
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
  };

  if (contrato_id) {
    const [contrato, recebiveis] = await Promise.all([
      prisma.contrato.findFirst({
        where: { id: contrato_id, empresa_id: empresaId },
        include: {
          cliente: true,
          proposta: { select: { parcelas_json: true, numero_parcelas: true, primeiro_vencimento: true, valor_total: true } },
        },
      }),
      prisma.recebivel.findMany({
        where: { contrato_id, empresa_id: empresaId },
        orderBy: [{ numero_parcela: "asc" }, { data_vencimento: "asc" }],
      }),
    ]);
    if (contrato) {
      vars["cliente.nome"] = contrato.cliente_nome ?? contrato.cliente.nome;
      vars["cliente.cpf_cnpj"] = fmtCnpj(contrato.cliente_cpf_cnpj ?? contrato.cliente.cpf_cnpj);
      vars["cliente.email"] = contrato.cliente.email ?? "";
      vars["cliente.telefone"] = contrato.cliente.telefone ?? "";
      vars["contrato.numero"] = contrato.numero_contrato ?? "";
      vars["contrato.titulo"] = contrato.titulo;
      vars["contrato.objeto"] = contrato.objeto ?? "";
      vars["contrato.valor_total"] = fmtMoney(contrato.valor_total);
      vars["contrato.data_inicio"] = fmt(contrato.data_inicio);
      vars["contrato.data_fim"] = fmt(contrato.data_fim);
      vars["contrato.data_emissao"] = fmt(contrato.data_emissao);
      vars["contrato.forma_pagamento"] = contrato.forma_pagamento ?? "";
      vars["contrato.periodicidade"] = contrato.periodicidade ?? "";
      vars["contrato.numero_parcelas"] = contrato.numero_parcelas ? String(contrato.numero_parcelas) : "";
      vars["contrato.primeiro_vencimento"] = fmt(contrato.primeiro_vencimento);
      vars["contrato.cliente_contato_nome"] = contrato.cliente_contato_nome ?? "";
      vars["contrato.cliente_contato_email"] = contrato.cliente_contato_email ?? "";
      vars["contrato.cliente_contato_tel"] = contrato.cliente_contato_tel ?? "";

      // Fonte 1: recebíveis já gerados (contrato assinado)
      if (recebiveis.length > 0) {
        const linhas = recebiveis
          .map(
            (r) => `<tr>
              <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${r.numero_parcela ?? "—"}${r.total_parcelas ? `/${r.total_parcelas}` : ""}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${fmt(r.data_vencimento)}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney(r.valor)}</td>
            </tr>`
          )
          .join("");
        vars["contrato.tabela_parcelas"] = buildTabelaParcelas(linhas);
      } else {
        // Fonte 2: parcelas_json da proposta vinculada
        type ParcelaJson = { numero: number; vencimento: string; valor: number };
        const propostaParcelas = Array.isArray(contrato.proposta?.parcelas_json)
          ? (contrato.proposta!.parcelas_json as ParcelaJson[])
          : [];

        if (propostaParcelas.length > 0) {
          const linhas = propostaParcelas
            .map(
              (p) => `<tr>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.numero}/${propostaParcelas.length}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              </tr>`
            )
            .join("");
          vars["contrato.tabela_parcelas"] = buildTabelaParcelas(linhas);
        } else if (contrato.numero_parcelas && contrato.primeiro_vencimento && Number(contrato.valor_total) > 0) {
          // Fonte 3: calcular a partir dos campos do contrato
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
        } else {
          vars["contrato.tabela_parcelas"] = "";
        }
      }
    }
  }

  if (proposta_id) {
    const proposta = await prisma.proposta.findFirst({
      where: { id: proposta_id, empresa_id: empresaId },
      include: {
        cliente: true,
        responsavel: { select: { nome: true } },
        itens: { orderBy: { ordem: "asc" } },
      },
    });
    if (proposta) {
      vars["cliente.nome"] = proposta.cliente.nome;
      vars["cliente.cpf_cnpj"] = fmtCnpj(proposta.cliente.cpf_cnpj);
      vars["cliente.email"] = proposta.cliente.email ?? "";
      vars["cliente.telefone"] = proposta.cliente.telefone ?? "";
      vars["proposta.titulo"] = proposta.titulo;
      vars["proposta.objeto"] = proposta.objeto ?? "";
      vars["proposta.introducao"] = proposta.introducao ?? "";
      vars["proposta.condicoes"] = proposta.condicoes ?? "";
      vars["proposta.valor_total"] = fmtMoney(proposta.valor_total);
      vars["proposta.validade"] = fmt(proposta.validade);
      vars["proposta.forma_pagamento"] = proposta.forma_pagamento ?? "";
      vars["proposta.periodicidade"] = proposta.periodicidade ?? "";
      vars["proposta.numero_parcelas"] = proposta.numero_parcelas
        ? String(proposta.numero_parcelas)
        : "";
      vars["proposta.primeiro_vencimento"] = fmt(proposta.primeiro_vencimento);
      vars["proposta.contato_nome"] = proposta.contato_nome ?? "";
      vars["proposta.contato_email"] = proposta.contato_email ?? "";
      vars["proposta.contato_telefone"] = proposta.contato_telefone ?? "";
      vars["proposta.responsavel"] = proposta.responsavel?.nome ?? "";

      const linhasItens = proposta.itens
        .map((item) => {
          const sub =
            Number(item.quantidade) *
            Number(item.valor_unitario) *
            (1 - Number(item.desconto) / 100);
          return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${item.descricao}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${Number(item.quantidade)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney(item.valor_unitario)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${Number(item.desconto) > 0 ? Number(item.desconto) + "%" : "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmtMoney(sub)}</td>
        </tr>`;
        })
        .join("");

      vars["proposta.tabela_itens"] = linhasItens
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#1B4F72;color:white;">
          <th style="padding:8px 12px;text-align:left;">Descrição</th>
          <th style="padding:8px 12px;text-align:center;">Qtd</th>
          <th style="padding:8px 12px;text-align:right;">Valor unit.</th>
          <th style="padding:8px 12px;text-align:center;">Desc.</th>
          <th style="padding:8px 12px;text-align:right;">Subtotal</th>
        </tr></thead>
        <tbody>${linhasItens}</tbody>
      </table>`
        : "";

      type ParcelaJson = { numero: number; vencimento: string; valor: number };
      const parcelas = Array.isArray(proposta.parcelas_json)
        ? (proposta.parcelas_json as ParcelaJson[])
        : [];

      if (parcelas.length > 0) {
        const linhasParcelas = parcelas
          .map(
            (p) => `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.numero}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
          </tr>`
          )
          .join("");
        vars[
          "proposta.tabela_parcelas"
        ] = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
          <thead><tr style="background:#1B4F72;color:white;">
            <th style="padding:8px 12px;text-align:center;width:60px;">Parcela</th>
            <th style="padding:8px 12px;text-align:left;">Vencimento</th>
            <th style="padding:8px 12px;text-align:right;">Valor</th>
          </tr></thead>
          <tbody>${linhasParcelas}</tbody>
        </table>`;
      } else {
        vars["proposta.tabela_parcelas"] = "";
      }
    }
  }

  if (recebivel_id) {
    const recebivel = await prisma.recebivel.findFirst({
      where: { id: recebivel_id, empresa_id: empresaId },
      include: { cliente: true },
    });
    if (recebivel) {
      if (recebivel.cliente) {
        vars["cliente.nome"] = recebivel.cliente.nome;
        vars["cliente.cpf_cnpj"] = fmtCnpj(recebivel.cliente.cpf_cnpj);
        vars["cliente.email"] = recebivel.cliente.email ?? "";
        vars["cliente.telefone"] = recebivel.cliente.telefone ?? "";
      }
      vars["recebivel.descricao"] = recebivel.descricao;
      vars["recebivel.valor"] = fmtMoney(recebivel.valor_pago ?? recebivel.valor);
      vars["recebivel.data_pagamento"] = fmt(recebivel.data_pagamento);
      vars["recebivel.forma_pagamento"] = recebivel.forma_pagamento ?? "";
      vars["recebivel.numero_parcela"] = recebivel.numero_parcela
        ? `${recebivel.numero_parcela}/${recebivel.total_parcelas ?? recebivel.numero_parcela}`
        : "";
    }
  }

  let html = substituir(modelo.conteudo, vars);

  // Fallback para modelos antigos que não têm {{proposta.tabela_parcelas}}:
  // injeta a tabela de parcelas antes da seção "CONDIÇÕES DE DESENVOLVIMENTO"
  if (
    proposta_id &&
    vars["proposta.tabela_parcelas"] &&
    !modelo.conteudo.includes("proposta.tabela_parcelas")
  ) {
    const marker = "ONDIÇÕES DE DESENVOLVIMENTO";
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      // Recua até encontrar a tag de abertura do bloco anterior (<div ...>)
      const before = html.substring(0, idx);
      const insertAt = before.lastIndexOf("</div>");
      if (insertAt !== -1) {
        html =
          html.substring(0, insertAt) +
          "\n" + vars["proposta.tabela_parcelas"] +
          html.substring(insertAt);
      }
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }

        @media screen {
          .print-wrapper {
            background: #e5e7eb;
            min-height: 100vh;
            padding: 32px 16px;
          }
          .print-page {
            width: 210mm;
            min-height: 277mm;
            margin: 0 auto 32px;
            padding: 1.5cm;
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            page-break-after: always;
          }
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-wrapper {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-page {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            page-break-after: always;
          }
          .print-page:last-child {
            page-break-after: avoid;
          }
        }
      `}</style>

      {/* Header de controle — não aparece na impressão */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div>
          <p className="font-semibold text-sm text-gray-800">{modelo.nome}</p>
          <p className="text-xs text-gray-500">Pré-visualização · Formato A4</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton />
        </div>
      </div>

      {/* Área de preview */}
      <div className="print-wrapper">
        <div
          className="print-page"
          dangerouslySetInnerHTML={{
            __html:
              html ||
              "<div style='padding:60px;color:#64748b;font-family:sans-serif;'>Este modelo está vazio. Abra o editor para adicionar conteúdo.</div>",
          }}
        />
      </div>
    </>
  );
}
