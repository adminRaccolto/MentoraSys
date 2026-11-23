"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FilePlus2, Eye, Send, Copy, CheckCircle, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  listarAditivos,
  previaAditivo,
  criarAditivo,
  enviarAditivoParaAssinatura,
  marcarAditivoAssinado,
  excluirAditivo,
  conteudoAditivo,
} from "@/actions/aditivos";
import { ordinalAditivo } from "@/lib/aditivo";
import { resolverValoresReembolso } from "@/lib/clausula-reembolso";
import { VERSOES_ARATO, type VersaoArato } from "@/lib/clausula-probono";

type Status = "RASCUNHO" | "AGUARDANDO_ASSINATURA" | "ASSINADO" | "CANCELADO";

const STATUS: Record<Status, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  AGUARDANDO_ASSINATURA: { label: "Ag. Assinatura", className: "bg-yellow-100 text-yellow-700" },
  ASSINADO: { label: "Assinado", className: "bg-green-100 text-green-700" },
  CANCELADO: { label: "Cancelado", className: "bg-red-100 text-red-700" },
};

type Aditivo = Awaited<ReturnType<typeof listarAditivos>>[number];

export interface ContratoAditivavel {
  id: string;
  titulo: string;
  numero_contrato: string | null;
  cliente_nome: string | null;
  cliente_contato_nome: string | null;
  cliente_contato_email: string | null;
  cliente: { nome: string };
  probono_arato: boolean;
  probono_versao: string | null;
  probono_meses: number | null;
  reembolso_valor_km: number | null;
  reembolso_distancia_km: number | null;
  reembolso_limite_alimentacao: number | null;
  reembolso_limite_hospedagem: number | null;
}

interface Props {
  contrato: ContratoAditivavel | null;
  onClose: () => void;
  cliente: { email: string | null; preco_km: number | null; distancia_km: number | null } | null;
  empresaConfig: { email: string; representante: string };
}

const schema = z
  .object({
    inclui_reembolso: z.boolean(),
    inclui_probono: z.boolean(),
    texto_livre: z.string().optional(),
    nome_empresa: z.string().min(1, "Obrigatório"),
    email_empresa: z.string().email("E-mail inválido"),
    nome_cliente: z.string().min(1, "Obrigatório"),
    email_cliente: z.string().email("E-mail inválido"),
  })
  .refine((d) => d.inclui_reembolso || d.inclui_probono || !!d.texto_livre?.trim(), {
    message: "Selecione ao menos uma alteração",
    path: ["texto_livre"],
  });
type Form = z.input<typeof schema>;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function conteudoResumo(a: Aditivo) {
  return [a.inclui_reembolso && "Reembolso de despesas", a.inclui_probono && "Pro Bono Arato", a.texto_livre && "Outras alterações"]
    .filter(Boolean)
    .join(" · ");
}

