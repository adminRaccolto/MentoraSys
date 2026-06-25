"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, X, ChevronRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { importarTarefas, type TarefaImportada, type EtapaCriada } from "@/actions/importar-tarefas";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Etapa { id: string; titulo: string }
interface Membro { usuario: { id: string; nome: string } }
interface TarefaCriada {
  id: string; etapaId: string; titulo: string; descricao: string | null;
  status: string; data_prazo: Date | null; concluida_em: Date | null;
  responsavel: { id: string; nome: string } | null; etiquetas: never[];
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  projetoId: string;
  etapas: Etapa[];
  membros: Membro[];
  onImportado: (resultado: { etapasCriadas: EtapaCriada[]; tarefas: TarefaCriada[] }) => void;
}

// ─── Linha de preview ────────────────────────────────────────────────────────

interface LinhaPreview {
  index: number;
  titulo: string;
  etapaNome: string;
  etapaId?: string;      // preenchido se a etapa já existe
  novaEtapa: boolean;    // true = será criada
  responsavelNome: string;
  responsavelId: string | null;
  prazoRaw: string;
  dataPrazo: string | null;
  descricao: string;
  erros: string[];
  avisos: string[];
  incluir: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePtDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const match = raw.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!isNaN(Date.parse(iso))) return iso;
  }
  if (!isNaN(Date.parse(raw))) return new Date(raw).toISOString().split("T")[0];
  return null;
}

function normStr(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function gerarTemplate() {
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Título *", "Etapa", "Responsável", "Prazo (DD/MM/AAAA)", "Descrição"],
      ["Definir estratégia", "Fase 1 – Planejamento", "João Silva", "30/06/2026", ""],
      ["Criar material gráfico", "Fase 2 – Execução", "Maria Lima", "15/07/2026", "Banners e cartazes"],
      ["Revisar entregáveis", "Fase 2 – Execução", "", "20/07/2026", ""],
    ]);
    ws["!cols"] = [{ wch: 50 }, { wch: 35 }, { wch: 20 }, { wch: 22 }, { wch: 45 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
    XLSX.writeFile(wb, "modelo-importacao-tarefas.xlsx");
  });
}

