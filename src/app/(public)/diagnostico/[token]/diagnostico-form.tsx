"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { responderDiagnostico, type RespostasDiagnostico, type RespostaFazenda } from "@/actions/diagnostico-coleta";

// ─── constantes ───────────────────────────────────────────────────────────────

const CULTURAS_OPCOES = ["Soja", "Milho", "Algodão", "Gergelim", "Sorgo", "Milheto", "Feijão", "Milho Pipoca"];
const OPERACOES_OPCOES = ["Plantio", "Pulverização", "Colheita"];
const COMPRADORES_OPCOES = ["O dono da fazenda", "Gerente operacional", "Agrônomo", "Outro"];

const MOMENTO_LABEL: Record<string, string> = {
  PONTO_A: "Ponto A — Perfil Inicial",
  PONTO_B: "Ponto B — Acompanhamento",
  PONTO_C: "Ponto C — Avaliação Final",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1B4F72] text-white px-5 py-3 rounded-lg font-semibold text-sm tracking-wide uppercase">
      {children}
    </div>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }: {
  name: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${value === opt ? "border-[#1B4F72] bg-[#1B4F72]/5" : "border-border hover:bg-muted/30"}`}>
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="accent-[#1B4F72]" />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ options, values, onChange }: {
  options: string[]; values: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${values.includes(opt) ? "border-[#1B4F72] bg-[#1B4F72]/5" : "border-border hover:bg-muted/30"}`}>
          <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} className="accent-[#1B4F72] size-4" />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Bloco de fazenda ─────────────────────────────────────────────────────────

