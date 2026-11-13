import type { CellDef, RowInput } from "jspdf-autotable";

type Vista = "dia" | "mensal" | "prevreal";

interface LancamentoPdf {
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  referencia: string;
  valor: number;
  data: string;
  situacao: "Previsto" | "Realizado" | "Simulação";
}

interface SomaMes {
  label: string;
  entradas: number;
  saidas: number;
  entPrev: number;
  entReal: number;
  saiPrev: number;
  saiReal: number;
}

interface LinhaDfc {
  tipo: "ENTRADA" | "SAIDA";
  nome: string;
  mes: Record<string, number>;
}

export interface DadosPdfFluxoCaixa {
  empresaNome: string;
  de: string;
  ate: string;
  vista: Vista;
  tipoFiltroLabel: string;
  saldoAnterior: number;
  totalEntradas: number;
  totalSaidas: number;
  meses: { key: string; label: string }[];
  somasMes: SomaMes[];
  dfcRows: LinhaDfc[];
  lancamentos: LancamentoPdf[];
}

const AZUL: [number, number, number] = [27, 79, 114];
const AZUL_CLARO: [number, number, number] = [234, 242, 248];
const CINZA: [number, number, number] = [100, 116, 139];
const TEXTO: [number, number, number] = [30, 41, 59];

