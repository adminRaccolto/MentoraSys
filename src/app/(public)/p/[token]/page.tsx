import { prisma } from "@/lib/prisma";
import { XCircle, Clock } from "lucide-react";
import { AceiteActions } from "./aceite-actions";

interface Props {
  params: Promise<{ token: string }>;
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

function substituir(html: string, vars: Record<string, string>): string {
  let resultado = html;
  for (const [chave, valor] of Object.entries(vars)) {
    resultado = resultado.replaceAll(`{{${chave}}}`, valor);
  }
  return resultado;
}

export default async function AceitePropostaPage({ params }: Props) {
  const { token } = await params;

  const proposta = await prisma.proposta.findUnique({
    where: { token_aceite: token },
    include: {
      cliente: true,
      empresa: {
        select: { nome: true, cnpj: true, logo_url: true, configuracoes: true },
      },
      itens: { orderBy: { ordem: "asc" } },
      responsavel: { select: { nome: true } },
    },
  });

  if (!proposta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full mx-4 text-center space-y-3">
          <XCircle className="size-12 text-red-500 mx-auto" />
          <p className="text-lg font-semibold text-gray-800">Proposta não encontrada</p>
          <p className="text-gray-500 text-sm">O link que você acessou é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  const expirada =
    proposta.validade && proposta.validade < new Date() && proposta.status !== "ACEITA";

  if (expirada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full mx-4 text-center space-y-3">
          <Clock className="size-12 text-gray-400 mx-auto" />
          <p className="text-lg font-semibold text-gray-800">Proposta expirada</p>
          <p className="text-gray-500 text-sm">
            Esta proposta não está mais disponível. Entre em contato com a empresa.
          </p>
        </div>
      </div>
    );
  }

  // Build template variables (same as print preview)
  const config = (proposta.empresa.configuracoes as Record<string, string>) ?? {};

  const vars: Record<string, string> = {
    data_hoje: fmt(new Date()),
    "empresa.nome": proposta.empresa.nome,
    "empresa.cnpj": proposta.empresa.cnpj ?? "",
    "empresa.logo_url": proposta.empresa.logo_url ?? "",
    "empresa.telefone": config.telefone ?? "",
    "empresa.email": config.email_contato ?? "",
    "empresa.endereco": config.endereco ?? "",
    "empresa.cidade": config.cidade ?? "",
    "empresa.estado": config.estado ?? "",
    "empresa.site": config.site ?? "",
    "cliente.nome": proposta.cliente.nome,
    "cliente.cpf_cnpj": proposta.cliente.cpf_cnpj ?? "",
    "cliente.email": proposta.cliente.email ?? "",
    "cliente.telefone": proposta.cliente.telefone ?? "",
    "proposta.titulo": proposta.titulo,
    "proposta.objeto": proposta.objeto ?? "",
    "proposta.introducao": proposta.introducao ?? "",
    "proposta.condicoes": proposta.condicoes ?? "",
    "proposta.valor_total": fmtMoney(proposta.valor_total),
    "proposta.validade": fmt(proposta.validade),
    "proposta.forma_pagamento": proposta.forma_pagamento ?? "",
    "proposta.periodicidade": proposta.periodicidade ?? "",
    "proposta.numero_parcelas": proposta.numero_parcelas ? String(proposta.numero_parcelas) : "",
    "proposta.primeiro_vencimento": fmt(proposta.primeiro_vencimento),
    "proposta.contato_nome": proposta.contato_nome ?? "",
    "proposta.contato_email": proposta.contato_email ?? "",
    "proposta.contato_telefone": proposta.contato_telefone ?? "",
    "proposta.responsavel": proposta.responsavel?.nome ?? "",
  };

  // Build itens table
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
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtMoney(sub)}</td>
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

  // Build parcelas table
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

  // Fetch PROPOSTA template for this empresa
  const modelo = await prisma.modeloDocumento.findFirst({
    where: { empresa_id: proposta.empresa_id, tipo: "PROPOSTA" },
  });