function lerArquivo(file: File, etapas: Etapa[], membros: Membro[]): Promise<LinhaPreview[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        const get = (row: Record<string, string>, keyword: string) => {
          const key = Object.keys(row).find((k) => normStr(k).includes(keyword)) ?? "";
          return String(row[key] ?? "").trim();
        };

        const linhas: LinhaPreview[] = rows.map((row, i) => {
          const titulo = get(row, "titul");
          const etapaNomeRaw = get(row, "etap");
          const responsavelNome = get(row, "respons");
          const prazoRaw = get(row, "prazo");
          const descricao = get(row, "descri");

          const erros: string[] = [];
          const avisos: string[] = [];

          if (!titulo) erros.push("Título obrigatório");

          // Resolve etapa — se não encontrar, será criada automaticamente
          const etapaMatch = etapas.find((e) => normStr(e.titulo) === normStr(etapaNomeRaw));
          const etapaId = etapaMatch?.id;
          const novaEtapa = !!etapaNomeRaw && !etapaMatch;
          const etapaNome = etapaMatch?.titulo ?? etapaNomeRaw;

          // Resolve responsável
          const membroMatch = membros.find((m) => normStr(m.usuario.nome) === normStr(responsavelNome));
          const responsavelId = membroMatch?.usuario.id ?? null;
          if (responsavelNome && !membroMatch) avisos.push(`Responsável "${responsavelNome}" não encontrado`);

          // Resolve data
          let dataPrazo: string | null = null;
          if (prazoRaw) {
            dataPrazo = parsePtDate(prazoRaw);
            if (!dataPrazo) avisos.push(`Data "${prazoRaw}" inválida — ignorada`);
          }

          return {
            index: i + 1,
            titulo,
            etapaNome,
            etapaId,
            novaEtapa,
            responsavelNome: membroMatch?.usuario.nome ?? responsavelNome,
            responsavelId,
            prazoRaw,
            dataPrazo,
            descricao,
            erros,
            avisos,
            incluir: erros.length === 0,
          };
        });

        resolve(linhas.filter((l) => l.titulo || l.etapaNome || l.responsavelNome || l.prazoRaw || l.descricao));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ImportarTarefasModal({ aberto, onFechar, projetoId, etapas, membros, onImportado }: Props) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [linhas, setLinhas] = useState<LinhaPreview[]>([]);
  const [dragging, setDragging] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ importadas: number; etapasCriadas: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetar = () => { setPasso(1); setLinhas([]); setResultado(null); };
  const fechar = () => { resetar(); onFechar(); };

  const processarArquivo = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error("Selecione um arquivo .xlsx ou .xls"); return; }
    setLendo(true);
    try {
      const resultado = await lerArquivo(file, etapas, membros);
      if (resultado.length === 0) { toast.error("Nenhuma linha encontrada no arquivo"); return; }
      setLinhas(resultado);
      setPasso(2);
    } catch {
      toast.error("Erro ao ler o arquivo. Verifique se é um Excel válido.");
    } finally {
      setLendo(false);
    }
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processarArquivo(file);
  }, [etapas, membros]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processarArquivo(file);
    e.target.value = "";
  };

  const toggleLinha = (index: number) =>
    setLinhas((prev) => prev.map((l) => l.index === index ? { ...l, incluir: !l.incluir } : l));

  const selecionadas = linhas.filter((l) => l.incluir);
  const novasEtapasNaSeleção = [...new Set(selecionadas.filter((l) => l.novaEtapa).map((l) => l.etapaNome))];

  const confirmarImportacao = () => {
    const payload: TarefaImportada[] = selecionadas.map((l) => ({
      titulo: l.titulo,
      descricao: l.descricao || undefined,
      etapaId: l.etapaId,
      etapaNome: l.novaEtapa ? l.etapaNome : undefined,
      responsavelId: l.responsavelId ?? undefined,
      dataPrazo: l.dataPrazo ?? undefined,
    }));

    startTransition(async () => {
      try {
        const res = await importarTarefas(projetoId, payload);
        setResultado({ importadas: res.importadas, etapasCriadas: res.etapasCriadas.length });
        onImportado({ etapasCriadas: res.etapasCriadas, tarefas: res.tarefas as TarefaCriada[] });
        setPasso(3);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  // Estatísticas do preview
  const totalErros = linhas.filter((l) => l.erros.length > 0).length;
  const totalNovas = [...new Set(linhas.filter((l) => l.novaEtapa).map((l) => l.etapaNome))].length;
  const totalAvisos = linhas.filter((l) => l.avisos.length > 0 && l.erros.length === 0).length;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden">

        {/* Header com steps */}
        <div className="bg-primary text-primary-foreground px-8 py-5">
          <DialogTitle className="text-white text-lg font-semibold mb-3">Importar tarefas via Excel</DialogTitle>
          <div className="flex items-center gap-2 text-sm">
            {([{ n: 1, label: "Upload" }, { n: 2, label: "Revisar" }, { n: 3, label: "Concluído" }] as const).map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="size-4 text-white/40" />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  passo === s.n ? "bg-white text-primary" : passo > s.n ? "bg-white/30 text-white" : "bg-white/10 text-white/50"
                }`}>
                  {passo > s.n ? <CheckCircle2 className="size-3.5" /> : <span>{s.n}</span>}
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Passo 1 — Upload ── */}
        {passo === 1 && (
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Dropzone */}
              <div
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors min-h-[240px] ${
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
                {lendo ? (
                  <div className="space-y-3">
                    <Loader2 className="size-10 text-primary mx-auto animate-spin" />
                    <p className="text-sm text-muted-foreground">Lendo arquivo...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                      <FileSpreadsheet className="size-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Arraste o arquivo aqui</p>
                      <p className="text-sm text-muted-foreground mt-0.5">ou clique para selecionar</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsx, .xls</p>
                  </div>
                )}
              </div>

              {/* Instruções */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Como usar</h3>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Baixe o modelo de planilha abaixo</li>
                    <li>Preencha as tarefas — coluna Etapa é livre</li>
                    <li>Salve e faça o upload do arquivo</li>
                    <li>Revise e confirme a importação</li>
                  </ol>
                </div>

                {/* Destaque da feature de auto-criar etapas */}
                <div className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 rounded-lg p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-semibold">
                    <Sparkles className="size-4" />
                    Etapas criadas automaticamente
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Se a etapa informada não existir no projeto, ela será criada automaticamente durante a importação. Você não precisa configurar nada antes.
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4 space-y-2 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colunas da planilha</p>
                  <div className="space-y-1 text-sm">
                    {[
                      { req: true, nome: "Título", detalhe: "" },
                      { req: false, nome: "Etapa", detalhe: "— cria se não existir" },
                      { req: false, nome: "Responsável", detalhe: "— nome do membro" },
                      { req: false, nome: "Prazo", detalhe: "— DD/MM/AAAA" },
                      { req: false, nome: "Descrição", detalhe: "" },
                    ].map((c) => (
                      <div key={c.nome} className="flex items-center gap-2">
                        <Badge variant={c.req ? "destructive" : "secondary"} className="text-[10px]">
                          {c.req ? "Obrigatório" : "Opcional"}
                        </Badge>
                        <span className={c.req ? "font-medium" : ""}>{c.nome}</span>
                        {c.detalhe && <span className="text-xs text-muted-foreground">{c.detalhe}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => gerarTemplate()}>
                  <Download className="size-4 mr-2" />
                  Baixar modelo de planilha
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Passo 2 — Preview ── */}
        {passo === 2 && (
          <div className="flex flex-col" style={{ maxHeight: "70vh" }}>
            {/* Barra de resumo */}
            <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-4 shrink-0 flex-wrap">
              <span className="text-sm font-medium">{linhas.length} linha(s)</span>
              <div className="text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                {linhas.filter((l) => l.erros.length === 0).length} válidas
              </div>
              {totalNovas > 0 && (
                <div className="text-sm text-blue-600 font-medium flex items-center gap-1">
                  <Sparkles className="size-3.5" />
                  {totalNovas} etapa(s) nova(s)
                </div>
              )}
              {totalErros > 0 && (
                <div className="text-sm text-destructive font-medium flex items-center gap-1">
                  <XCircle className="size-3.5" />
                  {totalErros} com erro
                </div>
              )}
              {totalAvisos > 0 && (
                <div className="text-sm text-amber-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  {totalAvisos} com aviso
                </div>
              )}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => setLinhas((p) => p.map((l) => ({ ...l, incluir: l.erros.length === 0 })))}>
                  Selecionar válidas
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setLinhas((p) => p.map((l) => ({ ...l, incluir: false })))}>
                  Limpar seleção
                </Button>
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
                    <th className="px-3 py-2.5 w-8"></th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Título</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-40">Etapa</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-32">Responsável</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-24">Prazo</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-44">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => {
                    const temErro = linha.erros.length > 0;
                    return (
                      <tr key={linha.index} className={`border-b border-border/50 transition-colors ${
                        temErro ? "bg-red-50/50 dark:bg-red-950/20" :
                        linha.incluir ? "hover:bg-muted/20" : "bg-muted/30 opacity-60"
                      }`}>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{linha.index}</td>
                        <td className="px-3 py-2.5">
                          {temErro
                            ? <XCircle className="size-4 text-destructive" />
                            : <input type="checkbox" checked={linha.incluir} onChange={() => toggleLinha(linha.index)} className="size-4 cursor-pointer rounded" />
                          }
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {linha.titulo || <span className="text-destructive italic">vazio</span>}
                          {linha.descricao && (
                            <p className="text-xs text-muted-foreground font-normal mt-0.5 line-clamp-1">{linha.descricao}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {linha.etapaNome ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">{linha.etapaNome}</span>
                              {linha.novaEtapa && (
                                <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 px-1.5">
                                  nova
                                </Badge>
                              )}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{linha.responsavelNome || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {linha.dataPrazo
                            ? new Date(linha.dataPrazo + "T00:00:00").toLocaleDateString("pt-BR")
                            : linha.prazoRaw
                            ? <span className="text-amber-600">{linha.prazoRaw}</span>
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {temErro && linha.erros.map((e, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-destructive">
                              <XCircle className="size-3 shrink-0" /> {e}
                            </div>
                          ))}
                          {!temErro && linha.avisos.map((a, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="size-3 shrink-0" /> {a}
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rodapé com aviso de etapas novas */}
            <div className="px-6 py-4 border-t border-border bg-muted/30 space-y-2 shrink-0">
              {novasEtapasNaSeleção.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                  <Sparkles className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    As seguintes etapas serão criadas automaticamente:{" "}
                    <strong>{novasEtapasNaSeleção.join(", ")}</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => { setPasso(1); setLinhas([]); }}>← Voltar</Button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selecionadas.length} tarefa(s) selecionada(s)
                  </span>
                  <Button onClick={confirmarImportacao} disabled={selecionadas.length === 0 || isPending}>
                    {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Importar {selecionadas.length > 0 ? `${selecionadas.length} tarefa(s)` : ""}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Passo 3 — Concluído ── */}
        {passo === 3 && resultado && (
          <div className="p-12 flex flex-col items-center text-center gap-4">
            <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="size-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Importação concluída!</h2>
              <p className="text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{resultado.importadas}</span> tarefa(s) importada(s)
                {resultado.etapasCriadas > 0 && (
                  <> e <span className="font-semibold text-foreground">{resultado.etapasCriadas}</span> etapa(s) criada(s)</>
                )} com sucesso.
              </p>
            </div>
            <Button onClick={fechar} className="mt-4">Fechar</Button>
          </div>
        )}

        {passo !== 2 && (
          <button onClick={fechar} className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
