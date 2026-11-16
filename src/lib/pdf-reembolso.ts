export interface SecaoPdfReembolso {
  titulo: string;
  colunas: string[];
  colunasDireita: number[];
  linhas: string[][];
  subtotal: string;
}

export interface DadosPdfReembolso {
  empresaNome: string;
  empresaCnpj: string | null;
  empresaEndereco: string;
  titulo: string;
  periodo: string;
  descricao: string | null;
  status: string | null;
  clienteNome: string | null;
  secoes: SecaoPdfReembolso[];
  total: string;
  resumo: [string, string][];
  pagamento: [string, string][];
  comAssinatura: boolean;
  nomeArquivo: string;
}

const AZUL: [number, number, number] = [27, 79, 114];
const CINZA: [number, number, number] = [100, 116, 139];
const TEXTO: [number, number, number] = [30, 41, 59];
const BORDA: [number, number, number] = [226, 232, 240];
const FUNDO: [number, number, number] = [248, 250, 252];

async function carregarImagem(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as string);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function montarPdfReembolso(d: DadosPdfReembolso, assinaturaDataUrl: string | null = null) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 14;
  const ultimaY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const garantirEspaco = (y: number, necessario: number) => {
    if (y + necessario <= altura - 16) return y;
    doc.addPage();
    return 20;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...AZUL);
  doc.text(d.empresaNome, margem, 18, { maxWidth: largura / 2 - margem });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  const infoEmpresa = [d.empresaCnpj ? `CNPJ: ${d.empresaCnpj}` : "", d.empresaEndereco].filter(Boolean);
  infoEmpresa.forEach((t, i) => doc.text(t, margem, 24 + i * 4, { maxWidth: largura / 2 - margem }));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...AZUL);
  doc.text(d.titulo, largura - margem, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  doc.text(d.periodo, largura - margem, 24, { align: "right" });
  let yDir = 24;
  if (d.descricao) {
    yDir += 5;
    doc.setFontSize(8.5);
    doc.text(d.descricao, largura - margem, yDir, { align: "right", maxWidth: largura / 2 });
  }
  if (d.status) {
    yDir += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...(d.status === "Pago" ? ([21, 128, 61] as [number, number, number]) : ([180, 83, 9] as [number, number, number])));
    doc.text(d.status, largura - margem, yDir, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  let y = Math.max(24 + infoEmpresa.length * 4, yDir) + 4;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(margem, y, largura - margem, y);
  y += 6;

  if (d.clienteNome) {
    doc.setFillColor(...FUNDO);
    doc.roundedRect(margem, y, largura - margem * 2, 14, 1.5, 1.5, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text("CLIENTE", margem + 4, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXTO);
    doc.text(d.clienteNome, margem + 4, y + 11);
    doc.setFont("helvetica", "normal");
    y += 20;
  }

  // Tabelas
  for (const s of d.secoes) {
    y = garantirEspaco(y, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(s.titulo.toUpperCase(), margem, y);
    doc.setFont("helvetica", "normal");
    const ultimaColuna = s.colunas.length - 1;
    autoTable(doc, {
      head: [s.colunas],
      body: s.linhas,
      foot: [[
        { content: `Subtotal ${s.titulo.toLowerCase()}`, colSpan: ultimaColuna, styles: { halign: "left" } },
        { content: s.subtotal, styles: { halign: "right" } },
      ]],
      startY: y + 2,
      margin: { left: margem, right: margem, bottom: 16 },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4, textColor: TEXTO, lineColor: BORDA, lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold" },
      didParseCell: (data) => {
        if (data.section === "head" && (s.colunasDireita.includes(data.column.index) || data.column.index === ultimaColuna)) {
          data.cell.styles.halign = "right";
        }
      },
      footStyles: { fillColor: FUNDO, textColor: TEXTO, fontStyle: "bold" },
      columnStyles: Object.fromEntries([
        ...s.colunasDireita.map((i) => [i, { halign: "right" as const }]),
        [0, { cellWidth: 22 }],
        [ultimaColuna, { halign: "right" as const, fontStyle: "bold" as const, cellWidth: 28 }],
      ]),
      showHead: "everyPage",
      showFoot: "lastPage",
      rowPageBreak: "avoid",
    });
    y = ultimaY() + 8;
  }

  // Total à direita; resumo ou dados de pagamento ao lado, à esquerda
  const larguraTotal = 78;
  const larguraBloco = largura - margem * 2 - larguraTotal - 6;
  const blocos: [string, [string, string][]][] = [];
  if (d.resumo.length > 1) blocos.push(["Resumo por categoria", d.resumo]);
  if (d.pagamento.length > 0) blocos.push(["Dados para pagamento", d.pagamento]);
  const alturaBlocos = blocos.reduce((s, [, pares]) => s + 9 + pares.length * 5 + 3, 0);
  y = garantirEspaco(y, Math.max(13, alturaBlocos));

  doc.setFillColor(...AZUL);
  doc.roundedRect(largura - margem - larguraTotal, y, larguraTotal, 13, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Total a reembolsar", largura - margem - larguraTotal + 4, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(d.total, largura - margem - 4, y + 8.5, { align: "right" });
  doc.setFont("helvetica", "normal");

  let yBloco = y;
  for (const [titulo, pares] of blocos) {
    const alturaBloco = 9 + pares.length * 5;
    doc.setDrawColor(...BORDA);
    doc.setFillColor(...FUNDO);
    doc.setLineWidth(0.2);
    doc.roundedRect(margem, yBloco, larguraBloco, alturaBloco, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(titulo.toUpperCase(), margem + 4, yBloco + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    pares.forEach(([k, v], i) => {
      const linhaY = yBloco + 10.5 + i * 5;
      doc.setTextColor(...CINZA);
      doc.text(k, margem + 4, linhaY);
      doc.setTextColor(...TEXTO);
      doc.text(v, margem + larguraBloco - 4, linhaY, { align: "right" });
    });
    yBloco += alturaBloco + 3;
  }
  y = Math.max(y + 13, yBloco) + 6;

  if (d.comAssinatura) {
    y = garantirEspaco(y, 28);
    const xAss = largura - margem - 70;
    if (assinaturaDataUrl) {
      try { doc.addImage(assinaturaDataUrl, xAss + 15, y, 40, 14); } catch { /* imagem inválida: segue sem */ }
    }
    doc.setDrawColor(...CINZA);
    doc.setLineWidth(0.3);
    doc.line(xAss, y + 17, largura - margem, y + 17);
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    doc.text("Assinatura / Responsável", xAss + 35, y + 22, { align: "center" });
  }

  const totalPaginas = doc.getNumberOfPages();
  const geradoEm = new Date().toLocaleDateString("pt-BR");
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(`${d.empresaNome}${d.empresaCnpj ? ` · CNPJ ${d.empresaCnpj}` : ""}`, margem, altura - 8);
    doc.text(`Gerado em ${geradoEm} · Página ${p} de ${totalPaginas}`, largura - margem, altura - 8, { align: "right" });
  }

  return doc;
}

export async function gerarPdfReembolso(d: DadosPdfReembolso): Promise<void> {
  const assinatura = d.comAssinatura ? await carregarImagem("/assinatura-responsavel.png") : null;
  const doc = await montarPdfReembolso(d, assinatura);
  doc.save(d.nomeArquivo);
}