  let html = modelo ? substituir(modelo.conteudo, vars) : null;

  // Fallback injection of parcelas table for old templates
  if (
    html &&
    vars["proposta.tabela_parcelas"] &&
    modelo &&
    !modelo.conteudo.includes("proposta.tabela_parcelas")
  ) {
    const marker = "ONDIÇÕES DE DESENVOLVIMENTO";
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      const before = html.substring(0, idx);
      const insertAt = before.lastIndexOf("</div>");
      if (insertAt !== -1) {
        html =
          html.substring(0, insertAt) +
          "\n" +
          vars["proposta.tabela_parcelas"] +
          html.substring(insertAt);
      }
    }
  }

  const jaAceita = proposta.status === "ACEITA";

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", paddingBottom: "2rem" }}>
      {/* Company header */}
      <div
        style={{
          background: "#1B4F72",
          color: "white",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {proposta.empresa.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proposta.empresa.logo_url}
            alt={proposta.empresa.nome}
            style={{ height: "40px", objectFit: "contain" }}
          />
        )}
        <div>
          <p style={{ fontWeight: 700, fontSize: "16px" }}>{proposta.empresa.nome}</p>
          <p style={{ fontSize: "12px", opacity: 0.8 }}>Proposta Comercial</p>
        </div>
      </div>

      {/* Document */}
      <div
        style={{
          maxWidth: "860px",
          margin: "32px auto 0",
          padding: "0 16px",
        }}
      >
        {html ? (
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "40px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          /* Fallback when no template exists */
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "40px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
              fontFamily: "sans-serif",
            }}
          >
            <h1 style={{ color: "#1B4F72", fontSize: "22px", marginBottom: "8px" }}>
              {proposta.titulo}
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "24px" }}>
              Preparada para: <strong>{proposta.cliente.nome}</strong>
              {proposta.validade && ` · Válida até ${fmt(proposta.validade)}`}
            </p>

            {proposta.introducao && (
              <div style={{ marginBottom: "24px" }}>
                <p style={{ whiteSpace: "pre-wrap", color: "#334155" }}>{proposta.introducao}</p>
              </div>
            )}

            {vars["proposta.tabela_itens"] && (
              <div
                style={{ marginBottom: "24px" }}
                dangerouslySetInnerHTML={{ __html: vars["proposta.tabela_itens"] }}
              />
            )}

            <p style={{ textAlign: "right", fontSize: "18px", fontWeight: 700, color: "#1B4F72" }}>
              Total: {vars["proposta.valor_total"]}
            </p>

            {vars["proposta.tabela_parcelas"] && (
              <div dangerouslySetInnerHTML={{ __html: vars["proposta.tabela_parcelas"] }} />
            )}

            {proposta.condicoes && (
              <div style={{ marginTop: "24px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                <p style={{ fontWeight: 600, marginBottom: "8px", color: "#1B4F72" }}>
                  Condições gerais
                </p>
                <p style={{ whiteSpace: "pre-wrap", color: "#64748b", fontSize: "14px" }}>
                  {proposta.condicoes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Acceptance section */}
        <div
          style={{
            background: "white",
            borderRadius: "8px",
            padding: "32px 40px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
            marginTop: "24px",
            textAlign: "center",
          }}
        >
          {jaAceita ? (
            <div className="space-y-2">
              <p className="text-lg font-bold text-green-700">Proposta já aceita</p>
              <p className="text-sm text-gray-500">
                Aceita em {proposta.aceito_em ? fmt(new Date(proposta.aceito_em)) : "—"}. Nossa
                equipe entrará em contato em breve.
              </p>
            </div>
          ) : (
            <>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "20px",
                }}
              >
                Ao aceitar, você confirma estar de acordo com todos os termos desta proposta.
              </p>
              <AceiteActions token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
