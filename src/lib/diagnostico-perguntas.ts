export interface Opcao {
  valor: number;
  texto: string;
}

export interface Pergunta {
  id: string;
  texto: string;
  opcoes: Opcao[];
}

export interface Modulo {
  chave: string;
  label: string;
  descricao: string;
  icone: string;
  perguntas: Pergunta[];
}

export const PERGUNTAS: Modulo[] = [
  {
    chave: "financeiro",
    label: "Gestão Financeira",
    descricao: "Como você controla os recursos da sua propriedade/empresa.",
    icone: "💰",
    perguntas: [
      {
        id: "fin_1",
        texto: "Como você controla as finanças da sua propriedade/empresa?",
        opcoes: [
          { valor: 1, texto: "Não controlo / faço na memória" },
          { valor: 2, texto: "Uso caderno ou planilha simples" },
          { valor: 3, texto: "Planilha organizada por categorias" },
          { valor: 4, texto: "Sistema de gestão financeira atualizado" },
        ],
      },
      {
        id: "fin_2",
        texto: "Você conhece o custo de produção por hectare, cabeça ou unidade?",
        opcoes: [
          { valor: 1, texto: "Não calculo / não sei" },
          { valor: 2, texto: "Tenho uma ideia aproximada" },
          { valor: 3, texto: "Calculo periodicamente" },
          { valor: 4, texto: "Calculo com precisão e monitoro sempre" },
        ],
      },
      {
        id: "fin_3",
        texto: "Você tem controle de fluxo de caixa atualizado?",
        opcoes: [
          { valor: 1, texto: "Não tenho" },
          { valor: 2, texto: "Controlo esporadicamente" },
          { valor: 3, texto: "Controlo mensalmente" },
          { valor: 4, texto: "Controlo semanalmente ou em tempo real" },
        ],
      },
      {
        id: "fin_4",
        texto: "Você separa as finanças pessoais das empresariais?",
        opcoes: [
          { valor: 1, texto: "Não separo" },
          { valor: 2, texto: "Separo às vezes" },
          { valor: 3, texto: "Separo na maioria das vezes" },
          { valor: 4, texto: "Sempre totalmente separado" },
        ],
      },
    ],
  },
  {
    chave: "estrategico",
    label: "Gestão Estratégica",
    descricao: "Planejamento, metas e tomada de decisão.",
    icone: "🎯",
    perguntas: [
      {
        id: "est_1",
        texto: "Você tem metas claras e documentadas para os próximos 12 meses?",
        opcoes: [
          { valor: 1, texto: "Não tenho metas definidas" },
          { valor: 2, texto: "Tenho metas mentais, não escritas" },
          { valor: 3, texto: "Tenho metas escritas" },
          { valor: 4, texto: "Tenho metas escritas com indicadores e prazo" },
        ],
      },
      {
        id: "est_2",
        texto: "Como você toma decisões de investimento na sua propriedade?",
        opcoes: [
          { valor: 1, texto: "Por intuição ou pressão do momento" },
          { valor: 2, texto: "Consulto outros produtores / experiência" },
          { valor: 3, texto: "Analiso custos e retorno esperado" },
          { valor: 4, texto: "Faço análise financeira detalhada antes de decidir" },
        ],
      },
      {
        id: "est_3",
        texto: "Você revisa os resultados da sua operação regularmente?",
        opcoes: [
          { valor: 1, texto: "Raramente ou nunca" },
          { valor: 2, texto: "Anualmente" },
          { valor: 3, texto: "Semestralmente ou trimestralmente" },
          { valor: 4, texto: "Mensalmente com indicadores definidos" },
        ],
      },
      {
        id: "est_4",
        texto: "Você tem um planejamento de safra / ciclo produtivo documentado?",
        opcoes: [
          { valor: 1, texto: "Não planejo com antecedência" },
          { valor: 2, texto: "Planejo mentalmente" },
          { valor: 3, texto: "Tenho um plano escrito básico" },
          { valor: 4, texto: "Tenho planejamento detalhado com cronograma e orçamento" },
        ],
      },
    ],
  },
  {
    chave: "pessoas",
    label: "Gestão de Pessoas",
    descricao: "Equipe, processos e capacitação.",
    icone: "👥",
    perguntas: [
      {
        id: "pes_1",
        texto: "Como está organizada sua equipe de trabalho?",
        opcoes: [
          { valor: 1, texto: "Não tenho equipe definida / trabalho sozinho" },
          { valor: 2, texto: "Tenho funcionários mas sem função clara" },
          { valor: 3, texto: "Cada um tem sua função definida" },
          { valor: 4, texto: "Funções claras, metas individuais e avaliação de desempenho" },
        ],
      },
      {
        id: "pes_2",
        texto: "Os processos da sua operação estão documentados?",
        opcoes: [
          { valor: 1, texto: "Nada documentado" },
          { valor: 2, texto: "Alguns processos-chave documentados" },
          { valor: 3, texto: "Principais processos documentados" },
          { valor: 4, texto: "Todos os processos documentados e revisados periodicamente" },
        ],
      },
      {
        id: "pes_3",
        texto: "Você investe em capacitação e treinamento da equipe?",
        opcoes: [
          { valor: 1, texto: "Não invisto" },
          { valor: 2, texto: "Raramente / apenas quando necessário" },
          { valor: 3, texto: "Anualmente" },
          { valor: 4, texto: "Regularmente com plano de desenvolvimento" },
        ],
      },
      {
        id: "pes_4",
        texto: "Como é seu processo de contratação e retenção de talentos?",
        opcoes: [
          { valor: 1, texto: "Sem processo definido" },
          { valor: 2, texto: "Informal, por indicação" },
          { valor: 3, texto: "Tenho critérios básicos de seleção" },
          { valor: 4, texto: "Processo estruturado com integração e acompanhamento" },
        ],
      },
    ],
  },
  {
    chave: "mercado",
    label: "Mercado e Comercialização",
    descricao: "Como você vende e se posiciona no mercado.",
    icone: "📈",
    perguntas: [
      {
        id: "mer_1",
        texto: "Como você vende sua produção / serviços?",
        opcoes: [
          { valor: 1, texto: "Vendo para quem aparece / oportunidade" },
          { valor: 2, texto: "Tenho compradores fixos informais" },
          { valor: 3, texto: "Tenho contratos de venda" },
          { valor: 4, texto: "Tenho estratégia diversificada com contratos e venda direta" },
        ],
      },
      {
        id: "mer_2",
        texto: "Você acompanha os preços e tendências do mercado?",
        opcoes: [
          { valor: 1, texto: "Não acompanho" },
          { valor: 2, texto: "Esporadicamente" },
          { valor: 3, texto: "Semanalmente" },
          { valor: 4, texto: "Diariamente com fontes confiáveis" },
        ],
      },
      {
        id: "mer_3",
        texto: "Você tem estratégia de marketing e presença digital?",
        opcoes: [
          { valor: 1, texto: "Nenhuma presença digital" },
          { valor: 2, texto: "Perfil básico em redes sociais" },
          { valor: 3, texto: "Conteúdo regular nas redes e relacionamento com clientes" },
          { valor: 4, texto: "Estratégia estruturada com geração de leads e branding" },
        ],
      },
      {
        id: "mer_4",
        texto: "Você conhece os diferenciais da sua propriedade/empresa frente à concorrência?",
        opcoes: [
          { valor: 1, texto: "Não penso nisso" },
          { valor: 2, texto: "Tenho uma ideia vaga" },
          { valor: 3, texto: "Sei meus pontos fortes" },
          { valor: 4, texto: "Tenho posicionamento claro e comunico ativamente" },
        ],
      },
    ],
  },
];

