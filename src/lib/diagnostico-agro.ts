export interface BlockScore {
  percentual: number;
  nivel: "CRITICO" | "ATENCAO" | "BOM" | "EXCELENTE";
  diagnostico: string;
}

export interface DiagnosticoScore {
  bloco1: BlockScore;
  bloco2: BlockScore;
  bloco3: BlockScore;
  bloco4: BlockScore;
  geral: BlockScore;
}

function nivel(pct: number): "CRITICO" | "ATENCAO" | "BOM" | "EXCELENTE" {
  if (pct <= 30) return "CRITICO";
  if (pct <= 60) return "ATENCAO";
  if (pct <= 80) return "BOM";
  return "EXCELENTE";
}

const DIAG: Record<string, Record<string, string>> = {
  bloco1: {
    CRITICO:
      "A estrutura operacional apresenta fragilidades relevantes. A fazenda tende a ter baixa autonomia de armazenagem e/ou execução, maior dependência de terceiros ou arrendamento e maior exposição a atrasos, perdas e aumento de custo operacional. A prioridade é mapear gargalos críticos, medir custo por operação, avaliar contratos de terceirização e definir plano de melhoria para armazenagem, máquinas, logística e uso da terra. Alto impacto financeiro e engessamento da comercialização.",
    ATENCAO:
      "A operação possui alguma estrutura, mas ainda depende de ajustes importantes. Há riscos de custo, prazo e eficiência que podem comprometer a margem quando a safra exige velocidade de execução. Recomenda-se revisar a composição de custo isoladamente das áreas arrendadas e ver o impacto no resultado operacional de toda a estrutura, formalizar indicadores de desempenho operacional e acompanhar custo por hectare e por etapa da produção.",
    BOM: "A fazenda demonstra boa capacidade operacional e nível razoável de controle. Os principais riscos estão mais ligados à otimização do que à falta de estrutura. O foco deve ser melhorar produtividade dos ativos, manutenção preventiva, contratos de terceiros, logística interna e comparação de desempenho por safra, cultura e talhão.",
    EXCELENTE:
      "A operação apresenta alta maturidade, com boa autonomia, estrutura e controle dos principais fatores produtivos. A gestão deve concentrar esforços em eficiência fina, benchmarking, expansão planejada, automação de controles e análise de retorno sobre novos investimentos operacionais.",
  },
  bloco2: {
    CRITICO:
      "A relação entre receitas e custos indica risco elevado para a margem da fazenda. Custos diretos, produtividade de mão de obra, ausência de travas e baixa leitura comercial podem deixar o resultado muito exposto ao mercado. A ação imediata deve ser estruturar custo por cultura, talhão e saca, orçamento de safra, política de compras e venda, além de simulações de margem antes das decisões.",
    ATENCAO:
      "A fazenda possui controles parciais sobre custos e comercialização, mas ainda há pontos que podem reduzir a margem. O produtor pode estar tomando parte das decisões com base em histórico e percepção, sem transformar isso em rotina financeira. Recomenda-se acompanhar custo orçado versus realizado, produtividade por trabalhador, travas de insumos e produção, e pontos mínimos de venda.",
    BOM: "A gestão de receitas e custos é consistente, com boa leitura de margem e alguma disciplina nas decisões comerciais. A fazenda já consegue proteger parte do resultado, mas ainda pode ganhar com análises de sensibilidade, metas de margem por cultura, revisão de fornecedores e integração entre produção, compras e comercialização.",
    EXCELENTE:
      "A fazenda demonstra alta maturidade na gestão de custos e receitas. As decisões de compra, venda e proteção de margem tendem a ser baseadas em dados e cenários. O próximo passo é aprofundar inteligência comercial, indicadores por unidade produtiva, orçamento matricial e estratégias de proteção de margem ao longo da safra.",
  },
  bloco3: {
    CRITICO:
      "A situação financeira exige atenção imediata. O histórico de frustração de safra, dependência de custeio e necessidade de captar mais recursos do que se amortiza podem indicar pressão de caixa e risco de endividamento crescente. A prioridade é montar fluxo de caixa mensal e diário, mapa de dívidas, cronograma de amortização, renegociação quando necessário e plano de redução da dependência bancária.",
    ATENCAO:
      "A fazenda apresenta risco financeiro moderado. Existe alguma dependência de crédito ou exposição a oscilações de safra, mas ainda há espaço para organização antes que o problema se agrave. Recomenda-se controlar capital de giro, separar custeio de investimento, projetar pagamentos por safra, acompanhar saldo de dívida e criar rotina de fechamento financeiro.",
    BOM: "A estrutura financeira é relativamente equilibrada. O crédito parece ser usado de forma administrável e a fazenda tem melhor capacidade de absorver variações. O foco deve ser fortalecer reserva de liquidez, melhorar o planejamento de safra, acompanhar indicadores de endividamento e integrar fluxo de caixa com decisões comerciais e operacionais.",
    EXCELENTE:
      "A fazenda demonstra alta resiliência financeira, com baixa pressão de endividamento e boa capacidade de planejamento. A gestão deve evoluir para alocação estratégica de capital, avaliação de retorno por investimento, política de reservas, planejamento tributário e simulações de cenários para crescimento sustentável.",
  },
  bloco4: {
    CRITICO:
      "A gestão apresenta fragilidade elevada. A ausência de software confiável, desconhecimento do custo por saca, baixa clareza de despesas e decisões baseadas apenas na experiência reduzem a previsibilidade do negócio. A prioridade é implantar rotina mínima de gestão: plano de contas, lançamento padronizado, conciliação, custo por saca, reuniões de fechamento e relatórios gerenciais.",
    ATENCAO:
      "A fazenda já possui alguma prática de gestão, mas ainda com baixa confiabilidade ou uso limitado das informações. O risco principal é ter dados disponíveis sem transformá-los em decisão. Recomenda-se padronizar cadastros, validar lançamentos, envolver o produtor na leitura dos relatórios, criar indicadores simples e realizar fechamentos periódicos por safra.",
    BOM: "A gestão está bem estruturada e já utiliza dados para apoiar decisões. A fazenda conhece seus custos e possui melhor capacidade de analisar resultados. O foco deve ser consolidar governança, dashboards, metas por área, análise de desvios, reuniões formais de gestão e integração entre financeiro, produção e comercialização.",
    EXCELENTE:
      "A fazenda apresenta alto nível de maturidade gerencial. As informações são confiáveis, as decisões são orientadas por dados e há rotina de análise. A evolução recomendada é trabalhar planejamento estratégico, sucessão, governança, BI avançado, automação de indicadores e avaliação contínua de rentabilidade por cultura, área e investimento.",
  },
  geral: {
    CRITICO:
      "O diagnóstico geral indica situação crítica de gestão. A fazenda tem vulnerabilidades relevantes que podem afetar caixa, margem, operação e tomada de decisão. A recomendação é iniciar um plano de recuperação gerencial com prioridades de curto prazo: organizar dados financeiros, identificar gargalos operacionais, mapear dívidas, calcular custo real e criar rotina mensal de acompanhamento.",
    ATENCAO:
      "O diagnóstico geral indica estágio intermediário com pontos de atenção. A fazenda possui bases importantes, mas ainda apresenta lacunas que podem limitar rentabilidade e previsibilidade. Recomenda-se um plano de profissionalização em etapas, começando pelos controles financeiros, custo por saca, orçamento de safra, indicadores operacionais e rotina de reuniões gerenciais.",
    BOM: "O diagnóstico geral indica boa estrutura de gestão. A fazenda tem controles e práticas que permitem decisões mais seguras, embora ainda existam oportunidades de padronização e ganho de eficiência. O foco deve ser aprimorar indicadores, integrar áreas, melhorar previsões de caixa e transformar os dados em planos de ação por safra.",
    EXCELENTE:
      "O diagnóstico geral indica excelente maturidade de gestão. A fazenda demonstra controle, previsibilidade e capacidade de decisão estratégica. A recomendação é manter a disciplina gerencial, aprofundar análises de rentabilidade e risco, estruturar planejamento de longo prazo e usar os dados para expansão, sucessão e investimentos com maior segurança.",
  },
};