const TITULOS: Record<Vista, string> = {
  dia: "Dia a dia",
  mensal: "DFC Mensal",
  prevreal: "Previsto x Realizado",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
// Valores nulos aparecem como traço para não poluir a tabela.
const valorOuTraco = (v: number) => (Math.abs(v) < 0.005 ? "-" : brl(v));

function linhaDestaque(cells: (string | number)[], fill: [number, number, number], cor: [number, number, number]): CellDef[] {
  return cells.map((c) => ({
    content: String(c),
    styles: { fillColor: fill, textColor: cor, fontStyle: "bold" },
  }));
}

function corpoMensal(d: DadosPdfFluxoCaixa): { head: RowInput[]; body: RowInput[] } {
  const head: RowInput[] = [["Conta / Cliente", ...d.meses.map((m) => m.label), "Total"]];
  const body: RowInput[] = [];
  const linhaConta = (r: LinhaDfc) => {
    const total = Object.values(r.mes).reduce((s, v) => s + v, 0);
    return [r.nome || "-", ...d.meses.map((m) => valorOuTraco(r.mes[m.key] ?? 0)), valorOuTraco(total)];
  };

  body.push(linhaDestaque(["ENTRADAS", ...d.somasMes.map((m) => brl(m.entradas)), brl(d.totalEntradas)], AZUL_CLARO, AZUL));
  d.dfcRows.filter((r) => r.tipo === "ENTRADA").sort((a, b) => a.nome.localeCompare(b.nome)).forEach((r) => body.push(linhaConta(r)));
  body.push(linhaDestaque(["SAÍDAS", ...d.somasMes.map((m) => brl(m.saidas)), brl(d.totalSaidas)], [254, 243, 235], [194, 65, 12]));
  d.dfcRows.filter((r) => r.tipo === "SAIDA").sort((a, b) => a.nome.localeCompare(b.nome)).forEach((r) => body.push(linhaConta(r)));

  body.push(linhaDestaque(
    ["= Diferença", ...d.somasMes.map((m) => brl(m.entradas - m.saidas)), brl(d.totalEntradas - d.totalSaidas)],
    [241, 245, 249], TEXTO,
  ));
  let acum = d.saldoAnterior;
  const acumulados = d.somasMes.map((m) => { acum += m.entradas - m.saidas; return brl(acum); });
  body.push(linhaDestaque(["Saldo acumulado", ...acumulados, brl(acum)], AZUL, [255, 255, 255]));
  return { head, body };
}

function corpoPrevReal(d: DadosPdfFluxoCaixa): { head: RowInput[]; body: RowInput[] } {
  const head: RowInput[] = [["", ...d.meses.map((m) => m.label), "Total"]];
  const soma = (f: (m: SomaMes) => number) => d.somasMes.reduce((s, m) => s + f(m), 0);
  const linha = (rotulo: string, f: (m: SomaMes) => number) =>
    [rotulo, ...d.somasMes.map((m) => valorOuTraco(f(m))), valorOuTraco(soma(f))];
  const body: RowInput[] = [
    linhaDestaque(["ENTRADAS", ...d.meses.map(() => ""), ""], AZUL_CLARO, AZUL),
    linha("Previstas", (m) => m.entPrev),
    linha("Realizadas", (m) => m.entReal),
    linhaDestaque(["SAÍDAS", ...d.meses.map(() => ""), ""], [254, 243, 235], [194, 65, 12]),
    linha("Previstas", (m) => m.saiPrev),
    linha("Realizadas", (m) => m.saiReal),
    linhaDestaque(["Saldo previsto", ...d.somasMes.map((m) => brl(m.entPrev - m.saiPrev)), brl(soma((m) => m.entPrev - m.saiPrev))], [241, 245, 249], TEXTO),
    linhaDestaque(["Saldo realizado", ...d.somasMes.map((m) => brl(m.entReal - m.saiReal)), brl(soma((m) => m.entReal - m.saiReal))], AZUL, [255, 255, 255]),
  ];
  return { head, body };
}

function corpoDia(d: DadosPdfFluxoCaixa): { head: RowInput[]; body: RowInput[] } {
  const head: RowInput[] = [["Data", "Descrição", "Cliente / Fornecedor", "Situação", "Entrada", "Saída", "Saldo"]];
  const body: RowInput[] = [];
  let saldo = d.saldoAnterior;
  body.push(linhaDestaque(["", "Saldo anterior", "", "", "", "", brl(saldo)], [241, 245, 249], TEXTO));
  const ordenados = [...d.lancamentos].sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  for (const l of ordenados) {
    saldo += l.tipo === "ENTRADA" ? l.valor : -l.valor;
    body.push([
      dataBR(l.data),
      l.descricao,
      l.referencia || "-",
      l.situacao,
      l.tipo === "ENTRADA" ? brl(l.valor) : "",
      l.tipo === "SAIDA" ? brl(l.valor) : "",
      { content: brl(saldo), styles: { textColor: saldo < 0 ? [220, 38, 38] : TEXTO } },
    ]);
  }
  body.push(linhaDestaque(["", "Saldo final", "", "", brl(d.totalEntradas), brl(d.totalSaidas), brl(saldo)], AZUL, [255, 255, 255]));
  return { head, body };
}

export function nomeArquivoPdfFluxoCaixa(d: Pick<DadosPdfFluxoCaixa, "vista" | "de" | "ate">): string {
  return `fluxo-de-caixa_${TITULOS[d.vista].toLowerCase().replace(/\s+/g, "-")}_${d.de}_a_${d.ate}.pdf`;
}

export async function gerarPdfFluxoCaixa(d: DadosPdfFluxoCaixa): Promise<void> {
  const doc = await montarPdfFluxoCaixa(d);
  doc.save(nomeArquivoPdfFluxoCaixa(d));
}

export async function montarPdfFluxoCaixa(d: DadosPdfFluxoCaixa) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const paisagem = d.vista !== "dia";
  const doc = new jsPDF({ orientation: paisagem ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 12;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...AZUL);
  doc.text(d.empresaNome, margem, 16);
  doc.setFontSize(16);
  doc.text("FLUXO DE CAIXA", largura - margem, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(`${TITULOS[d.vista]} · ${dataBR(d.de)} a ${dataBR(d.ate)} · Lançamentos: ${d.tipoFiltroLabel}`, largura - margem, 22, { align: "right" });
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(margem, 26, largura - margem, 26);

  // Resumo
  const saldoPeriodo = d.totalEntradas - d.totalSaidas;
  const kpis: [string, number][] = [
    ["Saldo anterior", d.saldoAnterior],
    ["Entradas", d.totalEntradas],
    ["Saídas", d.totalSaidas],
    ["Saldo do período", saldoPeriodo],
    ["Saldo final", d.saldoAnterior + saldoPeriodo],
  ];
  const larguraKpi = (largura - margem * 2) / kpis.length;
  kpis.forEach(([rotulo, valor], i) => {
    const x = margem + i * larguraKpi;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x + 1, 30, larguraKpi - 2, 15, 1.5, 1.5, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(rotulo.toUpperCase(), x + 4, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...(valor < 0 ? ([220, 38, 38] as [number, number, number]) : TEXTO));
    doc.text(brl(valor), x + 4, 41.5);
    doc.setFont("helvetica", "normal");
  });

  const { head, body } = d.vista === "mensal" ? corpoMensal(d) : d.vista === "prevreal" ? corpoPrevReal(d) : corpoDia(d);
  const colunasValor = d.vista === "dia" ? [4, 5, 6] : Array.from({ length: d.meses.length + 1 }, (_, i) => i + 1);
  const colunasDireita = Object.fromEntries(colunasValor.map((i) => [i, { halign: "right" as const }]));
  const muitasColunas = d.vista !== "dia" && d.meses.length > 8;

  autoTable(doc, {
    head,
    body,
    startY: 50,
    margin: { left: margem, right: margem, top: 16, bottom: 14 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: muitasColunas ? 6.5 : 8,
      cellPadding: muitasColunas ? 1.2 : 1.8,
      textColor: TEXTO,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: {
      ...colunasDireita,
      0: d.vista === "dia" ? { cellWidth: 18 } : { cellWidth: muitasColunas ? 38 : 50, fontStyle: "normal" },
    },
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });

  const totalPaginas = doc.getNumberOfPages();
  const geradoEm = new Date().toLocaleString("pt-BR");
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(`${d.empresaNome} · Fluxo de Caixa ${dataBR(d.de)} a ${dataBR(d.ate)}`, margem, altura - 7);
    doc.text(`Gerado em ${geradoEm} · Página ${p} de ${totalPaginas}`, largura - margem, altura - 7, { align: "right" });
  }

  return doc;
}
