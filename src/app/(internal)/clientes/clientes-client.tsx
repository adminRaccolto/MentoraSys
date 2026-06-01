"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, XCircle, Users, Building2, Phone, Mail, MapPin, Link2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarCliente, editarCliente, excluirCliente, deletarCliente } from "@/actions/clientes";
import { gerarConviteCliente } from "@/actions/convites";

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["PESSOA_FISICA", "PESSOA_JURIDICA"]),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT"]),
  nome_fantasia: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  contato_principal: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  nome_fazenda: z.string().optional(),
  distancia_km: z.coerce.number().nonnegative().optional().nullable(),
  preco_km: z.coerce.number().nonnegative().optional().nullable(),
});

type FormData = z.input<typeof schema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  nome: string;
  tipo: "PESSOA_FISICA" | "PESSOA_JURIDICA";
  status: "ATIVO" | "INATIVO" | "PROSPECT";
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
  inscricao_estadual: string | null;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  nome_fazenda: string | null;
  distancia_km: number | null;
  preco_km: number | null;
}

// ─── Masks ───────────────────────────────────────────────────────────────────

function maskCpfCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3").replace(/(\d{3})(\d{0,3})/, "$1.$2").replace(/(\d{0,3})/, "$1");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4").replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3").replace(/(\d{2})(\d{0,3})/, "$1.$2").replace(/(\d{0,2})/, "$1");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/(\d{2})(\d{0,4})/, "($1) $2").replace(/(\d{0,2})/, "($1");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, "$1-$2");
}

// ─── ViaCEP ──────────────────────────────────────────────────────────────────