function mkScore(
  raw: number,
  max: number,
  bloco: keyof typeof DIAG,
): BlockScore {
  const pct = max > 0 ? Math.round((raw / max) * 100) : 0;
  const n = nivel(pct);
  return { percentual: pct, nivel: n, diagnostico: DIAG[bloco][n] };
}

export function calcularDiagnostico(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lead: Record<string, any>,
): DiagnosticoScore {
  // ── Bloco 1 — Operação ───────────────────────────────────────────────────
  let b1r = 0,
    b1m = 0;

  if (lead.temSiloArmazem != null) {
    b1m += 10;
    b1r += lead.temSiloArmazem ? 10 : 1;
  }

  if (lead.percentualArrendado != null) {
    b1m += 10;
    const p = lead.percentualArrendado as number;
    if (p === 0) b1r += 10;
    else if (p <= 30) b1r += 7;
    else if (p <= 60) b1r += 5;
    else b1r += 2;
  }

  if (
    Array.isArray(lead.operacoesTerceirizadas) &&
    lead.operacoesTerceirizadas.length > 0
  ) {
    b1m += 10;
    if ((lead.operacoesTerceirizadas as string[]).includes("nenhuma")) {
      b1r += 10;
    } else {
      b1r += Math.max(
        0,
        10 - (lead.operacoesTerceirizadas as string[]).length * 1.5,
      );
    }
  }

  // ── Bloco 2 — Custos ─────────────────────────────────────────────────────
  let b2r = 0,
    b2m = 0;

  if (lead.custosInsumosDiretos) {
    b2m += 10;
    if (lead.custosInsumosDiretos === "abaixo") b2r += 10;
    else if (lead.custosInsumosDiretos === "esperado") b2r += 7;
    else if (lead.custosInsumosDiretos === "altos") b2r += 3;
  }

  if (lead.hectaresPorTrabalhador != null) {
    b2m += 10;
    const h = lead.hectaresPorTrabalhador as number;
    if (h < 150) b2r += 1;
    else if (h <= 300) b2r += 5;
    else if (h <= 500) b2r += 8;
    else b2r += 10;
  }

  if (lead.travaAntecipada != null) {
    b2m += 10;
    b2r += lead.travaAntecipada ? 10 : 3;
  }

  if (lead.boaLeituraComercializacao != null) {
    b2m += 10;
    b2r += lead.boaLeituraComercializacao ? 10 : 1;
  }

  // ── Bloco 3 — Financeiro ─────────────────────────────────────────────────
  let b3r = 0,
    b3m = 0;

  b3m += 10;
  const frustracao = lead.frustracaoSafra as Record<string, unknown> | null;
  if (!frustracao || Object.keys(frustracao).length === 0) {
    b3r += 10;
  } else {
    const n = Object.keys(frustracao).length;
    if (n === 1) b3r += 6;
    else if (n === 2) b3r += 3;
    else b3r += 1;
  }

  if (lead.percentualCusteio) {
    b3m += 10;
    const c = lead.percentualCusteio as string;
    if (c === "Não utilizo Custeio") b3r += 10;
    else if (["10%", "20%", "30%"].includes(c)) b3r += 8;
    else if (["40%", "50%", "60%"].includes(c)) b3r += 5;
    else b3r += 2;
  }

  if (lead.captouMaisQuePageu) {
    b3m += 10;
    if (lead.captouMaisQuePageu === "nao_precisei") b3r += 10;
    else if (lead.captouMaisQuePageu === "nao") b3r += 7;
    else b3r += 1;
  }

  // ── Bloco 4 — Gestão ─────────────────────────────────────────────────────
  let b4r = 0,
    b4m = 0;

  if (lead.usaSoftwareGestao) {
    b4m += 10;
    if (lead.usaSoftwareGestao === "utilizo_confio") b4r += 10;
    else if (lead.usaSoftwareGestao === "so_escritorio") b4r += 5;
    else if (lead.usaSoftwareGestao === "utilizo_sem_seguranca") b4r += 3;
    // nao_utilizo → 0
  }

  if (lead.sabeCustoPorSaca != null) {
    b4m += 10;
    b4r += lead.sabeCustoPorSaca ? 10 : 1;
  }

  if (lead.clarezaCustos != null) {
    b4m += 10;
    b4r += lead.clarezaCustos ? 10 : 1;
  }

  if (lead.baseDecisoes) {
    b4m += 10;
    if (lead.baseDecisoes === "dados") b4r += 10;
    else if (lead.baseDecisoes === "ambos") b4r += 7;
    else b4r += 3;
  }

  if (lead.reuniaoFechamento != null) {
    b4m += 10;
    b4r += lead.reuniaoFechamento ? 10 : 1;
  }

  // ── Geral ─────────────────────────────────────────────────────────────────
  const pcts = [
    b1m > 0 ? (b1r / b1m) * 100 : null,
    b2m > 0 ? (b2r / b2m) * 100 : null,
    b3m > 0 ? (b3r / b3m) * 100 : null,
    b4m > 0 ? (b4r / b4m) * 100 : null,
  ].filter((v): v is number => v !== null);

  const geralPct =
    pcts.length > 0
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : 0;
  const geralNivel = nivel(geralPct);

  return {
    bloco1: mkScore(b1r, b1m, "bloco1"),
    bloco2: mkScore(b2r, b2m, "bloco2"),
    bloco3: mkScore(b3r, b3m, "bloco3"),
    bloco4: mkScore(b4r, b4m, "bloco4"),
    geral: {
      percentual: geralPct,
      nivel: geralNivel,
      diagnostico: DIAG.geral[geralNivel],
    },
  };
}
