import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";

// ─── Formatadores ──────────────────────────────────────────────────────────────

function bool(v: unknown) {
  return v === true ? "Sim" : v === false ? "Não" : "—";
}

function arrendado(v: unknown) {
  const n = Number(v);
  if (n === 0) return "Tudo próprio — sem área arrendada";
  if (n <= 30) return "Até 30% da área arrendada";
  if (n <= 60) return "30% a 60% da área arrendada";
  return "Mais de 60% da área arrendada";
}

function operacoes(v: unknown, atividade?: string, sistema?: string) {
  if (!Array.isArray(v) || v.length === 0) return "—";
  const MAP: Record<string, string> = {
    colheita: "Colheita", plantio: "Plantio", aplicacao: "Aplicação",
    transporte: "Transporte", nenhuma: "Nenhuma — tudo próprio",
    peao: "Peão", sanitario: "Manejo sanitário", suplementacao: "Suplementação",
    nutricao: "Formulação de dieta / nutrição", compra: "Compra de animais",
  };
  void atividade; void sistema;
  return v.map((x) => MAP[x] ?? x).join(", ");
}

function atividadeLabel(v: unknown) {
  const MAP: Record<string, string> = {
    soja: "Soja", milho: "Milho", algodao: "Algodão",
    cana: "Cana-de-açúcar", gado: "Gado", outro: "Outro",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function sistemaLabel(v: unknown) {
  const MAP: Record<string, string> = {
    pasto: "Boi a pasto", semi: "Semi-confinado", confinado: "Confinamento",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function custoInsumos(v: unknown, atividade?: string) {
  if (!v) return "—";
  // Old format
  const OLD: Record<string, string> = {
    abaixo: "Abaixo do mercado — boa negociação",
    esperado: "Na média do mercado",
    altos: "Acima do mercado",
  };
  if (OLD[String(v)]) return OLD[String(v)];
  // New format — pass value as-is with unit hint
  const unidades: Record<string, string> = { soja: "sc/ha", milho: "sc/ha", algodao: "@/ha", cana: "TCH/ha", gado: "@/UA/ano" };
  const u = unidades[String(atividade ?? "")] ?? "";
  return `${String(v).replace("lte", "≤ ").replace("gte", "≥ ").replace("_", " a ")} ${u}`.trim();
}

function frustracao(v: unknown) {
  if (typeof v === "number") {
    if (v === 0) return "Nenhuma — sem perdas relevantes";
    if (v === 1) return "1 safra / evento afetado nos últimos 3 anos";
    if (v === 2) return "2 safras / eventos afetados";
    return "3 ou mais safras / eventos afetados";
  }
  if (!v || typeof v !== "object") return "Nenhuma — sem perdas relevantes";
  const n = Object.keys(v as object).length;
  if (n === 0) return "Nenhuma — sem perdas relevantes";
  if (n === 1) return "1 safra afetada nos últimos 3 anos";
  if (n === 2) return "2 safras afetadas";
  return "3 ou mais safras afetadas";
}

function custeio(v: unknown) {
  const MAP: Record<string, string> = {
    "Não utilizo Custeio": "Não utiliza custeio bancário",
    "10%": "Até 30% do custo financiado",
    "40%": "30% a 60% do custo financiado",
    "70%": "Mais de 60% do custo financiado",
    nao_utilizo: "Não utiliza custeio bancário",
    "25": "Aproximadamente 25%",
    "26_50": "Entre 26% e 50%",
    "51_75": "Entre 51% e 75%",
    "76_100": "Entre 76% e 100%",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function captacoes(v: unknown) {
  const MAP: Record<string, string> = {
    nao_precisei: "Não precisou de custeio — capital próprio",
    nao: "Quitou dentro do prazo em todas as safras",
    sim: "Precisou rolar ou renegociar em alguma safra",
    diminuiu: "Diminuíram ou se mantiveram — saúde estável",
    aumentou: "Aumentaram — cresceu a dependência de crédito",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function software(v: unknown) {
  const MAP: Record<string, string> = {
    utilizo_confio: "Utiliza e confia nos dados — base para decisão",
    so_escritorio: "Somente o escritório usa — não acompanha",
    utilizo_sem_seguranca: "Utiliza, mas sem segurança nos lançamentos",
    nao_utilizo: "Não utiliza software de gestão",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function baseDecisoes(v: unknown) {
  const MAP: Record<string, string> = {
    dados: "Principalmente em dados e relatórios",
    ambos: "Combinação de dados e experiência",
    experiencia: "Principalmente na experiência e intuição",
  };
  return MAP[String(v ?? "")] ?? String(v ?? "—");
}

function haTrabalhador(v: unknown) {
  const n = Number(v);
  if (n < 150) return "Menos de 150 ha por colaborador";
  if (n <= 300) return "150 a 300 ha por colaborador";
  if (n <= 500) return "300 a 500 ha por colaborador";
  return "Mais de 500 ha por colaborador";
}

function readableKey(k: string): string {
  const MAP: Record<string, string> = {
    lte08: "< 0,8 UA/ha", "08_12": "0,8 a 1,2 UA/ha", "12_20": "1,2 a 2,0 UA/ha", gte20: "> 2,0 UA/ha",
    lte40: "< 40%", "40_55": "40% a 55%", "55_70": "55% a 70%", gte70: "> 70%",
    lte20: "< 20%", "20_40": "20% a 40%", "40_60": "40% a 60%", gte60: "> 60%",
    lte2: "< 2 meses", "2_4": "2 a 4 meses", "4_6": "4 a 6 meses", gte6: "> 6 meses",
    lte90: "< 90 dias", "90_120": "90 a 120 dias", "120_150": "120 a 150 dias", gte150: "> 150 dias",
    lte6: "≤ 6:1", "6_7": "6 a 7:1", "7_8": "7 a 8:1", "8_9": "8 a 9:1", gte9: "> 9:1",
    lte90r: "≤ R$ 90/@", "90_110": "R$ 90 a 110/@", "110_130": "R$ 110 a 130/@", "130_150": "R$ 130 a 150/@", gte150r: "> R$ 150/@",
  };
  return MAP[k] ?? k.replace(/_/g, " a ").replace(/lte/, "≤ ").replace(/gte/, "≥ ");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BlockScore {
  percentual: number;
  nivel: string;
  diagnostico: string;
}

interface Score {
  bloco1: BlockScore;
  bloco2: BlockScore;
  bloco3: BlockScore;
  bloco4: BlockScore;
  geral: BlockScore;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Respostas = Record<string, any>;

const NIVEL_LABEL: Record<string, string> = {
  CRITICO: "Crítico", ATENCAO: "Atenção", BOM: "Bom", EXCELENTE: "Excelente",
};

const NIVEL_COR: Record<string, { bg: string; text: string; bar: string }> = {
  CRITICO:   { bg: "bg-red-50",   text: "text-red-700",   bar: "bg-red-500" },
  ATENCAO:   { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  BOM:       { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" },
  EXCELENTE: { bg: "bg-blue-50",  text: "text-blue-700",  bar: "bg-blue-500" },
};

// ─── Componentes ──────────────────────────────────────────────────────────────

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="px-5 py-3 flex gap-4 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-52 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{valor || "—"}</span>
    </div>
  );
}

function Bloco({ titulo, score, children }: { titulo: string; score?: BlockScore; children: React.ReactNode }) {
  const cor = score ? (NIVEL_COR[score.nivel] ?? NIVEL_COR.BOM) : null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-5 py-4 ${cor ? cor.bg : "bg-gray-50"} border-b border-gray-100`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{titulo}</h3>
          {score && cor && (
            <div className="flex items-center gap-3">
              <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cor.bar}`} style={{ width: `${score.percentual}%` }} />
              </div>
              <span className={`text-sm font-bold ${cor.text}`}>{score.percentual}%</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor.bg} ${cor.text} border border-current/20`}>
                {NIVEL_LABEL[score.nivel] ?? score.nivel}
              </span>
            </div>
          )}
        </div>
        {score?.diagnostico && (
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{score.diagnostico}</p>
        )}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function ConselhoAgroDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresaId = await obterEmpresaAtiva();

  const diagnostico = await prisma.diagnostico.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!diagnostico) notFound();

  const c = (diagnostico.conteudo ?? {}) as {
    lead_id?: string;
    score?: Score;
    respostas?: Respostas;
  };

  const score = c.score;
  const r: Respostas = c.respostas ?? {};
  const nome = diagnostico.titulo.replace(/^Diagn[oó]stico\s*[—-]\s*/i, "");

  const lead = c.lead_id
    ? await prisma.lead.findUnique({ where: { id: c.lead_id }, select: { email: true, telefone: true } })
    : null;

  const geralCor = NIVEL_COR[score?.geral?.nivel ?? "BOM"] ?? NIVEL_COR.BOM;

  // Detect format: new format has `atividade` field
  const isNewFormat = Boolean(r.atividade);
  const atividade = String(r.atividade ?? "");
  const sistema = String(r.sistemaGado ?? "");
  const isGado = atividade === "gado";
  const isConfinado = isGado && sistema === "confinado";

  // Compat: support old and new field names
  const temEstruturaPropria = r.temEstruturaPropria ?? r.temSiloArmazem;
  const custoInsumosVal = r.custoInsumos ?? r.custosInsumosDiretos;
  const travaVal = r.travaComercializacao ?? r.travaAntecipada;
  const mercadoVal = r.boaLeituraMercado ?? r.boaLeituraComercializacao;
  const captacoesVal = r.captacoes ?? r.captouMaisQuePageu;
  const sabeCustoVal = r.sabeCustoPorUnidade ?? r.sabeCustoPorSaca;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/diagnosticos/conselho-agro" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        ← Voltar à lista
      </Link>

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{nome}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
            {lead?.email && <span>{lead.email}</span>}
            {lead?.telefone && <span>{lead.telefone}</span>}
            <span>{diagnostico.criado_em.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>
          {isNewFormat && (
            <div className="flex gap-2 mt-2">
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                {atividadeLabel(atividade)}
              </span>
              {isGado && sistema && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                  {sistemaLabel(sistema)}
                </span>
              )}
            </div>
          )}
        </div>
        {score?.geral && (
          <div className={`text-center px-6 py-3 rounded-xl ${geralCor.bg} shrink-0`}>
            <p className={`text-3xl font-black ${geralCor.text}`}>{score.geral.percentual}%</p>
            <p className={`text-xs font-semibold ${geralCor.text}`}>{NIVEL_LABEL[score.geral.nivel] ?? score.geral.nivel}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">

        {/* Bloco 1 — Operação */}
        <Bloco titulo="Bloco 1 — Operação & Produção" score={isNewFormat ? undefined : score?.bloco1}>
          <Campo label="Estrutura própria" valor={bool(temEstruturaPropria)} />
          <Campo label="Área arrendada" valor={arrendado(r.percentualArrendado)} />
          {r.arrendamentoValor && (
            <Campo
              label="Arrendamento por ha"
              valor={`${r.arrendamentoValor} ${r.arrendamentoUnidade === "arrobas" ? "@ / ha" : "sc soja / ha"}`}
            />
          )}
          <Campo label="Operações terceirizadas" valor={operacoes(r.operacoesTerceirizadas, atividade, sistema)} />
          {/* Produção — grãos, algodão, cana */}
          {r.producaoMedia && !isGado && (
            <Campo
              label="Produção média"
              valor={`${r.producaoMedia} ${atividade === "cana" ? "TCH" : atividade === "algodao" ? "@/ha" : "sc/ha"}`}
            />
          )}
          {/* Pasto / Semi */}
          {r.taxaLotacao && <Campo label="Taxa de lotação" valor={readableKey(r.taxaLotacao)} />}
          {r.taxaDesfrute && <Campo label="Taxa de desfrute" valor={readableKey(r.taxaDesfrute)} />}
          {r.pastageDegradada && <Campo label="Pastagem degradada" valor={readableKey(r.pastageDegradada)} />}
          {r.mesesSemiConf && <Campo label="Meses semi-confinamento" valor={readableKey(r.mesesSemiConf)} />}
          {/* Confinado */}
          {r.gpdMedio && <Campo label="GPD médio (kg/dia)" valor={String(r.gpdMedio)} />}
          {r.diasConfinamento && <Campo label="Dias de confinamento/lote" valor={readableKey(r.diasConfinamento)} />}
        </Bloco>

        {/* Bloco 2 — Custos */}
        <Bloco titulo="Bloco 2 — Custos & Comercialização" score={isNewFormat ? undefined : score?.bloco2}>
          {isConfinado ? (
            <>
              {r.conversaoAlimentar && <Campo label="Conversão alimentar" valor={readableKey(r.conversaoAlimentar)} />}
              {r.custoDietaArroba && <Campo label="Custo da dieta (R$/@)" valor={readableKey(r.custoDietaArroba)} />}
            </>
          ) : (
            <Campo label="Custo de insumos diretos" valor={custoInsumos(custoInsumosVal, atividade)} />
          )}
          <Campo label="Produtividade de mão de obra" valor={haTrabalhador(r.hectaresPorTrabalhador)} />
          <Campo label="Trava / proteção comercial" valor={bool(travaVal)} />
          <Campo label="Leitura de mercado / negociação" valor={bool(mercadoVal)} />
        </Bloco>

        {/* Bloco 3 — Financeiro */}
        <Bloco titulo="Bloco 3 — Financeiro" score={isNewFormat ? undefined : score?.bloco3}>
          <Campo label="Frustração de safra / evento crítico" valor={frustracao(r.frustracaoSafra ?? r.frustracaoSafraIdx)} />
          {r.sacasPerdidas != null && (
            <Campo
              label="Perda média nos anos afetados"
              valor={`${r.sacasPerdidas} ${atividade === "cana" ? "TCH/ha" : atividade === "algodao" ? "@/ha" : atividade === "gado" ? "arrobas" : "sacas/ha"}`}
            />
          )}
          <Campo label="Percentual de custeio bancário" valor={custeio(r.percentualCusteio)} />
          <Campo label="Captações nos últimos 3 anos" valor={captacoes(captacoesVal)} />
        </Bloco>

        {/* Bloco 4 — Gestão */}
        <Bloco titulo="Bloco 4 — Gestão" score={isNewFormat ? undefined : score?.bloco4}>
          <Campo label="Uso de software de gestão" valor={software(r.usaSoftwareGestao)} />
          <Campo label="Conhece custo por unidade produzida" valor={bool(sabeCustoVal)} />
          <Campo label="Clareza sobre todas as despesas" valor={bool(r.clarezaCustos)} />
          <Campo label="Base das decisões de gestão" valor={baseDecisoes(r.baseDecisoes)} />
          <Campo label="Reunião de fechamento de safra" valor={bool(r.reuniaoFechamento)} />
        </Bloco>

      </div>
    </div>
  );
}