type ViaCepResp = { logradouro?: string; complemento?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ATIVO: { label: "Ativo", variant: "default" as const },
  PROSPECT: { label: "Prospect", variant: "secondary" as const },
  INATIVO: { label: "Inativo", variant: "outline" as const },
};

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
      {children}
    </p>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-destructive text-[10px]">{error}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClientesClient({ clientes: inicial }: { clientes: Cliente[] }) {
  const [clientes, setClientes] = useState(inicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteExcluindo, setClienteExcluindo] = useState<Cliente | null>(null);
  const [clienteDeletando, setClienteDeletando] = useState<Cliente | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const [linkConvite, setLinkConvite] = useState<string | null>(null);

  const handleGerarConvite = () => {
    startTransition(async () => {
      try {
        const res = await gerarConviteCliente();
        if (res.ok) setLinkConvite(res.url);
      } catch {
        toast.error("Erro ao gerar link de convite");
      }
    });
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "PESSOA_JURIDICA", status: "ATIVO" },
  });

  const tipoPessoa = watch("tipo");

  const clientesFiltrados = clientes.filter((c) => {
    const q = busca.toLowerCase();
    const matchBusca =
      !q ||
      c.nome.toLowerCase().includes(q) ||
      (c.nome_fantasia?.toLowerCase().includes(q) ?? false) ||
      (c.cpf_cnpj?.includes(q) ?? false) ||
      (c.cidade?.toLowerCase().includes(q) ?? false);
    return matchBusca && (!filtroStatus || c.status === filtroStatus);
  });

  const abrirCriar = () => {
    setClienteEditando(null);
    reset({ tipo: "PESSOA_JURIDICA", status: "ATIVO" });
    setModalAberto(true);
  };

  const abrirEditar = (c: Cliente) => {
    setClienteEditando(c);
    reset({
      nome: c.nome,
      tipo: c.tipo,
      status: c.status,
      nome_fantasia: c.nome_fantasia ?? "",
      cpf_cnpj: c.cpf_cnpj ?? "",
      inscricao_estadual: c.inscricao_estadual ?? "",
      contato_principal: c.contato_principal ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      whatsapp: c.whatsapp ?? "",
      cep: c.cep ?? "",
      logradouro: c.logradouro ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      bairro: c.bairro ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      nome_fazenda: c.nome_fazenda ?? "",
      distancia_km: c.distancia_km != null ? Number(c.distancia_km) : undefined,
      preco_km: c.preco_km != null ? Number(c.preco_km) : undefined,
    });
    setModalAberto(true);
  };

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCepResp = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      if (data.logradouro) setValue("logradouro", data.logradouro);
      if (data.bairro) setValue("bairro", data.bairro);
      if (data.localidade) setValue("cidade", data.localidade);
      if (data.uf) setValue("estado", data.uf);
    } catch {
      toast.error("Não foi possível consultar o CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const onSubmit = (data: FormData) => {
    // coerce.number() tem tipo unknown em z.input — converter explicitamente
    const payload = {
      ...data,
      distancia_km: data.distancia_km as number | null | undefined,
      preco_km: data.preco_km as number | null | undefined,
    };
    startTransition(async () => {
      try {
        if (clienteEditando) {
          const res = await editarCliente(clienteEditando.id, payload);
          setClientes((prev) =>
            prev.map((c) => (c.id === clienteEditando.id ? { ...c, ...(res.data as unknown as Cliente) } : c))
          );
          toast.success("Cliente atualizado");
        } else {
          const res = await criarCliente(payload);
          setClientes((prev) => [...prev, res.data as unknown as Cliente]);
          toast.success("Cliente criado");
        }
        setModalAberto(false);
      } catch {
        toast.error("Erro ao salvar cliente");
      }
    });
  };

  const confirmarExcluir = () => {
    if (!clienteExcluindo) return;
    startTransition(async () => {
      try {
        await excluirCliente(clienteExcluindo.id);
        setClientes((prev) =>
          prev.map((c) => (c.id === clienteExcluindo.id ? { ...c, status: "INATIVO" as const } : c))
        );
        toast.success("Cliente desativado");
        setClienteExcluindo(null);
      } catch {
        toast.error("Erro ao desativar cliente");
      }
    });
  };

  const confirmarDeletar = () => {
    if (!clienteDeletando) return;
    startTransition(async () => {
      const res = await deletarCliente(clienteDeletando.id);
      if (res.ok) {
        setClientes((prev) => prev.filter((c) => c.id !== clienteDeletando.id));
        toast.success("Cliente excluído permanentemente");
      } else {
        toast.error(res.error);
      }
      setClienteDeletando(null);
    });
  };

  const statusTabs = [
    { value: "", label: "Todos", count: clientes.length },
    { value: "ATIVO", label: "Ativos", count: clientes.filter((c) => c.status === "ATIVO").length },
    { value: "PROSPECT", label: "Prospects", count: clientes.filter((c) => c.status === "PROSPECT").length },
    { value: "INATIVO", label: "Inativos", count: clientes.filter((c) => c.status === "INATIVO").length },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Clientes</h1>
          <Badge variant="secondary">{clientes.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGerarConvite} disabled={isPending}>
            <Link2 className="size-4 mr-1.5" /> Gerar link de cadastro
          </Button>
          <Button onClick={abrirCriar} size="sm">
            <Plus className="size-4 mr-1.5" /> Novo cliente
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nome, cidade ou CPF/CNPJ..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex rounded-md border overflow-hidden text-sm">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFiltroStatus(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroStatus === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Fantasia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {busca || filtroStatus ? "Nenhum cliente corresponde à busca." : "Nenhum cliente cadastrado."}
                </TableCell>
              </TableRow>
            )}
            {clientesFiltrados.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => abrirEditar(c)}
              >
                <TableCell>
                  <p className="font-medium">{c.nome}</p>
                  {c.nome_fantasia && <p className="text-xs text-muted-foreground">{c.nome_fantasia}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{c.tipo === "PESSOA_JURIDICA" ? "PJ" : "PF"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div className="space-y-0.5">
                    {(c.whatsapp || c.telefone) && (
                      <div className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {c.whatsapp || c.telefone}
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {c.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.cidade || c.estado ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[c.cidade, c.estado].filter(Boolean).join(" / ")}
                    </div>
                  ) : "—"}
                  {c.nome_fazenda && <p className="text-xs flex items-center gap-1"><Building2 className="size-3" />{c.nome_fazenda}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_CONFIG[c.status]?.variant ?? "outline"}>
                    {STATUS_CONFIG[c.status]?.label ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEditar(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="size-7 text-orange-500 hover:text-orange-600"
                      title="Desativar cliente"
                      onClick={() => setClienteExcluindo(c)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      title="Excluir permanentemente"
                      onClick={() => setClienteDeletando(c)}
                    >
                      <XCircle className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Modal criar/editar — layout horizontal 4 colunas ── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw] w-[92vw] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle>{clienteEditando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Grade horizontal: 4 seções lado a lado */}
            <div className="grid grid-cols-4 divide-x px-6 py-5 gap-0">

              {/* ── Col 1: Identificação ──────────────────────── */}
              <div className="pr-6 space-y-3">
                <SectionLabel>Identificação</SectionLabel>

                <Field label="Tipo de pessoa">
                  <Select
                    value={watch("tipo")}
                    onValueChange={(v) => setValue("tipo", v as "PESSOA_FISICA" | "PESSOA_JURIDICA")}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue>
                        {watch("tipo") === "PESSOA_JURIDICA" ? "Pessoa jurídica" : "Pessoa física"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PESSOA_JURIDICA">Pessoa jurídica</SelectItem>
                      <SelectItem value="PESSOA_FISICA">Pessoa física</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Status">
                  <Select
                    value={watch("status")}
                    onValueChange={(v) => setValue("status", v as "ATIVO" | "INATIVO" | "PROSPECT")}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue>
                        {{ ATIVO: "Ativo", PROSPECT: "Prospect", INATIVO: "Inativo" }[watch("status")] ?? ""}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="PROSPECT">Prospect</SelectItem>
                      <SelectItem value="INATIVO">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label={tipoPessoa === "PESSOA_JURIDICA" ? "Razão social *" : "Nome completo *"}
                  error={errors.nome?.message}
                >
                  <Input {...register("nome")} className="h-9 text-sm" />
                </Field>

                <Field label="Nome fantasia">
                  <Input {...register("nome_fantasia")} className="h-9 text-sm" />
                </Field>

                <Field label={tipoPessoa === "PESSOA_JURIDICA" ? "CNPJ" : "CPF"}>
                  <Input
                    {...register("cpf_cnpj")}
                    className="h-9 text-sm"
                    onChange={(e) => setValue("cpf_cnpj", maskCpfCnpj(e.target.value))}
                    value={watch("cpf_cnpj") ?? ""}
                    placeholder={tipoPessoa === "PESSOA_JURIDICA" ? "00.000.000/0001-00" : "000.000.000-00"}
                  />
                </Field>

                <Field label="Inscrição estadual">
                  <Input {...register("inscricao_estadual")} className="h-9 text-sm" />
                </Field>

                <Field label="Contato principal">
                  <Input {...register("contato_principal")} className="h-9 text-sm" placeholder="Ex.: Ana Souza" />
                </Field>
              </div>

              {/* ── Col 2: Contato ────────────────────────────── */}
              <div className="px-6 space-y-3">
                <SectionLabel>Contato</SectionLabel>

                <Field label="E-mail" error={errors.email?.message}>
                  <Input {...register("email")} type="email" className="h-9 text-sm" placeholder="contato@empresa.com" />
                </Field>

                <Field label="Telefone">
                  <Input
                    {...register("telefone")}
                    className="h-9 text-sm"
                    onChange={(e) => setValue("telefone", maskPhone(e.target.value))}
                    value={watch("telefone") ?? ""}
                    placeholder="(00) 0000-0000"
                  />
                </Field>

                <Field label="WhatsApp">
                  <Input
                    {...register("whatsapp")}
                    className="h-9 text-sm"
                    onChange={(e) => setValue("whatsapp", maskPhone(e.target.value))}
                    value={watch("whatsapp") ?? ""}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
              </div>

              {/* ── Col 3: Endereço ───────────────────────────── */}
              <div className="px-6 space-y-3">
                <SectionLabel>Endereço</SectionLabel>

                <Field label={loadingCep ? "CEP (buscando…)" : "CEP"}>
                  <Input
                    {...register("cep")}
                    className="h-9 text-sm"
                    placeholder="00000-000"
                    onChange={(e) => setValue("cep", maskCep(e.target.value))}
                    value={watch("cep") ?? ""}
                    onBlur={(e) => buscarCep(e.target.value)}
                  />
                </Field>

                <Field label="Logradouro">
                  <Input {...register("logradouro")} className="h-9 text-sm" />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Número">
                    <Input {...register("numero")} className="h-9 text-sm" />
                  </Field>
                  <Field label="Complemento">
                    <Input {...register("complemento")} className="h-9 text-sm" />
                  </Field>
                </div>

                <Field label="Bairro">
                  <Input {...register("bairro")} className="h-9 text-sm" />
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Cidade">
                      <Input {...register("cidade")} className="h-9 text-sm" />
                    </Field>
                  </div>
                  <Field label="UF">
                    <Input {...register("estado")} className="h-9 text-sm" maxLength={2} />
                  </Field>
                </div>
              </div>

              {/* ── Col 4: Propriedade ────────────────────────── */}
              <div className="pl-6 space-y-3">
                <SectionLabel>Propriedade</SectionLabel>

                <Field label="Nome da fazenda / propriedade">
                  <Input {...register("nome_fazenda")} className="h-9 text-sm" placeholder="Ex.: Fazenda São João" />
                </Field>

                <Field label="Distância p/ deslocamento (km)">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    {...register("distancia_km")}
                    className="h-9 text-sm"
                    placeholder="0"
                  />
                </Field>

                <Field label="Preço por km (R$)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("preco_km")}
                    className="h-9 text-sm"
                    placeholder="0,00"
                  />
                </Field>
              </div>
            </div>

            <DialogFooter className="px-6 pb-5 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : clienteEditando ? "Salvar alterações" : "Cadastrar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar desativação */}
      <AlertDialog open={!!clienteExcluindo} onOpenChange={(v) => !v && setClienteExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{clienteExcluindo?.nome}</strong> será marcado como <em>Inativo</em> e não aparecerá nas listagens padrão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-white hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão permanente */}
      <AlertDialog open={!!clienteDeletando} onOpenChange={(v) => !v && setClienteDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                O cliente <strong>{clienteDeletando?.nome}</strong> será removido do banco de dados e esta ação <strong>não pode ser desfeita</strong>.
              </span>
              <span className="block text-xs text-muted-foreground">
                Se o cliente possuir contratos, propostas, recebíveis ou leads vinculados, a exclusão será bloqueada — desative-o em vez de excluir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarDeletar}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal link de convite */}
      <Dialog open={!!linkConvite} onOpenChange={(v) => !v && setLinkConvite(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" />
              Link de cadastro gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie este link pelo WhatsApp ou e-mail. O cliente preenche os dados e o cadastro é criado automaticamente. Válido por 30 dias.
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-600 flex-1 break-all font-mono">{linkConvite}</p>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(linkConvite ?? "");
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkConvite(null)}>Fechar</Button>
            <Button onClick={() => { navigator.clipboard.writeText(linkConvite ?? ""); toast.success("Link copiado!"); }}>
              <Copy className="size-4 mr-2" /> Copiar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