function BlocoFazenda({ fazenda, index, onChange, onRemover, podeRemover }: {
  fazenda: RespostaFazenda; index: number;
  onChange: (f: RespostaFazenda) => void;
  onRemover: () => void;
  podeRemover: boolean;
}) {
  const [aberta, setAberta] = useState(true);

  const setCultura = (nome: string, campo: "produtividade_media" | "area_ultima_safra", valor: number | null) => {
    onChange({
      ...fazenda,
      culturas: fazenda.culturas.map(c => c.nome === nome ? { ...c, [campo]: valor } : c),
    });
  };

  const toggleCultura = (nome: string) => {
    const existe = fazenda.culturas.some(c => c.nome === nome);
    onChange({
      ...fazenda,
      culturas: existe
        ? fazenda.culturas.filter(c => c.nome !== nome)
        : [...fazenda.culturas, { nome, produtividade_media: null, area_ultima_safra: null }],
    });
  };

  const [outraCultura, setOutraCultura] = useState("");

  const addOutraCultura = () => {
    const nome = outraCultura.trim();
    if (!nome || fazenda.culturas.some(c => c.nome === nome)) return;
    onChange({ ...fazenda, culturas: [...fazenda.culturas, { nome, produtividade_media: null, area_ultima_safra: null }] });
    setOutraCultura("");
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer"
        onClick={() => setAberta(!aberta)}
      >
        <span className="font-medium text-sm">
          Fazenda {index + 1}{fazenda.nome ? ` — ${fazenda.nome}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {podeRemover && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemover(); }}
              className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="size-4" />
            </button>
          )}
          {aberta ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
        </div>
      </div>

      {aberta && (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome da Fazenda" required>
              <Input value={fazenda.nome} onChange={e => onChange({ ...fazenda, nome: e.target.value })} placeholder="Ex: Fazenda Santa Clara" />
            </Field>
            <Field label="Área Arrendada (ha)">
              <Input type="number" min="0" step="0.1" value={fazenda.area_arrendada ?? ""} onChange={e => onChange({ ...fazenda, area_arrendada: e.target.value ? Number(e.target.value) : null })} placeholder="0" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Valor do Arrendamento">
              <div className="flex gap-2">
                <Input type="number" min="0" step="0.01" value={fazenda.valor_arrendamento ?? ""}
                  onChange={e => onChange({ ...fazenda, valor_arrendamento: e.target.value ? Number(e.target.value) : null })} placeholder="0" className="flex-1" />
                <select
                  value={fazenda.tipo_arrendamento}
                  onChange={e => onChange({ ...fazenda, tipo_arrendamento: e.target.value as "Reais/ha" | "Sc/ha" })}
                  className="border rounded-md px-2 text-sm bg-background"
                >
                  <option value="Reais/ha">R$/ha</option>
                  <option value="Sc/ha">Sc/ha</option>
                </select>
              </div>
            </Field>
            <Field label="Área de Plantio Própria (ha)">
              <Input type="number" min="0" step="0.1" value={fazenda.area_plantio_propria ?? ""}
                onChange={e => onChange({ ...fazenda, area_plantio_propria: e.target.value ? Number(e.target.value) : null })} placeholder="0" />
            </Field>
          </div>

          <Field label="Culturas Cultivadas" hint="Selecione todas que se aplicam. Para cada uma, informe produtividade e área.">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CULTURAS_OPCOES.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => toggleCultura(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${fazenda.culturas.some(x => x.nome === c) ? "bg-[#1B4F72] text-white border-[#1B4F72]" : "border-border hover:border-[#1B4F72] text-slate-600"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Outra cultura */}
              <div className="flex gap-2">
                <Input placeholder="Outra cultura..." value={outraCultura} onChange={e => setOutraCultura(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOutraCultura(); } }}
                  className="flex-1 h-8 text-xs" />
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addOutraCultura}>
                  + Adicionar
                </Button>
              </div>

              {/* Campos por cultura selecionada */}
              {fazenda.culturas.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Cultura</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Produtividade Média (sc/ha)</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Área Última Safra (ha)</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fazenda.culturas.map((c, i) => (
                        <tr key={c.nome} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-medium text-sm">{c.nome}</td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="1"
                              value={c.produtividade_media ?? ""}
                              onChange={e => setCultura(c.nome, "produtividade_media", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-sm w-28" placeholder="0" />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="1"
                              value={c.area_ultima_safra ?? ""}
                              onChange={e => setCultura(c.nome, "area_ultima_safra", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-sm w-28" placeholder="0" />
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => toggleCultura(c.nome)}
                              className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Funcionários Operacionais Fixos">
              <Input type="number" min="0" step="1" value={fazenda.funcionarios_fixos ?? ""}
                onChange={e => onChange({ ...fazenda, funcionarios_fixos: e.target.value ? Number(e.target.value) : null })} placeholder="0" />
            </Field>
          </div>

          <Field label="Operações Terceirizadas" hint="Selecione todas que se aplicam">
            <CheckboxGroup options={OPERACOES_OPCOES} values={fazenda.operacoes_terceirizadas}
              onChange={v => onChange({ ...fazenda, operacoes_terceirizadas: v })} />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  token: string;
  jaRespondido: boolean;
  momento: string;
  projeto: string;
  cliente: string;
  empresa: { nome: string; logoUrl: string | null };
}

function fazendaVazia(): RespostaFazenda {
  return { nome: "", area_arrendada: null, valor_arrendamento: null, tipo_arrendamento: "Sc/ha", area_plantio_propria: null, culturas: [], funcionarios_fixos: null, operacoes_terceirizadas: [] };
}

export default function DiagnosticoForm({ token, jaRespondido, momento, projeto, cliente, empresa }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(jaRespondido);

  // BLOCO OPERACIONAL
  const [fazendas, setFazendas] = useState<RespostaFazenda[]>([fazendaVazia()]);

  // Culturas únicas de todas as fazendas (para campos financeiros)
  const todasCulturas = Array.from(new Set(fazendas.flatMap(f => f.culturas.map(c => c.nome))));

  // BLOCO FINANCEIRO
  const [custosPorCultura, setCustosPorCultura] = useState<{ cultura: string; insumos_sc_ha: number | null; operacao_sc_ha: number | null }[]>([]);
  const [fluxoCaixa, setFluxoCaixa] = useState("");
  const [financiamentoInsumo, setFinanciamentoInsumo] = useState("");
  const [captacaoSafra, setCaptacaoSafra] = useState("");
  const [margemCusto, setMargemCusto] = useState("");
  const [renegociouDividas, setRenegociouDividas] = useState("");
  const [sistemaGestao, setSistemaGestao] = useState("");
  const [nomeSistema, setNomeSistema] = useState("");
  const [confiaSistema, setConfiaSistema] = useState("");

  // BLOCO MODELO DE TRABALHO
  const [executorAdmin, setExecutorAdmin] = useState("");
  const [compradorInsumos, setCompradorInsumos] = useState<string[]>([]);
  const [decisaoCompras, setDecisaoCompras] = useState("");

  // Sincroniza custos quando culturas mudam
  const setCustoField = (cultura: string, campo: "insumos_sc_ha" | "operacao_sc_ha", valor: number | null) => {
    setCustosPorCultura(prev => {
      const existe = prev.find(c => c.cultura === cultura);
      if (existe) return prev.map(c => c.cultura === cultura ? { ...c, [campo]: valor } : c);
      return [...prev, { cultura, insumos_sc_ha: null, operacao_sc_ha: null, [campo]: valor }];
    });
  };

  const getCusto = (cultura: string, campo: "insumos_sc_ha" | "operacao_sc_ha") =>
    custosPorCultura.find(c => c.cultura === cultura)?.[campo] ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fazendas.some(f => !f.nome.trim())) {
      toast.error("Informe o nome de todas as fazendas");
      return;
    }

    setEnviando(true);
    try {
      const respostas: RespostasDiagnostico = {
        fazendas,
        custos_por_cultura: todasCulturas.map(c => ({
          cultura: c,
          insumos_sc_ha: getCusto(c, "insumos_sc_ha"),
          operacao_sc_ha: getCusto(c, "operacao_sc_ha"),
        })),
        fluxo_caixa_meses: fluxoCaixa,
        financiamento_insumo: financiamentoInsumo,
        captacao_safra: captacaoSafra,
        margem_custo_financeiro: margemCusto,
        renegociou_dividas: renegociouDividas,
        sistema_gestao: sistemaGestao,
        nome_sistema: nomeSistema,
        confia_sistema: confiaSistema,
        executor_tarefas_admin: executorAdmin,
        comprador_insumos: compradorInsumos,
        decisao_compras: decisaoCompras,
      };

      await responderDiagnostico(token, respostas);
      setEnviado(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar respostas");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle className="size-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-800">Respostas enviadas!</h1>
          <p className="text-muted-foreground">Obrigado por preencher o diagnóstico. Suas respostas foram registradas e a equipe da <strong>{empresa.nome}</strong> irá analisá-las.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* cabeçalho */}
      <div className="bg-[#1B4F72] text-white py-6 px-4 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          {empresa.logoUrl && <img src={empresa.logoUrl} alt="Logo" className="h-10 object-contain" />}
          <div>
            <p className="text-sm text-white/70">{empresa.nome}</p>
            <h1 className="font-bold text-lg">Diagnóstico — {MOMENTO_LABEL[momento] ?? momento}</h1>
            <p className="text-sm text-white/80">{projeto}{cliente ? ` · ${cliente}` : ""}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* ── BLOCO OPERACIONAL ── */}
        <div className="space-y-5">
          <SectionTitle>Bloco Operacional — Informações da Operação</SectionTitle>

          {fazendas.map((f, i) => (
            <BlocoFazenda key={i} fazenda={f} index={i}
              onChange={updated => setFazendas(prev => prev.map((x, j) => j === i ? updated : x))}
              onRemover={() => setFazendas(prev => prev.filter((_, j) => j !== i))}
              podeRemover={fazendas.length > 1} />
          ))}

          <Button type="button" variant="outline" className="w-full border-dashed border-[#1B4F72] text-[#1B4F72] hover:bg-[#1B4F72]/5"
            onClick={() => setFazendas(prev => [...prev, fazendaVazia()])}>
            <Plus className="size-4 mr-1.5" /> Adicionar outra fazenda
          </Button>
        </div>

        {/* ── BLOCO FINANCEIRO ── */}
        <div className="space-y-5">
          <SectionTitle>Bloco Financeiro e Administrativo</SectionTitle>

          {/* Custo por cultura */}
          {todasCulturas.length > 0 && (
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <p className="font-medium text-sm text-slate-700">Custo por hectare — por cultura cultivada</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Cultura</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Insumos (sc/ha)</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Operação (sc/ha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todasCulturas.map((c, i) => (
                      <tr key={c} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                        <td className="px-3 py-2 font-medium">{c}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.1"
                            value={getCusto(c, "insumos_sc_ha") ?? ""}
                            onChange={e => setCustoField(c, "insumos_sc_ha", e.target.value ? Number(e.target.value) : null)}
                            className="h-7 text-sm w-24" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.1"
                            value={getCusto(c, "operacao_sc_ha") ?? ""}
                            onChange={e => setCustoField(c, "operacao_sc_ha", e.target.value ? Number(e.target.value) : null)}
                            className="h-7 text-sm w-24" placeholder="0" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl p-5 space-y-6">
            <Field label="Quantos meses de Fluxo de Caixa você consegue projetar?">
              <RadioGroup name="fluxo" options={["0 meses", "6 meses", "12 meses", "Mais que 12 meses"]}
                value={fluxoCaixa} onChange={setFluxoCaixa} />
            </Field>

            <Field label="Quanto do custo de insumo você financia com banco?">
              <RadioGroup name="fin_insumo" options={["Nada", "Menor que 50%", "Entre 50% e 75%", "Maior que 75%"]}
                value={financiamentoInsumo} onChange={setFinanciamentoInsumo} />
            </Field>

            <Field label="Neste ano safra, quanto você captou de recursos?">
              <RadioGroup name="captacao" options={["Não fiz captações esse ano", "A mesma coisa que no ano passado", "Menos que no ano passado", "Mais que no ano passado"]}
                value={captacaoSafra} onChange={setCaptacaoSafra} />
            </Field>

            <Field label="Quanto de margem operacional o custo financeiro tem tomado?">
              <RadioGroup name="margem"
                options={["Não toma margem, estou sem endividamento bancário", "Entre 1% e 5%", "Entre 6% e 10%", "Entre 11% e 15%", "Acima de 15%"]}
                value={margemCusto} onChange={setMargemCusto} />
            </Field>

            <Field label="Precisou renegociar dívidas bancárias neste último ano?">
              <RadioGroup name="renegociar" options={["Sim", "Não"]}
                value={renegociouDividas} onChange={setRenegociouDividas} />
            </Field>

            <Field label="Usa sistema de gestão no escritório?">
              <RadioGroup name="sistema" options={["Uso Excel", "Uso um Sistema", "Não uso sistema"]}
                value={sistemaGestao} onChange={setSistemaGestao} />
              {sistemaGestao === "Uso um Sistema" && (
                <Input className="mt-2" placeholder="Qual o nome do sistema?" value={nomeSistema} onChange={e => setNomeSistema(e.target.value)} />
              )}
            </Field>

            {sistemaGestao !== "Não uso sistema" && sistemaGestao !== "" && (
              <Field label="Você confia nas informações do sistema para tomada de decisão?">
                <RadioGroup name="confia" options={["Sim", "Não", "Parcialmente"]}
                  value={confiaSistema} onChange={setConfiaSistema} />
              </Field>
            )}
          </div>
        </div>

        {/* ── BLOCO MODELO DE TRABALHO ── */}
        <div className="space-y-5">
          <SectionTitle>Bloco Modelo de Trabalho</SectionTitle>

          <div className="bg-white border rounded-xl p-5 space-y-6">
            <Field label="As tarefas de lançamento, conciliações e gestão financeira são executadas por:">
              <RadioGroup name="executor"
                options={["Exclusivamente familiares", "Familiares e contratados", "Exclusivamente por Contratados"]}
                value={executorAdmin} onChange={setExecutorAdmin} />
            </Field>

            <Field label="Quem é o comprador de insumos?" hint="Selecione todos os envolvidos">
              <CheckboxGroup options={COMPRADORES_OPCOES} values={compradorInsumos} onChange={setCompradorInsumos} />
            </Field>

            <Field label="A tomada de decisão de compras e investimentos é:">
              <RadioGroup name="decisao" options={["Decisão compartilhada", "Decisão centralizada"]}
                value={decisaoCompras} onChange={setDecisaoCompras} />
            </Field>
          </div>
        </div>

        {/* Botão enviar */}
        <Button type="submit" size="lg" className="w-full bg-[#1B4F72] hover:bg-[#1B4F72]/90 text-white h-12 text-base" disabled={enviando}>
          {enviando ? "Enviando respostas..." : "Enviar diagnóstico"}
        </Button>
      </form>
    </div>
  );
}
