export interface DadosClausulaReembolso {
  reembolso_despesas: boolean;
  reembolso_valor_km: number | null | undefined;
  reembolso_distancia_km: number | null | undefined;
  reembolso_limite_alimentacao: number | null | undefined;
  reembolso_limite_hospedagem: number | null | undefined;
  // Padrões do cadastro do cliente, usados quando o contrato não define o valor
  cliente_preco_km?: number | null;
  cliente_distancia_km?: number | null;
  empresa_cidade?: string | null;
  empresa_estado?: string | null;
}

const PRAZO_PAGAMENTO_DIAS = "5 (cinco)";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const km = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const positivo = (v: number | null | undefined) => (v != null && Number(v) > 0 ? Number(v) : null);

export function resolverValoresReembolso(c: DadosClausulaReembolso) {
  return {
    valorKm: positivo(c.reembolso_valor_km) ?? positivo(c.cliente_preco_km),
    distanciaKm: positivo(c.reembolso_distancia_km) ?? positivo(c.cliente_distancia_km),
    limiteAlimentacao: positivo(c.reembolso_limite_alimentacao),
    limiteHospedagem: positivo(c.reembolso_limite_hospedagem),
  };
}

// Retorna o HTML do item 4.4.2 (deslocamento, alimentação e hospedagem) ou "" quando desligado.
export function gerarClausulaReembolso(c: DadosClausulaReembolso): string {
  if (!c.reembolso_despesas) return "";
  const { valorKm, distanciaKm, limiteAlimentacao, limiteHospedagem } = resolverValoresReembolso(c);

  const local = [c.empresa_cidade, c.empresa_estado].filter(Boolean).join(" – ");
  const perimetro = local ? `fora do perímetro urbano de ${local}` : "fora do perímetro urbano da sede da CONTRATADA";

  const itens: string[] = [];
  if (valorKm) {
    itens.push(
      `<strong>Deslocamento:</strong> ${brl(valorKm)} por quilômetro rodado` +
        (distanciaKm ? `, considerando a distância de referência de ${km(distanciaKm)} km por deslocamento` : "") +
        ".",
    );
  } else {
    itens.push("<strong>Deslocamento:</strong> quilometragem rodada, conforme valor por quilômetro acordado entre as partes.");
  }
  if (limiteAlimentacao) itens.push(`<strong>Alimentação:</strong> até ${brl(limiteAlimentacao)} por dia de deslocamento.`);
  if (limiteHospedagem) itens.push(`<strong>Hospedagem:</strong> até ${brl(limiteHospedagem)} por diária.`);
  if (limiteAlimentacao || limiteHospedagem) {
    itens.push("Os valores de alimentação e hospedagem serão reembolsados até os limites diários acima, dispensada a apresentação de comprovantes.");
  }
  itens.push(
    `As despesas serão apuradas mensalmente e informadas à CONTRATANTE por meio de relatório de reembolso, devendo ser pagas em até ${PRAZO_PAGAMENTO_DIAS} dias após o seu recebimento.`,
  );

  const tipos = ["deslocamento", limiteAlimentacao && "alimentação", limiteHospedagem && "hospedagem"].filter(Boolean) as string[];
  const despesas = tipos.length > 1 ? `${tipos.slice(0, -1).join(", ")} e ${tipos[tipos.length - 1]}` : tipos[0];

  return [
    `<p>4.4.2. A CONTRATANTE reembolsará à CONTRATADA as despesas de ${despesas} quando a execução dos serviços ocorrer ${perimetro}, nas seguintes condições:</p>`,
    ...itens.map((t, i) => `<p style="padding-left:20px;">4.4.2.${i + 1}. ${t}</p>`),
  ].join("\n");
}

type Decimalish = { toString(): string } | number | null;

export function clausulaReembolsoDoContrato(
  contrato: {
    reembolso_despesas: boolean;
    reembolso_valor_km: Decimalish;
    reembolso_distancia_km: Decimalish;
    reembolso_limite_alimentacao: Decimalish;
    reembolso_limite_hospedagem: Decimalish;
    cliente: { preco_km: Decimalish; distancia_km: Decimalish };
  },
  empresa: { cidade?: string | null; estado?: string | null },
): string {
  const n = (v: Decimalish) => (v == null ? null : Number(v));
  return gerarClausulaReembolso({
    reembolso_despesas: contrato.reembolso_despesas,
    reembolso_valor_km: n(contrato.reembolso_valor_km),
    reembolso_distancia_km: n(contrato.reembolso_distancia_km),
    reembolso_limite_alimentacao: n(contrato.reembolso_limite_alimentacao),
    reembolso_limite_hospedagem: n(contrato.reembolso_limite_hospedagem),
    cliente_preco_km: n(contrato.cliente.preco_km),
    cliente_distancia_km: n(contrato.cliente.distancia_km),
    empresa_cidade: empresa.cidade,
    empresa_estado: empresa.estado,
  });
}

// Modelos antigos têm o 4.4.2 genérico em texto fixo: ele é substituído pela cláusula configurável.
const ITEM_GENERICO = /<p[^>]*>\s*4\.4\.2\.\s*A CONTRATANTE reembolsará[\s\S]*?<\/p>/;

export function garantirVariavelReembolso(conteudoModelo: string): string {
  if (conteudoModelo.includes("{{contrato.clausula_reembolso}}")) return conteudoModelo;
  return conteudoModelo.replace(ITEM_GENERICO, "{{contrato.clausula_reembolso}}");
}
