import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";

// ─── Mapeamento de valores para labels legíveis ────────────────────────────────

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

function operacoes(v: unknown) {
  if (!Array.isArray(v) || v.length === 0) return "—";
  const MAP: Record<string, string> = {
    colheita: "Colheita", plantio: "Plantio", aplicacao: "Aplicação",
    transporte: "Transporte", nenhuma: "Nenhuma — tudo próprio",
  };
  return v.map((x) => MAP[x] ?? x).join(", ");
}

function custosInsumos(v: unknown) {
  const MAP: Record<string, string> = {
    abaixo: "Abaixo do mercado — boa negociação",
    esperado: "Na média do mercado",
    altos: "Acima do mercado",
  };
  return MAP[String(v)] ?? String(v ?? "—");
}

function haTrabalhador(v: unknown) {
  const n = Number(v);
  if (n < 150) return "Menos de 150 ha por colaborador";
  if (n <= 300) return "150 a 300 ha por colaborador";
  if (n <= 500) return "300 a 500 ha por colaborador";
  return "Mais de 500 ha por colaborador";
}

function frustracao(v: unknown) {
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
  };
  return MAP[String(v)] ?? String(v ?? "—");
}

function captou(v: unknown) {
  const MAP: Record<string, string> = {
    nao_precisei: "Não precisou de custeio — capital próprio",
    nao: "Quitou dentro do prazo em todas as safras",
    sim: "Precisou rolar ou renegociar em alguma safra",
  };
  return MAP[String(v)] ?? String(v ?? "—");
}

function software(v: unknown) {
  const MAP: Record<string, string> = {
    utilizo_confio: "Utiliza e confia nos dados — base para decisão",
    so_escritorio: "Somente o escritório usa — não acompanha",
    utilizo_sem_seguranca: "Utiliza, mas sem segurança nos lançamentos",
    nao_utilizo: "Não utiliza software de gestão",
  };
  return MAP[String(v)] ?? String(v ?? "—");
}