export function AditivosDialog({ contrato, onClose, cliente, empresaConfig }: Props) {
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novo, setNovo] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Aditivo | null>(null);
  const [assinando, setAssinando] = useState<Aditivo | null>(null);
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, watch, getValues, trigger, formState: { errors } } = form;

  const probonoConfigurado = !!contrato?.probono_arato && !!contrato.probono_versao && !!contrato.probono_meses;

  const recarregar = (id: string) => {
    setCarregando(true);
    listarAditivos(id)
      .then(setAditivos)
      .catch(() => toast.error("Erro ao carregar aditivos"))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    if (!contrato) return;
    setNovo(false);
    setEnviando(null);
    setAssinando(null);
    setAditivos([]);
    recarregar(contrato.id);
    reset({
      inclui_reembolso: true,
      inclui_probono: false,
      texto_livre: "",
      nome_empresa: empresaConfig.representante,
      email_empresa: empresaConfig.email,
      nome_cliente: contrato.cliente_contato_nome || contrato.cliente_nome || contrato.cliente.nome,
      email_cliente: contrato.cliente_contato_email || cliente?.email || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato?.id]);

  if (!contrato) return null;

  const reembolso = resolverValoresReembolso({
    reembolso_despesas: true,
    reembolso_valor_km: contrato.reembolso_valor_km,
    reembolso_distancia_km: contrato.reembolso_distancia_km,
    reembolso_limite_alimentacao: contrato.reembolso_limite_alimentacao,
    reembolso_limite_hospedagem: contrato.reembolso_limite_hospedagem,
    cliente_preco_km: cliente?.preco_km,
    cliente_distancia_km: cliente?.distancia_km,
  });
  const resumoReembolso = [
    reembolso.valorKm ? `${brl(reembolso.valorKm)}/km` : "sem valor por km",
    reembolso.distanciaKm && `${reembolso.distanciaKm.toLocaleString("pt-BR")} km por deslocamento`,
    reembolso.limiteAlimentacao && `alimentação até ${brl(reembolso.limiteAlimentacao)}/dia`,
    reembolso.limiteHospedagem && `hospedagem até ${brl(reembolso.limiteHospedagem)}/diária`,
  ].filter(Boolean).join(" · ");

  const conteudo = () => {
    const v = getValues();
    return { contrato_id: contrato.id, inclui_reembolso: v.inclui_reembolso, inclui_probono: v.inclui_probono, texto_livre: v.texto_livre };
  };

  const visualizarNovo = async () => {
    if (!(await trigger(["inclui_reembolso", "inclui_probono", "texto_livre"]))) return;
    startTransition(async () => {
      const r = await previaAditivo(conteudo());
      if (!r.ok) return void toast.error(r.error);
      setPrevia(r.html);
    });
  };

  const visualizarExistente = (a: Aditivo) => {
    startTransition(async () => {
      const html = await conteudoAditivo(a.id);
      if (!html) return void toast.error("Conteúdo do aditivo não encontrado");
      setPrevia(html);
    });
  };

  const enviar = (aditivoId: string, v: Form) =>
    enviarAditivoParaAssinatura({
      aditivo_id: aditivoId,
      nome_empresa: v.nome_empresa,
      email_empresa: v.email_empresa,
      nome_cliente: v.nome_cliente,
      email_cliente: v.email_cliente,
    });

  const salvar = (enviarAgora: boolean) =>
    handleSubmit((v) => {
      startTransition(async () => {
        const criado = await criarAditivo(conteudo());
        if (!criado.ok) return void toast.error(criado.error);
        if (enviarAgora) {
          const r = await enviar(criado.id, v);
          if (!r.ok) toast.error(`Aditivo salvo, mas não foi enviado: ${r.error}`);
          else toast.success("Aditivo enviado para assinatura");
        } else {
          toast.success("Aditivo salvo como rascunho");
        }
        setNovo(false);
        recarregar(contrato.id);
      });
    })();

  const enviarExistente = () =>
    handleSubmit((v) => {
      if (!enviando) return;
      startTransition(async () => {
        const r = await enviar(enviando.id, v);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Aditivo enviado para assinatura");
        setEnviando(null);
        recarregar(contrato.id);
      });
    })();

  const confirmarAssinatura = () => {
    if (!assinando) return;
    startTransition(async () => {
      const r = await marcarAditivoAssinado(assinando.id, dataAssinatura);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Aditivo marcado como assinado");
      setAssinando(null);
      recarregar(contrato.id);
    });
  };

  const excluir = (a: Aditivo) => {
    if (!confirm(`Excluir o ${ordinalAditivo(a.numero).toLowerCase()} termo aditivo?`)) return;
    startTransition(async () => {
      const r = await excluirAditivo(a.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Aditivo excluído");
      recarregar(contrato.id);
    });
  };

  const camposSignatarios = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Representante da empresa</Label>
        <Input {...register("nome_empresa")} />
        {errors.nome_empresa && <p className="text-xs text-destructive">{errors.nome_empresa.message}</p>}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">E-mail da empresa</Label>
        <Input type="email" {...register("email_empresa")} />
        {errors.email_empresa && <p className="text-xs text-destructive">{errors.email_empresa.message}</p>}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Signatário do cliente</Label>
        <Input {...register("nome_cliente")} />
        {errors.nome_cliente && <p className="text-xs text-destructive">{errors.nome_cliente.message}</p>}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">E-mail do cliente</Label>
        <Input type="email" {...register("email_cliente")} />
        {errors.email_cliente && <p className="text-xs text-destructive">{errors.email_cliente.message}</p>}
      </div>
    </div>
  );

  const proximo = (aditivos.at(-1)?.numero ?? 0) + 1;

  return (
    <>
      <Dialog open={!!contrato} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="size-4 text-primary" />
              Aditivos — {contrato.numero_contrato ?? contrato.titulo}
            </DialogTitle>
          </DialogHeader>

          {carregando ? (
            <p className="text-sm text-muted-foreground py-4">Carregando...</p>
          ) : aditivos.length === 0 ? (
            !novo && <p className="text-sm text-muted-foreground py-2">Nenhum aditivo para este contrato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aditivo</TableHead>
                  <TableHead>Alterações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {aditivos.map((a) => {
                  const st = STATUS[a.status as Status];
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {a.numero}º Termo Aditivo
                        <p className="text-xs text-muted-foreground font-normal">
                          {a.assinado_em
                            ? `Assinado em ${new Date(a.assinado_em).toLocaleDateString("pt-BR")}`
                            : `Criado em ${new Date(a.criado_em).toLocaleDateString("pt-BR")}`}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{conteudoResumo(a)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.className}`}>{st.label}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="size-8" title="Visualizar" disabled={isPending} onClick={() => visualizarExistente(a)}>
                            <Eye className="size-3.5" />
                          </Button>
                          {a.status === "RASCUNHO" && (
                            <Button size="icon" variant="ghost" className="size-8 text-primary" title="Enviar para assinatura"
                              onClick={() => { setNovo(false); setAssinando(null); setEnviando(a); }}>
                              <Send className="size-3.5" />
                            </Button>
                          )}
                          {a.status === "AGUARDANDO_ASSINATURA" && a.authentique_url && (
                            <Button size="icon" variant="ghost" className="size-8 text-yellow-600" title="Copiar link de assinatura"
                              onClick={() => { navigator.clipboard.writeText(a.authentique_url!); toast.success("Link copiado!"); }}>
                              <Copy className="size-3.5" />
                            </Button>
                          )}
                          {(a.status === "RASCUNHO" || a.status === "AGUARDANDO_ASSINATURA") && (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600" title="Marcar como assinado"
                              onClick={() => { setNovo(false); setEnviando(null); setDataAssinatura(new Date().toISOString().split("T")[0]); setAssinando(a); }}>
                              <CheckCircle className="size-3.5" />
                            </Button>
                          )}
                          {a.pdf_assinado_url && (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600" title="Baixar aditivo assinado"
                              onClick={() => window.open(a.pdf_assinado_url!, "_blank")}>
                              <Download className="size-3.5" />
                            </Button>
                          )}
                          {a.status !== "ASSINADO" && (
                            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" title="Excluir"
                              disabled={isPending} onClick={() => excluir(a)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {enviando && (
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Enviar o {enviando.numero}º Termo Aditivo para assinatura</p>
              {camposSignatarios}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEnviando(null)}>Cancelar</Button>
                <Button size="sm" disabled={isPending} onClick={enviarExistente}>
                  <Send className="size-3.5 mr-1.5" />
                  {isPending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}

          {assinando && (
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Marcar o {assinando.numero}º Termo Aditivo como assinado</p>
              <div className="space-y-1 max-w-48">
                <Label className="text-xs">Data da assinatura</Label>
                <Input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssinando(null)}>Cancelar</Button>
                <Button size="sm" disabled={isPending} onClick={confirmarAssinatura}>Confirmar</Button>
              </div>
            </div>
          )}

          {novo ? (
            <div className="rounded-md border p-4 space-y-4">
              <p className="text-sm font-medium">{proximo}º Termo Aditivo</p>

              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-1" {...register("inclui_reembolso")} />
                  <span>
                    Reembolso de despesas (nova redação do item 4.4.2)
                    <span className="block text-xs text-muted-foreground">
                      {resumoReembolso} — valores da aba Despesas do contrato.
                    </span>
                    {watch("inclui_reembolso") && !reembolso.valorKm && (
                      <span className="block text-xs text-amber-600">
                        Sem valor por km no contrato nem no cadastro do cliente: a cláusula sairá sem valor definido.
                      </span>
                    )}
                  </span>
                </label>

                <label className={`flex items-start gap-2 text-sm ${probonoConfigurado ? "cursor-pointer" : "opacity-60"}`}>
                  <input type="checkbox" className="mt-1" disabled={!probonoConfigurado} {...register("inclui_probono")} />
                  <span>
                    Cessão pro bono do sistema Arato
                    <span className="block text-xs text-muted-foreground">
                      {probonoConfigurado
                        ? `Versão ${VERSOES_ARATO[contrato.probono_versao as VersaoArato] ?? contrato.probono_versao}, ${contrato.probono_meses} ${contrato.probono_meses === 1 ? "mês" : "meses"} a partir da data do aditivo.`
                        : "Ligue e configure na aba Pro Bono Arato do contrato para incluir."}
                    </span>
                  </span>
                </label>

                <div className="space-y-1">
                  <Label className="text-xs">Outras alterações (opcional)</Label>
                  <Textarea rows={3} placeholder="Texto livre que entra como cláusula própria do aditivo" {...register("texto_livre")} />
                  {errors.texto_livre && <p className="text-xs text-destructive">{errors.texto_livre.message}</p>}
                </div>
              </div>

              <Separator />
              <p className="text-xs text-muted-foreground">Signatários (empresa e cliente)</p>
              {camposSignatarios}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setNovo(false)}>Cancelar</Button>
                <Button variant="outline" size="sm" disabled={isPending} onClick={visualizarNovo}>
                  <Eye className="size-3.5 mr-1.5" />
                  Pré-visualizar
                </Button>
                <Button variant="outline" size="sm" disabled={isPending} onClick={() => salvar(false)}>Salvar rascunho</Button>
                <Button size="sm" disabled={isPending} onClick={() => salvar(true)}>
                  <Send className="size-3.5 mr-1.5" />
                  {isPending ? "Processando..." : "Criar e enviar para assinatura"}
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={() => { setEnviando(null); setAssinando(null); setNovo(true); }} disabled={carregando}>
                <FilePlus2 className="size-4 mr-2" />
                Novo aditivo
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previa} onOpenChange={(v) => !v && setPrevia(null)}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Pré-visualização do aditivo</DialogTitle>
          </DialogHeader>
          {previa && <iframe title="Aditivo" srcDoc={previa} className="flex-1 w-full bg-white" sandbox="" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