// ─── Pontuação ────────────────────────────────────────────────────────────────

export function calcularPontuacao(respostas: Record<string, number>) {
  const modulosResult: Record<string, { obtido: number; maximo: number; label: string }> = {};
  let totalObtido = 0;
  let totalMaximo = 0;

  for (const modulo of PERGUNTAS) {
    let obtido = 0;
    const maximo = modulo.perguntas.length * 4;
    for (const p of modulo.perguntas) {
      obtido += respostas[p.id] ?? 1;
    }
    modulosResult[modulo.chave] = { obtido, maximo, label: modulo.label };
    totalObtido += obtido;
    totalMaximo += maximo;
  }

  return { total: totalObtido, maximo: totalMaximo, modulos: modulosResult };
}

// ─── Recomendações ────────────────────────────────────────────────────────────

export function gerarRecomendacoes(
  pontuacao: ReturnType<typeof calcularPontuacao>,
  respostas: Record<string, number>
): string[] {
  const recs: string[] = [];

  const { modulos } = pontuacao;

  if (modulos.financeiro.obtido / modulos.financeiro.maximo < 0.6) {
    recs.push("Implante um controle financeiro básico — comece pelo fluxo de caixa semanal e separe as contas pessoais das empresariais.");
  }
  if (modulos.estrategico.obtido / modulos.estrategico.maximo < 0.6) {
    recs.push("Defina metas claras para os próximos 12 meses com indicadores mensuráveis e revise-as mensalmente.");
  }
  if (modulos.pessoas.obtido / modulos.pessoas.maximo < 0.6) {
    recs.push("Documente os processos-chave da sua operação e defina funções claras para cada membro da equipe.");
  }
  if (modulos.mercado.obtido / modulos.mercado.maximo < 0.6) {
    recs.push("Desenvolva sua presença digital e estabeleça contratos de venda para garantir previsibilidade de receita.");
  }

  const percentual = Math.round((pontuacao.total / pontuacao.maximo) * 100);
  if (percentual >= 75) {
    recs.push("Você já tem uma base sólida de gestão — o próximo passo é profissionalizar ainda mais com assessoria especializada.");
  } else if (percentual >= 50) {
    recs.push("Você está no caminho certo. Com uma gestão mais estruturada, pode aumentar sua rentabilidade em até 30%.");
  } else {
    recs.push("Existe um grande potencial de melhoria na sua gestão. Pequenas mudanças de processo podem gerar grandes resultados.");
  }

  if (recs.length === 0) {
    recs.push("Continue investindo em gestão — é o que diferencia os negócios que prosperam no longo prazo.");
  }

  return recs;
}
