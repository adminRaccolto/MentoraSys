"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, FileSignature, Link as LinkIcon, DollarSign, FileText, RefreshCw, Printer, Send, Download, ExternalLink, Copy, CheckCircle, Upload, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { criarContrato, editarContrato, excluirContrato, marcarAssinado, salvarAnexoContrato } from "@/actions/contratos";
import { gerarParcelasContrato } from "@/actions/recebiveis";
import { enviarParaAssinatura } from "@/actions/assinatura";

const FORMAS_PAGAMENTO = ["À vista", "Parcelado", "Recorrente", "Mensal", "Trimestral", "Semestral", "Anual"];
const PERIODICIDADES = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Única"];
const TIPOS_CONTRATO = ["Consultoria", "Mentoria", "Assessoria", "Prestação de Serviços", "Retainer", "Outro"];
const INDICES_REAJUSTE = ["IPCA", "IGPM", "IGP-DI", "INPC", "Nenhum"];
const PERIODICIDADES_REAJUSTE = ["Anual", "Semestral", "A definir"];

function periodoParaMeses(p?: string | null): number {
  const map: Record<string, number> = { Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12, "Única": 0 };
  return map[p ?? ""] ?? 1;
}

function gerarParcelasIguais(n: number, primeiroVencimento: string, periodicidade: string | undefined, total: number) {
  const meses = periodoParaMeses(periodicidade);
  const valorBase = Math.floor((total / n) * 100) / 100;
  const resto = Math.round((total - valorBase * n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(primeiroVencimento + "T12:00:00");
    if (meses > 0) d.setMonth(d.getMonth() + i * meses);
    return { numero: i + 1, vencimento: d.toISOString().split("T")[0], valor: i === n - 1 ? Math.round((valorBase + resto) * 100) / 100 : valorBase };
  });
}

const schemaParcela = z.object({ numero: z.number(), vencimento: z.string(), valor: z.number().min(0) });

const schema = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  proposta_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  numero_contrato: z.string().optional(),
  tipo_contrato: z.string().optional(),
  titulo: z.string().min(2, "Título obrigatório"),
  objeto: z.string().optional(),
  conteudo: z.string().optional(),
  valor_total: z.string().optional(),
  forma_pagamento: z.string().optional(),
  periodicidade: z.string().optional(),
  numero_parcelas: z.string().optional(),
  primeiro_vencimento: z.string().optional(),
  dia_vencimento: z.string().optional(),
  indice_reajuste: z.string().optional(),
  periodicidade_reajuste: z.string().optional(),
  renovacao_automatica: z.boolean().default(false),
  gerar_projeto: z.boolean().default(false),
  gerar_financeiro: z.boolean().default(true),
  data_emissao: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  cliente_nome: z.string().optional(),
  cliente_cpf_cnpj: z.string().optional(),
  cliente_contato_nome: z.string().optional(),
  cliente_contato_email: z.string().optional(),
  cliente_contato_tel: z.string().optional(),
  parcelas_json: z.array(schemaParcela).optional(),
  anexo_url: z.string().optional(),
  juros_ao_mes_percentual: z.coerce.number().min(0).optional(),
  multa_percentual: z.coerce.number().min(0).optional(),
});

type FormData = z.input<typeof schema>;

type StatusContrato = "RASCUNHO" | "AGUARDANDO_ASSINATURA" | "ASSINADO" | "CANCELADO";

const STATUS_CONFIG: Record<StatusContrato, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  AGUARDANDO_ASSINATURA: { label: "Ag. Assinatura", className: "bg-yellow-100 text-yellow-700" },
  ASSINADO: { label: "Assinado", className: "bg-green-100 text-green-700" },
  CANCELADO: { label: "Cancelado", className: "bg-red-100 text-red-700" },
};

interface Contrato {
  id: string;
  titulo: string;
  status: StatusContrato;
  valor_total: unknown;
  numero_contrato: string | null;
  tipo_contrato: string | null;
  objeto: string | null;
  forma_pagamento: string | null;
  periodicidade: string | null;
  numero_parcelas: number | null;
  primeiro_vencimento: Date | null;
  dia_vencimento: number | null;
  indice_reajuste: string | null;
  periodicidade_reajuste: string | null;
  renovacao_automatica: boolean;
  gerar_projeto: boolean;
  gerar_financeiro: boolean;
  data_emissao: Date | null;
  data_inicio: Date | null;
  data_fim: Date | null;
  assinado_em: Date | null;
  authentique_id: string | null;
  authentique_url: string | null;
  pdf_assinado_url: string | null;
  criado_em: Date;
  responsavel_id: string | null;
  proposta_id: string | null;
  conteudo: string | null;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_contato_nome: string | null;
  cliente_contato_email: string | null;
  cliente_contato_tel: string | null;
  cliente: { id: string; nome: string };
  proposta: { id: string; titulo: string } | null;
  responsavel: { id: string; nome: string } | null;
  recebiveis_count: number;
  parcelas_json: unknown;
  anexo_url: string | null;
  juros_ao_mes_percentual: number | null;
  multa_percentual: number | null;
}

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
}

interface PropostaAceita {
  id: string;
  titulo: string;
  cliente_id: string;
  valor_total: unknown;
  numero_parcelas: number | null;
  primeiro_vencimento: Date | null;
  forma_pagamento: string | null;
  periodicidade: string | null;
  parcelas_json: unknown;
  cliente: { nome: string };
}

interface ModeloDoc { id: string; nome: string }
interface Usuario { id: string; nome: string }
interface EmpresaConfig { email: string; representante: string }