function baseDecisoes(v: unknown) {
  const MAP: Record<string, string> = {
    dados: "Principalmente em dados e relatórios",
    ambos: "Combinação de dados e experiência",
    experiencia: "Principalmente na experiência e intuição",
  };
  return MAP[String(v)] ?? String(v ?? "—");
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

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

interface Respostas {
  temSiloArmazem?: boolean;
  percentualArrendado?: number;
  operacoesTerceirizadas?: string[];
  custosInsumosDiretos?: string;
  hectaresPorTrabalhador?: number;
  travaAntecipada?: boolean;
  boaLeituraComercializacao?: boolean;
  frustracaoSafra?: Record<string, null>;
  percentualCusteio?: string;
  captouMaisQuePageu?: string;
  usaSoftwareGestao?: string;
  sabeCustoPorSaca?: boolean;
  clarezaCustos?: boolean;
  baseDecisoes?: string;
  reuniaoFechamento?: boolean;
}

const NIVEL_LABEL: Record<string, string> = {
  CRITICO: "Crítico", ATENCAO: "Atenção", BOM: "Bom", EXCELENTE: "Excelente",
};

const NIVEL_COR: Record<string, { bg: string; text: string; bar: string }> = {
  CRITICO:   { bg: "bg-red-50",   text: "text-red-700",   bar: "bg-red-500" },
  ATENCAO:   { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  BOM:       { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" },
  EXCELENTE: { bg: "bg-blue-50",  text: "text-blue-700",  bar: "bg-blue-500" },
};

// ─── Componentes ───────────────────────────────────────────────────────────────

function BlocoCard({ titulo, score, perguntas }: {
  titulo: string;
  score: BlockScore;
  perguntas: { label: string; resposta: string }[];
}) {
  const cor = NIVEL_COR[score.nivel] ?? NIVEL_COR.BOM;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-5 py-4 ${cor.bg} border-b border-gray-100`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{titulo}</h3>
          <div className="flex items-center gap-3">
            <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cor.bar}`} style={{ width: `${score.percentual}%` }} />
            </div>
            <span className={`text-sm font-bold ${cor.text}`}>{score.percentual}%</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor.bg} ${cor.text} border border-current/20`}>
              {NIVEL_LABEL[score.nivel] ?? score.nivel}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">{score.diagnostico}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {perguntas.map((p) => (
          <div key={p.label} className="px-5 py-3 flex gap-4">
            <span className="text-xs text-gray-500 w-48 shrink-0">{p.label}</span>
            <span className="text-sm text-gray-800 font-medium">{p.resposta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

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
  const r = c.respostas ?? {};
  const nome = diagnostico.titulo.replace(/^Diagn[oó]stico\s*[—-]\s*/i, "");

  // Busca dados do lead para email/telefone
  const lead = c.lead_id
    ? await prisma.lead.findUnique({ where: { id: c.lead_id }, select: { email: true, telefone: true } })
    : null;

  const geralCor = NIVEL_COR[score?.geral?.nivel ?? "BOM"] ?? NIVEL_COR.BOM;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Voltar */}
      <Link href="/diagnosticos/conselho-agro" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        ← Voltar à lista
      </Link>

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{nome}</h1>
          <div className="flex gap-4 mt-1 text-sm text-gray-500">
            {lead?.email && <span>{lead.email}</span>}
            {lead?.telefone && <span>{lead.telefone}</span>}
            <span>{diagnostico.criado_em.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>
        </div>
        {score?.geral && (
          <div className={`text-center px-6 py-3 rounded-xl ${geralCor.bg} shrink-0`}>
            <p className={`text-3xl font-black ${geralCor.text}`}>{score.geral.percentual}%</p>
            <p className={`text-xs font-semibold ${geralCor.text}`}>{NIVEL_LABEL[score.geral.nivel] ?? score.geral.nivel}</p>
          </div>
        )}
      </div>

      {/* Blocos */}
      {score && (
        <div className="flex flex-col gap-4">
          <BlocoCard
            titulo="Bloco 1 — Operação"
            score={score.bloco1}
            perguntas={[
              { label: "Silo ou armazém próprio", resposta: bool(r.temSiloArmazem) },
              { label: "Área arrendada", resposta: arrendado(r.percentualArrendado) },
              { label: "Operações terceirizadas", resposta: operacoes(r.operacoesTerceirizadas) },
            ]}
          />
          <BlocoCard
            titulo="Bloco 2 — Custos & Comercialização"
            score={score.bloco2}
            perguntas={[
              { label: "Custos de insumos diretos", resposta: custosInsumos(r.custosInsumosDiretos) },
              { label: "Produtividade de mão de obra", resposta: haTrabalhador(r.hectaresPorTrabalhador) },
              { label: "Trava antecipada de insumos/produção", resposta: bool(r.travaAntecipada) },
              { label: "Leitura do mercado de comercialização", resposta: bool(r.boaLeituraComercializacao) },
            ]}
          />
          <BlocoCard
            titulo="Bloco 3 — Financeiro"
            score={score.bloco3}
            perguntas={[
              { label: "Frustração de safra (últimos 3 anos)", resposta: frustracao(r.frustracaoSafra) },
              { label: "Percentual de custeio bancário", resposta: custeio(r.percentualCusteio) },
              { label: "Captou mais do que conseguiu pagar", resposta: captou(r.captouMaisQuePageu) },
            ]}
          />
          <BlocoCard
            titulo="Bloco 4 — Gestão"
            score={score.bloco4}
            perguntas={[
              { label: "Uso de software de gestão", resposta: software(r.usaSoftwareGestao) },
              { label: "Conhece o custo por saca", resposta: bool(r.sabeCustoPorSaca) },
              { label: "Clareza sobre todas as despesas", resposta: bool(r.clarezaCustos) },
              { label: "Base das decisões de gestão", resposta: baseDecisoes(r.baseDecisoes) },
              { label: "Reunião de fechamento de safra", resposta: bool(r.reuniaoFechamento) },
            ]}
          />
        </div>
      )}
    </div>
  );
}
