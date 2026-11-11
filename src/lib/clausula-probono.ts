export const VERSOES_ARATO = {
  ESSENCIAL: "Essencial",
  GESTAO: "Gestão",
  PERFORMANCE: "Performance",
} as const;

export type VersaoArato = keyof typeof VERSOES_ARATO;

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];

function numeroPorExtenso(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  return String(n);
}

function fmtData(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

interface DadosProbono {
  probono_arato: boolean;
  probono_versao: string | null | undefined;
  probono_meses: number | null | undefined;
  data_inicio?: Date | string | null;
}

// Retorna o HTML da cláusula ou "" quando o pro bono está desligado/incompleto.
export function gerarClausulaProbono(c: DadosProbono): string {
  if (!c.probono_arato || !c.probono_versao || !c.probono_meses) return "";

  const versao = VERSOES_ARATO[c.probono_versao as VersaoArato] ?? c.probono_versao;
  const meses = c.probono_meses;
  const periodo = `${meses} (${numeroPorExtenso(meses)}) ${meses === 1 ? "mês" : "meses"}`;

  let vigencia = `${meses === 1 ? "contado" : "contados"} a partir do início da vigência deste contrato`;
  if (c.data_inicio) {
    const inicio = new Date(c.data_inicio);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + meses);
    fim.setDate(fim.getDate() - 1);
    vigencia = `de ${fmtData(inicio)} a ${fmtData(fim)}`;
  }

  const p = "margin:8px 0;text-align:justify;";
  return `
<p style="font-weight:bold;margin:16px 0 8px 0;">DA CESSÃO DE USO PRO BONO DO SISTEMA DE GESTÃO ARATO</p>
<p style="${p}"><strong>§ 1º</strong> Como parte integrante deste contrato, a CONTRATADA concederá à CONTRATANTE, a título gratuito (pro bono), o direito de uso do sistema de gestão Arato, na versão <strong>${versao}</strong>, pelo período de <strong>${periodo}</strong>, ${vigencia}.</p>
<p style="${p}"><strong>§ 2º</strong> Durante o período pro bono não haverá qualquer cobrança à CONTRATANTE pelo uso do sistema Arato, e a cessão não integra o valor deste contrato.</p>
<p style="${p}"><strong>§ 3º</strong> Ao final do período pro bono, a CONTRATADA apresentará à CONTRATANTE proposta comercial para permanência no sistema Arato, sendo sua aceitação facultativa. Caso opte pela permanência, a utilização do sistema será regida por contrato específico, com cobrança à parte e independente do presente instrumento.</p>
<p style="${p}"><strong>§ 4º</strong> Caso a CONTRATANTE opte por não contratar o sistema Arato, a CONTRATADA lhe entregará as informações lançadas no sistema durante o período pro bono em planilhas eletrônicas nos formatos XLSX, ODS e CSV.</p>`;
}

// Modelos antigos não têm {{contrato.clausula_probono}}: a cláusula entra logo após o objeto.
export function garantirVariavelProbono(conteudoModelo: string): string {
  if (conteudoModelo.includes("{{contrato.clausula_probono}}")) return conteudoModelo;
  return conteudoModelo.replace("{{contrato.objeto}}", "{{contrato.objeto}}{{contrato.clausula_probono}}");
}