interface Props {
  contratos: Contrato[];
  clientes: Cliente[];
  propostasAceitas: PropostaAceita[];
  propostasParaBanner: PropostaAceita[];
  modelosContrato: ModeloDoc[];
  usuarios: Usuario[];
  empresaConfig: EmpresaConfig;
}

const schemaParcelas = z.object({
  n_parcelas: z.string().min(1),
  data_primeira: z.string().min(1, "Data obrigatória"),
  valor_parcela: z.string().min(1, "Valor obrigatório"),
});
type FormParcelas = z.input<typeof schemaParcelas>;

const schemaAssinatura = z.object({
  modelo_id: z.string().optional(), // opcional quando há PDF anexado
  email_empresa: z.string().email("E-mail inválido"),
  nome_empresa: z.string().min(1, "Nome obrigatório"),
  email_cliente: z.string().email("E-mail inválido"),
  nome_cliente: z.string().min(1, "Nome obrigatório"),
});
type FormAssinatura = z.input<typeof schemaAssinatura>;

function SelectField({
  label, value, onValueChange, placeholder, children, resolvedLabel,
}: {
  label: string; value: string; onValueChange: (v: string) => void;
  placeholder?: string; children: React.ReactNode; resolvedLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Select value={value} onValueChange={(v: string | null) => onValueChange(v ?? "")}>
        <SelectTrigger className="w-full h-9 text-sm">
          {resolvedLabel
            ? <span className="truncate">{resolvedLabel}</span>
            : <SelectValue placeholder={placeholder ?? "Selecione..."} />
          }
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function CheckField({
  label, description, checked, onChange,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

export default function ContratosClient({ contratos: inicial, clientes, propostasAceitas, propostasParaBanner, modelosContrato, usuarios, empresaConfig }: Props) {
  const router = useRouter();
  const [contratos, setContratos] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<Contrato | null>(null);
  const [contratoExcluindo, setContratoExcluindo] = useState<Contrato | null>(null);
  const [contratoParcelar, setContratoParcelar] = useState<Contrato | null>(null);
  const [contratoDocumento, setContratoDocumento] = useState<Contrato | null>(null);
  const [contratoAssinatura, setContratoAssinatura] = useState<Contrato | null>(null);
  const [contratoMarcarAssinado, setContratoMarcarAssinado] = useState<Contrato | null>(null);
  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split("T")[0]);
  const [isPending, startTransition] = useTransition();
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false);
  const anexoFileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gerar_financeiro: true,
      gerar_projeto: false,
      renovacao_automatica: false,
      parcelas_json: [],
    },
  });

  const { fields: parcelasFields, replace: replaceParcelas } = useFieldArray({ control, name: "parcelas_json" as any });

  const numeroParcelas = watch("numero_parcelas");
  const primeiroVencimento = watch("primeiro_vencimento");
  const periodicidade = watch("periodicidade");
  const valorTotal = watch("valor_total");

  const distribuirIgualmente = () => {
    const n = Number(numeroParcelas) || 0;
    if (n < 1 || !primeiroVencimento) return;
    replaceParcelas(gerarParcelasIguais(n, primeiroVencimento, periodicidade, Number(valorTotal) || 0) as any);
  };

  // auto-gera quando nº parcelas e vencimento são preenchidos (e grade ainda vazia)
  useEffect(() => {
    const n = Number(numeroParcelas) || 0;
    if (n >= 1 && primeiroVencimento && parcelasFields.length === 0) {
      replaceParcelas(gerarParcelasIguais(n, primeiroVencimento, periodicidade, Number(valorTotal) || 0) as any);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroParcelas, primeiroVencimento]);

  const watchClienteId = watch("cliente_id");
  const watchRenovacao = watch("renovacao_automatica");
  const watchGerarFinanceiro = watch("gerar_financeiro");
  const watchGerarProjeto = watch("gerar_projeto");

  const preencherSnapshotCliente = (clienteId: string) => {
    const c = clientes.find((cl) => cl.id === clienteId);
    if (!c) return;
    setValue("cliente_nome", c.nome);
    setValue("cliente_cpf_cnpj", c.cpf_cnpj ?? "");
    setValue("cliente_contato_nome", c.contato_principal ?? "");
    setValue("cliente_contato_email", c.email ?? "");
    setValue("cliente_contato_tel", c.telefone ?? "");
  };

  const abrirCriar = (proposta?: PropostaAceita) => {
    setContratoEditando(null);
    if (proposta) {
      const c = clientes.find((cl) => cl.id === proposta.cliente_id);
      const parcelasPropostos = Array.isArray(proposta.parcelas_json) ? (proposta.parcelas_json as any[]) : [];
      reset({
        cliente_id: proposta.cliente_id,
        proposta_id: proposta.id,
        titulo: `Contrato — ${proposta.titulo}`,
        valor_total: String(Number(proposta.valor_total)),
        numero_parcelas: proposta.numero_parcelas ? String(proposta.numero_parcelas) : "",
        primeiro_vencimento: proposta.primeiro_vencimento
          ? new Date(proposta.primeiro_vencimento).toISOString().split("T")[0]
          : "",
        forma_pagamento: proposta.forma_pagamento ?? "",
        periodicidade: proposta.periodicidade ?? "",
        gerar_financeiro: true,
        gerar_projeto: false,
        renovacao_automatica: false,
        parcelas_json: parcelasPropostos,
        cliente_nome: c?.nome ?? "",
        cliente_cpf_cnpj: c?.cpf_cnpj ?? "",
        cliente_contato_nome: c?.contato_principal ?? "",
        cliente_contato_email: c?.email ?? "",
        cliente_contato_tel: c?.telefone ?? "",
      });
    } else {
      reset({
        gerar_financeiro: true,
        gerar_projeto: false,
        renovacao_automatica: false,
      });
    }
    setModalAberto(true);
  };

  const abrirEditar = (c: Contrato) => {
    setContratoEditando(c);
    reset({
      cliente_id: c.cliente.id,
      proposta_id: c.proposta?.id ?? "",
      responsavel_id: c.responsavel?.id ?? "",
      numero_contrato: c.numero_contrato ?? "",
      tipo_contrato: c.tipo_contrato ?? "",
      titulo: c.titulo,
      objeto: c.objeto ?? "",
      conteudo: c.conteudo ?? "",
      valor_total: c.valor_total ? String(Number(c.valor_total)) : "",
      forma_pagamento: c.forma_pagamento ?? "",
      periodicidade: c.periodicidade ?? "",
      numero_parcelas: c.numero_parcelas ? String(c.numero_parcelas) : "",
      primeiro_vencimento: c.primeiro_vencimento
        ? new Date(c.primeiro_vencimento).toISOString().split("T")[0]
        : "",
      dia_vencimento: c.dia_vencimento ? String(c.dia_vencimento) : "",
      indice_reajuste: c.indice_reajuste ?? "",
      periodicidade_reajuste: c.periodicidade_reajuste ?? "",
      renovacao_automatica: c.renovacao_automatica,
      gerar_financeiro: c.gerar_financeiro,
      gerar_projeto: c.gerar_projeto,
      data_emissao: c.data_emissao ? new Date(c.data_emissao).toISOString().split("T")[0] : "",
      data_inicio: c.data_inicio ? new Date(c.data_inicio).toISOString().split("T")[0] : "",
      data_fim: c.data_fim ? new Date(c.data_fim).toISOString().split("T")[0] : "",
      cliente_nome: c.cliente_nome ?? "",
      cliente_cpf_cnpj: c.cliente_cpf_cnpj ?? "",
      cliente_contato_nome: c.cliente_contato_nome ?? "",
      cliente_contato_email: c.cliente_contato_email ?? "",
      cliente_contato_tel: c.cliente_contato_tel ?? "",
      parcelas_json: Array.isArray(c.parcelas_json) ? (c.parcelas_json as any[]) : [],
      anexo_url: c.anexo_url ?? "",
      juros_ao_mes_percentual: c.juros_ao_mes_percentual ?? undefined,
      multa_percentual: c.multa_percentual ?? undefined,
    });
    setModalAberto(true);
  };

  const handleUploadAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contratoEditando) return;
    setUploadandoAnexo(true);
    try {
      const { criarUrlUpload } = await import("@/actions/documentos");
      const { signedUrl, caminho } = await criarUrlUpload({ arquivo_nome: file.name, mime_type: file.type || "application/pdf" });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/pdf" } });
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/documentos/${caminho}`;
      await salvarAnexoContrato(contratoEditando.id, publicUrl);
      setValue("anexo_url", publicUrl);
      setContratos(prev => prev.map(c => c.id === contratoEditando.id ? { ...c, anexo_url: publicUrl } : c));
      toast.success("Anexo salvo");
    } catch { toast.error("Erro ao enviar anexo"); }
    finally { setUploadandoAnexo(false); if (anexoFileRef.current) anexoFileRef.current.value = ""; }
  };

  const removerAnexoContrato = async () => {
    if (!contratoEditando) return;
    await salvarAnexoContrato(contratoEditando.id, null);
    setValue("anexo_url", "");
    setContratos(prev => prev.map(c => c.id === contratoEditando.id ? { ...c, anexo_url: null } : c));
    toast.success("Anexo removido");
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const payload = {
          ...data,
          valor_total: data.valor_total ? Number(data.valor_total) : undefined,
          numero_parcelas: data.numero_parcelas ? Number(data.numero_parcelas) : undefined,
          dia_vencimento: data.dia_vencimento ? Number(data.dia_vencimento) : undefined,
          renovacao_automatica: data.renovacao_automatica ?? false,
          gerar_financeiro: data.gerar_financeiro ?? true,
          gerar_projeto: data.gerar_projeto ?? false,
          juros_ao_mes_percentual: data.juros_ao_mes_percentual ? Number(data.juros_ao_mes_percentual) : null,
          multa_percentual: data.multa_percentual ? Number(data.multa_percentual) : null,
        };

        if (contratoEditando) {
          const res = await editarContrato(contratoEditando.id, payload);
          const clienteSel = clientes.find((cl) => cl.id === data.cliente_id) ?? contratoEditando.cliente;
          const responsavelSel = usuarios.find((u) => u.id === data.responsavel_id) ?? null;
          setContratos((prev) =>
            prev.map((c) =>
              c.id === contratoEditando.id
                ? { ...c, ...res.data, cliente: clienteSel, responsavel: responsavelSel, proposta: c.proposta }
                : c
            )
          );
          toast.success("Contrato atualizado");
        } else {
          const res = await criarContrato(payload);
          const clienteSel = clientes.find((cl) => cl.id === data.cliente_id)!;
          const responsavelSel = usuarios.find((u) => u.id === data.responsavel_id) ?? null;
          const propostaSel = propostasAceitas.find((p) => p.id === data.proposta_id) ?? null;
          setContratos((prev) => [
            {
              ...(res.data as unknown as Contrato),
              cliente: clienteSel,
              responsavel: responsavelSel,
              proposta: propostaSel ? { id: propostaSel.id, titulo: propostaSel.titulo } : null,
            },
            ...prev,
          ]);
          toast.success("Contrato criado");
        }
        setModalAberto(false);
      } catch {
        toast.error("Erro ao salvar contrato");
      }
    });
  };

  const formParcelas = useForm<FormParcelas>({ resolver: zodResolver(schemaParcelas) });
  const nParcelas = Number(formParcelas.watch("n_parcelas") || 1);
  const valorSugerido = contratoParcelar
    ? (Number(contratoParcelar.valor_total) / nParcelas).toFixed(2)
    : "";

  const gerarParcelasDirecto = (c: Contrato) => {
    startTransition(async () => {
      try {
        const n = c.numero_parcelas!;
        const dataP = new Date(c.primeiro_vencimento!).toISOString().split("T")[0];
        const valorP = Number(c.valor_total) / n;
        await gerarParcelasContrato(c.id, { n_parcelas: n, data_primeira: dataP, valor_parcela: valorP });
        toast.success(`${n} parcela${n > 1 ? "s" : ""} gerada${n > 1 ? "s" : ""} com sucesso!`);
        router.push("/financeiro/recebiveis");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao gerar parcelas");
      }
    });
  };

  const onSubmitParcelas = (data: FormParcelas) => {
    if (!contratoParcelar) return;
    startTransition(async () => {
      try {
        await gerarParcelasContrato(contratoParcelar.id, {
          n_parcelas: Number(data.n_parcelas),
          data_primeira: data.data_primeira,
          valor_parcela: Number(data.valor_parcela),
        });
        toast.success(`${data.n_parcelas} parcela${Number(data.n_parcelas) > 1 ? "s" : ""} gerada${Number(data.n_parcelas) > 1 ? "s" : ""}`);
        setContratoParcelar(null);
        formParcelas.reset();
        router.push("/financeiro/recebiveis");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao gerar parcelas");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!contratoExcluindo) return;
    startTransition(async () => {
      try {
        await excluirContrato(contratoExcluindo.id);
        setContratos((prev) => prev.filter((c) => c.id !== contratoExcluindo.id));
        toast.success("Contrato excluído");
        setContratoExcluindo(null);
      } catch {
        toast.error("Erro ao excluir contrato");
      }
    });
  };

  const formAssinatura = useForm<FormAssinatura>({
    resolver: zodResolver(schemaAssinatura),
  });

  const abrirAssinatura = (c: Contrato) => {
    const clienteEmail = c.cliente_contato_email ?? "";
    const clienteNome = c.cliente_nome ?? c.cliente.nome;
    formAssinatura.reset({
      modelo_id: modelosContrato.length === 1 ? modelosContrato[0].id : "",
      email_empresa: empresaConfig.email,
      nome_empresa: empresaConfig.representante,
      email_cliente: clienteEmail,
      nome_cliente: clienteNome,
    });
    setContratoAssinatura(c);
  };

  const onSubmitAssinatura = formAssinatura.handleSubmit((data) => {
    if (!contratoAssinatura) return;
    startTransition(async () => {
      try {
        const res = await enviarParaAssinatura({
          contrato_id: contratoAssinatura.id,
          modelo_id: data.modelo_id,
          email_empresa: data.email_empresa,
          nome_empresa: data.nome_empresa,
          email_cliente: data.email_cliente,
          nome_cliente: data.nome_cliente,
          sandbox: false,
        });
        if (res.ok) {
          toast.success("Contrato enviado para assinatura!");
          setContratos((prev) =>
            prev.map((c) =>
              c.id === contratoAssinatura.id
                ? { ...c, status: "AGUARDANDO_ASSINATURA" as const }
                : c
            )
          );
          setContratoAssinatura(null);
          setModalAberto(false);
          router.refresh();
        } else {
          toast.error(res.error ?? "Erro ao enviar para assinatura");
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar para assinatura");
      }
    });
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Contratos</h1>
          <Badge variant="secondary">{contratos.length}</Badge>
        </div>
        <Button onClick={() => abrirCriar()} size="sm">
          <Plus className="size-4 mr-1.5" /> Novo contrato
        </Button>
      </div>

      {propostasParaBanner.length > 0 && (
        <div className="rounded-lg border bg-accent/5 p-4 space-y-3">
          <p className="text-sm font-medium">
            Propostas aceitas aguardando contrato ({propostasParaBanner.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {propostasParaBanner.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirCriar(p)}
                className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
              >
                <LinkIcon className="size-3 text-primary" />
                {p.titulo} — {p.cliente.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Condições</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhum contrato cadastrado
                </TableCell>
              </TableRow>
            )}
            {contratos.map((c) => {
              const cfg = STATUS_CONFIG[c.status];
              return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirEditar(c)}>
                  <TableCell>
                    <p className="font-medium">{c.titulo}</p>
                    {c.numero_contrato && (
                      <p className="text-xs text-muted-foreground">#{c.numero_contrato}</p>
                    )}
                    {c.tipo_contrato && (
                      <p className="text-xs text-muted-foreground">{c.tipo_contrato}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.cliente.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.responsavel?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.forma_pagamento && <p>{c.forma_pagamento}</p>}
                    {c.numero_parcelas && c.periodicidade && (
                      <p>{c.numero_parcelas}x {c.periodicidade}</p>
                    )}
                    {!c.forma_pagamento && !c.numero_parcelas && "—"}
                  </TableCell>
                  <TableCell>
                    {c.valor_total
                      ? Number(c.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "—"}
                    {c.data_fim ? ` até ${new Date(c.data_fim).toLocaleDateString("pt-BR")}` : ""}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {modelosContrato.length > 0 && (
                        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" title="Visualizar documento"
                          onClick={() => setContratoDocumento(c)}>
                          <FileText className="size-3.5" />
                        </Button>
                      )}
                      {c.status === "RASCUNHO" && (modelosContrato.length > 0 || !!c.anexo_url) && (
                        <Button size="icon" variant="ghost" className="size-8 text-primary" title="Enviar para assinatura"
                          onClick={() => abrirAssinatura(c)}>
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      {(c.status === "RASCUNHO" || c.status === "AGUARDANDO_ASSINATURA") && (
                        <Button size="icon" variant="ghost" className="size-8 text-green-600" title="Marcar como assinado"
                          onClick={() => { setDataAssinatura(new Date().toISOString().split("T")[0]); setContratoMarcarAssinado(c); }}>
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {c.status === "AGUARDANDO_ASSINATURA" && c.authentique_url && (
                        <Button size="icon" variant="ghost" className="size-8 text-yellow-600" title="Copiar link de assinatura"
                          onClick={() => {
                            navigator.clipboard.writeText(c.authentique_url!);
                            toast.success("Link copiado!");
                          }}>
                          <Copy className="size-3.5" />
                        </Button>
                      )}
                      {c.status === "ASSINADO" && (
                        <>
                          {c.pdf_assinado_url && (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600" title="Baixar contrato assinado"
                              onClick={() => window.open(c.pdf_assinado_url!, "_blank")}>
                              <Download className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`size-8 ${c.recebiveis_count > 0 ? "text-green-600" : "text-primary"}`}
                            title={c.recebiveis_count > 0 ? `Financeiro já lançado (${c.recebiveis_count} parcelas)` : "Gerar recebíveis"}
                            disabled={isPending}
                            onClick={() => {
                              if (c.recebiveis_count > 0) {
                                toast.info(`Este contrato já tem ${c.recebiveis_count} parcela${c.recebiveis_count > 1 ? "s" : ""} lançada${c.recebiveis_count > 1 ? "s" : ""} no financeiro.`);
                                return;
                              }
                              const dadosCompletos = c.numero_parcelas && c.primeiro_vencimento && Number(c.valor_total) > 0;
                              if (dadosCompletos) {
                                gerarParcelasDirecto(c);
                              } else {
                                formParcelas.reset({
                                  n_parcelas: c.numero_parcelas ? String(c.numero_parcelas) : "1",
                                  valor_parcela: c.numero_parcelas && Number(c.valor_total) > 0
                                    ? String((Number(c.valor_total) / c.numero_parcelas).toFixed(2))
                                    : String(Number(c.valor_total || 0).toFixed(2)),
                                  data_primeira: c.primeiro_vencimento
                                    ? new Date(c.primeiro_vencimento).toISOString().split("T")[0]
                                    : "",
                                });
                                setContratoParcelar(c);
                              }
                            }}
                          >
                            <DollarSign className="size-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setContratoExcluindo(c)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw] w-[92vw] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-4 text-primary" />
              {contratoEditando ? "Editar contrato" : "Novo contrato"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Tabs defaultValue="identificacao" className="w-full">
              <div className="px-6 pt-3">
                <TabsList>
                  <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  <TabsTrigger value="datas">Datas e Reajuste</TabsTrigger>
                  <TabsTrigger value="automacoes">Automações</TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Identificação */}
              <TabsContent value="identificacao" className="mt-0">
                <div className="grid grid-cols-3 divide-x">
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Dados do Contrato</p>
                    <SelectField
                      label="Cliente *"
                      value={watch("cliente_id") ?? ""}
                      resolvedLabel={clientes.find((c) => c.id === watch("cliente_id"))?.nome}
                      onValueChange={(v) => {
                        setValue("cliente_id", v);
                        preencherSnapshotCliente(v);
                      }}
                    >
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectField>
                    {errors.cliente_id && <p className="text-destructive text-xs -mt-2">{errors.cliente_id.message}</p>}
                    <SelectField
                      label="Responsável"
                      value={watch("responsavel_id") ?? ""}
                      resolvedLabel={watch("responsavel_id") ? (usuarios.find((u) => u.id === watch("responsavel_id"))?.nome) : undefined}
                      onValueChange={(v) => setValue("responsavel_id", v || undefined)}
                      placeholder="Sem responsável"
                    >
                      <SelectItem value="">Sem responsável</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectField>
                    <Field label="Título *">
                      <Input {...register("titulo")} className="h-9 text-sm" placeholder="Ex: Contrato de Consultoria" />
                      {errors.titulo && <p className="text-destructive text-xs">{errors.titulo.message}</p>}
                    </Field>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Classificação</p>
                    <Field label="Nº do contrato">
                      <Input {...register("numero_contrato")} className="h-9 text-sm" placeholder="Ex: 001/2026" />
                    </Field>
                    <SelectField
                      label="Tipo de contrato"
                      value={watch("tipo_contrato") ?? ""}
                      onValueChange={(v) => setValue("tipo_contrato", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {TIPOS_CONTRATO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectField>
                    <SelectField
                      label="Proposta vinculada"
                      value={watch("proposta_id") ?? ""}
                      resolvedLabel={watch("proposta_id") ? (propostasAceitas.find((p) => p.id === watch("proposta_id"))?.titulo) : undefined}
                      onValueChange={(v) => setValue("proposta_id", v || undefined)}
                      placeholder="Nenhuma"
                    >
                      <SelectItem value="">Nenhuma</SelectItem>
                      {propostasAceitas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                      ))}
                    </SelectField>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Objeto</p>
                    <Field label="Objeto / Escopo">
                      <Textarea {...register("objeto")} rows={4} className="text-sm resize-none"
                        placeholder="Descrição detalhada do objeto do contrato..." />
                    </Field>

                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest">Documento para Assinatura</p>
                      <p className="text-xs text-muted-foreground">
                        Anexe o PDF do contrato. Quando presente, ele é enviado diretamente ao Autentique — sem necessidade de modelo de texto.
                      </p>
                      {watch("anexo_url") ? (
                        <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                          <FileText className="size-4 text-green-600 shrink-0" />
                          <span className="flex-1 text-xs text-green-800 truncate">PDF anexado</span>
                          <a href={watch("anexo_url")} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="size-7" title="Visualizar">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </a>
                          {contratoEditando && (
                            <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                              type="button" onClick={removerAnexoContrato} title="Remover">
                              <XIcon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => anexoFileRef.current?.click()}
                          disabled={!contratoEditando || uploadandoAnexo}
                          className="w-full flex items-center justify-center gap-2 text-xs border-2 border-dashed border-primary/30 rounded-lg py-3 hover:bg-primary/5 hover:border-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploadandoAnexo
                            ? <><span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />Enviando…</>
                            : <><Upload className="size-3.5 text-primary" />Anexar PDF do contrato</>}
                        </button>
                      )}
                      <input ref={anexoFileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUploadAnexo} />
                      {!contratoEditando && (
                        <p className="text-[10px] text-muted-foreground italic">Salve o contrato primeiro para anexar um arquivo.</p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Financeiro */}
              <TabsContent value="financeiro" className="mt-0">
                <div className="grid grid-cols-3 divide-x">
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Valor e Pagamento</p>
                    <Field label="Valor total (R$)">
                      <Input {...register("valor_total")} type="number" step="0.01" min="0" className="h-9 text-sm" placeholder="0,00" />
                    </Field>
                    <SelectField
                      label="Forma de pagamento"
                      value={watch("forma_pagamento") ?? ""}
                      onValueChange={(v) => setValue("forma_pagamento", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectField>
                    <SelectField
                      label="Periodicidade"
                      value={watch("periodicidade") ?? ""}
                      onValueChange={(v) => setValue("periodicidade", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectField>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <Field label="Juros a.m. (%)">
                        <Input {...register("juros_ao_mes_percentual")} type="number" step="0.01" min="0" className="h-9 text-sm" placeholder="Ex: 1,00" />
                      </Field>
                      <Field label="Multa (%)">
                        <Input {...register("multa_percentual")} type="number" step="0.01" min="0" className="h-9 text-sm" placeholder="Ex: 2,00" />
                      </Field>
                    </div>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Parcelas</p>
                    <Field label="Nº de parcelas">
                      <Input {...register("numero_parcelas")} type="number" min="1" className="h-9 text-sm" placeholder="Ex: 12" />
                    </Field>
                    <Field label="1º vencimento">
                      <Input {...register("primeiro_vencimento")} type="date" className="h-9 text-sm" />
                    </Field>
                    <Field label="Dia do vencimento">
                      <Input {...register("dia_vencimento")} type="number" min="1" max="31" className="h-9 text-sm" placeholder="Ex: 10" />
                    </Field>

                    {/* Grade de parcelas */}
                    {(parcelasFields as any[]).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Grade de Parcelas</p>
                          <button type="button" onClick={distribuirIgualmente} className="text-[10px] text-primary hover:underline">
                            Distribuir igualmente
                          </button>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="px-2 py-1.5 text-left text-muted-foreground font-medium w-8">#</th>
                                <th className="px-2 py-1.5 text-left text-muted-foreground font-medium">Vencimento</th>
                                <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Valor (R$)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(parcelasFields as any[]).map((p, idx) => (
                                <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                                  <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                                  <td className="px-2 py-1">
                                    <input
                                      {...register(`parcelas_json.${idx}.vencimento` as any)}
                                      type="date"
                                      className="w-full border-0 bg-transparent text-xs outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      {...register(`parcelas_json.${idx}.valor` as any, { valueAsNumber: true })}
                                      type="number" step="0.01" min="0"
                                      className="w-full border-0 bg-transparent text-xs text-right outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t bg-muted/30">
                                <td colSpan={2} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-right">Total:</td>
                                <td className="px-2 py-1.5 text-xs font-bold text-right">
                                  {(watch("parcelas_json") as any[] ?? []).reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {Number(numeroParcelas) >= 1 && primeiroVencimento && (parcelasFields as any[]).length === 0 && (
                      <button
                        type="button"
                        onClick={distribuirIgualmente}
                        className="w-full text-xs text-primary border border-dashed border-primary/40 rounded-md py-2 hover:bg-primary/5 transition-colors"
                      >
                        + Gerar grade de parcelas
                      </button>
                    )}
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Texto / Cláusulas</p>
                    <Field label="Conteúdo do contrato">
                      <Textarea {...register("conteudo")} rows={10} className="text-sm resize-none font-mono"
                        placeholder="Texto completo do contrato ou cláusulas..." />
                    </Field>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Datas e Reajuste */}
              <TabsContent value="datas" className="mt-0">
                <div className="grid grid-cols-3 divide-x">
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Vigência</p>
                    <Field label="Data de emissão">
                      <Input {...register("data_emissao")} type="date" className="h-9 text-sm" />
                    </Field>
                    <Field label="Início da vigência">
                      <Input {...register("data_inicio")} type="date" className="h-9 text-sm" />
                    </Field>
                    <Field label="Término da vigência">
                      <Input {...register("data_fim")} type="date" className="h-9 text-sm" />
                    </Field>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Reajuste</p>
                    <SelectField
                      label="Índice de reajuste"
                      value={watch("indice_reajuste") ?? ""}
                      onValueChange={(v) => setValue("indice_reajuste", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Nenhum</SelectItem>
                      {INDICES_REAJUSTE.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectField>
                    <SelectField
                      label="Periodicidade do reajuste"
                      value={watch("periodicidade_reajuste") ?? ""}
                      onValueChange={(v) => setValue("periodicidade_reajuste", v || undefined)}
                      placeholder="Selecione..."
                    >
                      <SelectItem value="">Não informado</SelectItem>
                      {PERIODICIDADES_REAJUSTE.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectField>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Renovação</p>
                    <CheckField
                      label="Renovação automática"
                      description="Contrato renova ao fim da vigência sem intervenção manual"
                      checked={!!watchRenovacao}
                      onChange={(v) => setValue("renovacao_automatica", v)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Automações */}
              <TabsContent value="automacoes" className="mt-0">
                <div className="grid grid-cols-2 divide-x">
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest">Automações ao Assinar</p>
                    <CheckField
                      label="Gerar financeiro (recebíveis)"
                      description="Cria as parcelas de recebíveis automaticamente ao marcar como assinado"
                      checked={!!watchGerarFinanceiro}
                      onChange={(v) => setValue("gerar_financeiro", v)}
                    />
                    <CheckField
                      label="Gerar projeto"
                      description="Cria um projeto vinculado ao contrato automaticamente"
                      checked={!!watchGerarProjeto}
                      onChange={(v) => setValue("gerar_projeto", v)}
                    />
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest">Snapshot do Cliente</p>
                      {watchClienteId && (
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => preencherSnapshotCliente(watchClienteId)}>
                          <RefreshCw className="size-3 mr-1" /> Atualizar
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dados do cliente gravados no contrato no momento da criação (não são atualizados automaticamente).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome do cliente">
                        <Input {...register("cliente_nome")} className="h-9 text-sm" />
                      </Field>
                      <Field label="CPF/CNPJ">
                        <Input {...register("cliente_cpf_cnpj")} className="h-9 text-sm" />
                      </Field>
                      <Field label="Contato (nome)">
                        <Input {...register("cliente_contato_nome")} className="h-9 text-sm" />
                      </Field>
                      <Field label="Contato (telefone)">
                        <Input {...register("cliente_contato_tel")} className="h-9 text-sm" />
                      </Field>
                      <div className="col-span-2">
                        <Field label="Contato (e-mail)">
                          <Input {...register("cliente_contato_email")} type="email" className="h-9 text-sm" />
                        </Field>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="px-6 pt-4 pb-6 border-t bg-muted/20 flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>

              {/* Visualizar documento */}
              {contratoEditando && modelosContrato.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (modelosContrato.length === 1) {
                      window.open(`/modelos/${modelosContrato[0].id}/preview?contrato_id=${contratoEditando.id}`, "_blank");
                    } else {
                      setModalAberto(false);
                      setContratoDocumento(contratoEditando);
                    }
                  }}
                >
                  <Printer className="size-4 mr-2" />
                  Visualizar
                </Button>
              )}
              {contratoEditando && modelosContrato.length === 0 && (
                <Button type="button" variant="outline" onClick={() => window.open("/modelos", "_blank")}>
                  <FileText className="size-4 mr-2" />
                  Criar template
                </Button>
              )}

              {/* Enviar para assinatura */}
              {contratoEditando && contratoEditando.status === "RASCUNHO" && (modelosContrato.length > 0 || !!contratoEditando.anexo_url) && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-primary border-primary hover:bg-primary/5"
                  disabled={isPending}
                  onClick={() => { setModalAberto(false); abrirAssinatura(contratoEditando); }}
                >
                  <Send className="size-4 mr-2" />
                  Enviar para assinatura
                </Button>
              )}

              {/* Marcar como assinado — disponível em rascunho e aguardando */}
              {contratoEditando && (contratoEditando.status === "RASCUNHO" || contratoEditando.status === "AGUARDANDO_ASSINATURA") && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  disabled={isPending}
                  onClick={() => { setModalAberto(false); setDataAssinatura(new Date().toISOString().split("T")[0]); setContratoMarcarAssinado(contratoEditando); }}
                >
                  <CheckCircle className="size-4 mr-2" />
                  Marcar como assinado
                </Button>
              )}

              {/* Aguardando assinatura */}
              {contratoEditando && contratoEditando.status === "AGUARDANDO_ASSINATURA" && (
                <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1.5">
                  <RefreshCw className="size-3 animate-spin" />
                  Aguardando assinatura
                  {contratoEditando.authentique_url && (
                    <button
                      type="button"
                      className="ml-1 underline underline-offset-2 hover:no-underline"
                      onClick={() => { navigator.clipboard.writeText(contratoEditando.authentique_url ?? ""); toast.success("Link copiado!"); }}
                    >
                      Copiar link
                    </button>
                  )}
                </div>
              )}

              {/* Contrato assinado */}
              {contratoEditando && contratoEditando.status === "ASSINADO" && contratoEditando.pdf_assinado_url && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => window.open(contratoEditando.pdf_assinado_url!, "_blank")}
                >
                  <Download className="size-4 mr-2" />
                  Baixar PDF assinado
                </Button>
              )}

              {/* Gerar recebíveis — só aparece quando ASSINADO e sem parcelas */}
              {contratoEditando && contratoEditando.status === "ASSINADO" && contratoEditando.recebiveis_count === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-primary border-primary hover:bg-primary/5"
                  disabled={isPending}
                  onClick={() => {
                    const n = contratoEditando.numero_parcelas;
                    const venc = contratoEditando.primeiro_vencimento;
                    const val = Number(contratoEditando.valor_total);
                    if (n && venc && val > 0) {
                      gerarParcelasDirecto(contratoEditando);
                    } else {
                      formParcelas.reset({
                        n_parcelas: n ? String(n) : "1",
                        valor_parcela: n && val > 0 ? String((val / n).toFixed(2)) : String(val.toFixed(2)),
                        data_primeira: venc ? new Date(venc).toISOString().split("T")[0] : "",
                      });
                      setContratoParcelar(contratoEditando);
                    }
                  }}
                >
                  <DollarSign className="size-4 mr-2" />
                  Calcular parcelas
                </Button>
              )}

              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : contratoEditando ? "Salvar alterações" : "Criar contrato"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal gerar parcelas */}
      <Dialog open={!!contratoParcelar} onOpenChange={(v) => !v && setContratoParcelar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar recebíveis — {contratoParcelar?.titulo}</DialogTitle>
          </DialogHeader>
          <form onSubmit={formParcelas.handleSubmit(onSubmitParcelas)} className="space-y-3">
            {contratoParcelar?.valor_total != null && Number(contratoParcelar.valor_total) > 0 && (
              <p className="text-xs text-muted-foreground">
                Valor do contrato:{" "}
                <strong>{Number(contratoParcelar.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nº de parcelas *</Label>
                <Input {...formParcelas.register("n_parcelas")} type="number" min="1" max="60" />
              </div>
              <div className="space-y-1">
                <Label>Data da 1ª parcela *</Label>
                <Input {...formParcelas.register("data_primeira")} type="date" />
                {formParcelas.formState.errors.data_primeira && (
                  <p className="text-xs text-destructive">{formParcelas.formState.errors.data_primeira.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valor por parcela (R$) *</Label>
              <Input {...formParcelas.register("valor_parcela")} type="number" step="0.01" min="0.01"
                placeholder={valorSugerido || "0,00"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContratoParcelar(null)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Gerando..." : "Gerar parcelas"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal gerar documento */}
      <Dialog open={!!contratoDocumento} onOpenChange={(v) => !v && setContratoDocumento(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerar documento — {contratoDocumento?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o modelo de contrato:</p>
          <div className="space-y-2">
            {modelosContrato.map((m) => (
              <button
                key={m.id}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
                onClick={() => {
                  setContratoDocumento(null);
                  window.open(`/modelos/${m.id}/preview?contrato_id=${contratoDocumento!.id}`, "_blank");
                }}
              >
                {m.nome}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContratoDocumento(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal enviar para assinatura */}
      <Dialog open={!!contratoAssinatura} onOpenChange={(v) => !v && setContratoAssinatura(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              Enviar para Assinatura
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitAssinatura} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O contrato <strong>{contratoAssinatura?.titulo}</strong> será enviado para assinatura eletrônica via Authentique. Ambos receberão um e-mail com o link para assinar.
            </p>

            {contratoAssinatura?.anexo_url ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <FileText className="size-4 text-green-600 shrink-0" />
                <span>Será enviado o <strong>PDF anexado</strong> ao contrato.</span>
                <a href={contratoAssinatura.anexo_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-700 underline">Visualizar</a>
              </div>
            ) : modelosContrato.length > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modelo de Contrato *</Label>
                <Select
                  value={formAssinatura.watch("modelo_id")}
                  onValueChange={(v) => formAssinatura.setValue("modelo_id", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo...">
                      {(value: string | null) => value ? (modelosContrato.find((m) => m.id === value)?.nome ?? value) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {modelosContrato.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : modelosContrato.length === 1 ? (
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary">
                <FileText className="size-4 shrink-0" />
                <span>Modelo: <strong>{modelosContrato[0].nome}</strong></span>
              </div>
            ) : null}

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Signatário 1 — Empresa</p>
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do representante</Label>
                  <Input {...formAssinatura.register("nome_empresa")} placeholder="Ex: João Silva" />
                  {formAssinatura.formState.errors.nome_empresa && (
                    <p className="text-xs text-destructive">{formAssinatura.formState.errors.nome_empresa.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input {...formAssinatura.register("email_empresa")} type="email" placeholder="representante@empresa.com.br" />
                  {formAssinatura.formState.errors.email_empresa && (
                    <p className="text-xs text-destructive">{formAssinatura.formState.errors.email_empresa.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Signatário 2 — Cliente</p>
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do cliente</Label>
                  <Input {...formAssinatura.register("nome_cliente")} placeholder="Nome completo" />
                  {formAssinatura.formState.errors.nome_cliente && (
                    <p className="text-xs text-destructive">{formAssinatura.formState.errors.nome_cliente.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input {...formAssinatura.register("email_cliente")} type="email" placeholder="cliente@email.com" />
                  {formAssinatura.formState.errors.email_cliente && (
                    <p className="text-xs text-destructive">{formAssinatura.formState.errors.email_cliente.message}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContratoAssinatura(null)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Enviando..." : (
                  <><Send className="size-4 mr-2" />Enviar para Assinatura</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Marcar como assinado */}
      <AlertDialog open={!!contratoMarcarAssinado} onOpenChange={(v) => !v && setContratoMarcarAssinado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              Marcar como assinado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O contrato <strong>{contratoMarcarAssinado?.titulo}</strong> será marcado como assinado.
              Use esta opção quando o contrato foi assinado de outra forma (papel, outro sistema, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2 space-y-1.5">
            <Label className="text-sm">Data de assinatura</Label>
            <Input
              type="date"
              value={dataAssinatura}
              onChange={(e) => setDataAssinatura(e.target.value)}
              className="h-9"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={async () => {
                if (!contratoMarcarAssinado) return;
                const res = await marcarAssinado(contratoMarcarAssinado.id, dataAssinatura);
                if (res.ok) {
                  setContratos(prev => prev.map(c =>
                    c.id === contratoMarcarAssinado.id
                      ? { ...c, status: "ASSINADO" as const, assinado_em: new Date(dataAssinatura) }
                      : c
                  ));
                  toast.success("Contrato marcado como assinado!");
                  setContratoMarcarAssinado(null);
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              }}
            >
              <CheckCircle className="size-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!contratoExcluindo} onOpenChange={(v) => !v && setContratoExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato <strong>{contratoExcluindo?.titulo}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
