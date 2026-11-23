import { textoParaHtml } from "@/lib/texto-html";

export interface DadosAditivo {
  numero: number;
  data: Date;
  contrato: { numero: string | null; titulo: string; assinadoEm: Date | null };
  empresa: {
    logoImg: string;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    endereco: string;
    cidade: string;
    estado: string;
    representante: string;
    representanteCargo: string;
    representanteCpf: string;
    telefone: string;
    email: string;
  };
  cliente: { nome: string; cpfCnpj: string; endereco: string };
  clausulaReembolso: string;
  clausulaProbono: string;
  textoLivre: string | null;
}

const ORDINAIS_M = ["PRIMEIRO", "SEGUNDO", "TERCEIRO", "QUARTO", "QUINTO", "SEXTO", "SÉTIMO", "OITAVO", "NONO", "DÉCIMO"];
const ORDINAIS_F = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA", "DÉCIMA"];

export const ordinalAditivo = (n: number) => ORDINAIS_M[n - 1] ?? `${n}º`;
const ordinalClausula = (n: number) => ORDINAIS_F[n - 1] ?? `${n}ª`;

export function tituloAditivo(numero: number, numeroContrato: string | null) {
  return `${ordinalAditivo(numero)} TERMO ADITIVO AO CONTRATO${numeroContrato ? ` Nº ${numeroContrato}` : ""}`;
}

const TZ = "America/Sao_Paulo";
const dataExtenso = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });

// "Marcar como assinado" grava a data à meia-noite UTC; no fuso de Brasília ela cairia no dia anterior.
function fmtDataAssinatura(d: Date) {
  const meiaNoiteUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleDateString("pt-BR", { timeZone: meiaNoiteUtc ? "UTC" : TZ });
}

export function gerarHtmlAditivo(d: DadosAditivo): string {
  const refContrato = `Contrato${d.contrato.numero ? ` nº ${d.contrato.numero}` : ""} – ${d.contrato.titulo}`;
  const firmado = d.contrato.assinadoEm ? `, firmado em ${fmtDataAssinatura(d.contrato.assinadoEm)}` : "";

  const clausulas: Array<{ titulo: string; corpo: string }> = [];
  if (d.clausulaReembolso) {
    clausulas.push({
      titulo: "DO REEMBOLSO DE DESPESAS",
      corpo: `<p>O item 4.4.2 do Contrato passa a vigorar com a seguinte redação:</p>
<div style="padding-left:20px;border-left:3px solid #ccc;margin:8px 0 8px 4px;">${d.clausulaReembolso}</div>`,
    });
  }
  if (d.clausulaProbono) {
    clausulas.push({
      titulo: "DA CESSÃO PRO BONO DO SISTEMA ARATO",
      corpo: `<p>Fica incluída no Contrato a seguinte disposição:</p>
<div style="padding-left:20px;border-left:3px solid #ccc;margin:8px 0 8px 4px;">${d.clausulaProbono}</div>`,
    });
  }
  if (d.textoLivre?.trim()) {
    clausulas.push({ titulo: "DAS DEMAIS ALTERAÇÕES", corpo: `<p>${textoParaHtml(d.textoLivre.trim())}</p>` });
  }
  clausulas.push({
    titulo: "DA VIGÊNCIA",
    corpo: "<p>As alterações previstas neste Termo Aditivo produzem efeitos a partir da data de sua assinatura.</p>",
  });
  clausulas.push({
    titulo: "DA RATIFICAÇÃO",
    corpo: "<p>Ficam ratificadas todas as demais cláusulas e condições do Contrato não alteradas por este instrumento, que permanecem em pleno vigor.</p>",
  });

  const e = d.empresa;
  const local = [e.cidade, e.estado].filter(Boolean).join("-");

  return `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;color:#000;text-align:justify;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:28px;">
    <tr>
      <td width="45%" valign="middle">${e.logoImg}</td>
      <td align="right" valign="top" style="font-size:9pt;line-height:1.5;">
        CNPJ: ${e.cnpj}<br>${e.razaoSocial}<br>${e.endereco}<br>${[e.cidade, e.estado].filter(Boolean).join(", ")}
      </td>
    </tr>
  </table>

  <p style="text-align:center;font-weight:bold;font-size:12pt;margin:0 0 28px 0;">${tituloAditivo(d.numero, d.contrato.numero)}</p>

  <p style="margin-bottom:14px;"><strong>CONTRATADA:</strong> ${e.razaoSocial}${e.nomeFantasia && e.nomeFantasia !== e.razaoSocial ? `, nome fantasia ${e.nomeFantasia}` : ""}, CNPJ ${e.cnpj}${e.endereco ? `, estabelecida à ${e.endereco}` : ""}${e.cidade ? `, na cidade de ${e.cidade}` : ""}${e.representante ? `, representada neste ato por ${e.representante}, na qualidade de ${e.representanteCargo}${e.representanteCpf ? `, CPF ${e.representanteCpf}` : ""}` : ""}.</p>
  <p style="margin-bottom:14px;"><strong>CONTRATANTE:</strong> ${d.cliente.nome}${d.cliente.cpfCnpj ? `, CPF/CNPJ ${d.cliente.cpfCnpj}` : ""}${d.cliente.endereco ? `, com endereço em ${d.cliente.endereco}` : ""}.</p>

  <p>As partes acima qualificadas, signatárias do ${refContrato}${firmado} (“Contrato”), resolvem, de comum acordo, celebrar o presente Termo Aditivo, que se regerá pelas cláusulas e condições seguintes:</p>

  ${clausulas
    .map((c, i) => `<p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA ${ordinalClausula(i + 1)} – ${c.titulo}</p>\n  ${c.corpo}`)
    .join("\n\n  ")}

  <p style="margin-top:20px;">E, por estarem justas e acordadas, as partes assinam o presente Termo Aditivo para que produza seus efeitos legais.</p>

  <p style="text-align:right;margin-top:40px;">${local ? `${local}, ` : ""}${dataExtenso(d.data)}.</p>
  <br><br><br>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="44%" align="center" valign="top" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.5;">
        ${e.representante ? `${e.representante}<br>${e.representanteCargo}<br>` : ""}${e.razaoSocial}<br>CNPJ: ${e.cnpj}
      </td>
      <td width="12%"></td>
      <td width="44%" align="center" valign="top" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.5;">
        ${d.cliente.nome}${d.cliente.cpfCnpj ? `<br>CPF/CNPJ: ${d.cliente.cpfCnpj}` : ""}
      </td>
    </tr>
  </table>

  <div style="border-top:2px solid #000;margin-top:40px;padding-top:8px;display:flex;justify-content:space-between;font-size:9pt;">
    <span>${e.telefone ? `Tel.: ${e.telefone}` : ""}</span>
    <span>${e.email}</span>
  </div>
</div>`;
}
