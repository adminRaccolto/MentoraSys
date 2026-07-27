"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search, Phone, MapPin, Banknote, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { criarFornecedor, editarFornecedor, excluirFornecedor } from "@/actions/fornecedores";

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const TIPOS_CHAVE_PIX = ["CPF/CNPJ", "E-mail", "Telefone", "Chave aleatória"];
const TIPOS_CONTA = ["Conta Corrente", "Conta Poupança", "Conta Pagamento"];

const schemaForm = z.object({
  nome:           z.string().min(1, "Nome obrigatório"),
  cnpj_cpf:       z.string().optional(),
  email:          z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone:       z.string().optional(),
  whatsapp:       z.string().optional(),
  nome_contato:   z.string().optional(),
  cargo_contato:  z.string().optional(),
  cep:            z.string().optional(),
  logradouro:     z.string().optional(),
  numero:         z.string().optional(),
  complemento:    z.string().optional(),
  bairro:         z.string().optional(),
  cidade:         z.string().optional(),
  estado:         z.string().optional(),
  banco:          z.string().optional(),
  agencia:        z.string().optional(),
  conta:          z.string().optional(),
  tipo_conta:     z.string().optional(),
  chave_pix:      z.string().optional(),
  tipo_chave_pix: z.string().optional(),
  observacoes:    z.string().optional(),
});

type FormData = z.input<typeof schemaForm>;

interface Fornecedor {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  nome_contato: string | null;
  cargo_contato: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: Date;
}

interface Props {
  fornecedores: Fornecedor[];
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

export default function FornecedoresClient({ fornecedores: inicial }: Props) {
  const [fornecedores, setFornecedores] = useState(inicial);
  const [busca, setBusca] = useState("");
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [excluindo, setExcluindo] = useState<Fornecedor | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({ resolver: zodResolver(schemaForm) });

  const EMPTY: FormData = {
    nome: "", cnpj_cpf: "", email: "", telefone: "", whatsapp: "",
    nome_contato: "", cargo_contato: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    banco: "", agencia: "", conta: "", tipo_conta: "",
    chave_pix: "", tipo_chave_pix: "",
    observacoes: "",
  };

  const abrirNovo = () => {
    form.reset(EMPTY);
    setEditando(null);
    setModalNovo(true);
  };

  const abrirEditar = (f: Fornecedor) => {
    form.reset({
      nome: f.nome,
      cnpj_cpf: f.cnpj_cpf ?? "",
      email: f.email ?? "",
      telefone: f.telefone ?? "",
      whatsapp: f.whatsapp ?? "",
      nome_contato: f.nome_contato ?? "",
      cargo_contato: f.cargo_contato ?? "",
      cep: f.cep ?? "",
      logradouro: f.logradouro ?? "",
      numero: f.numero ?? "",
      complemento: f.complemento ?? "",
      bairro: f.bairro ?? "",
      cidade: f.cidade ?? "",
      estado: f.estado ?? "",
      banco: f.banco ?? "",
      agencia: f.agencia ?? "",
      conta: f.conta ?? "",
      tipo_conta: f.tipo_conta ?? "",
      chave_pix: f.chave_pix ?? "",
      tipo_chave_pix: f.tipo_chave_pix ?? "",
      observacoes: f.observacoes ?? "",
    });
    setEditando(f);
    setModalNovo(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        if (editando) {
          const updated = await editarFornecedor(editando.id, data);
          setFornecedores((prev) => prev.map((f) => f.id === editando.id ? { ...f, ...updated } : f));
          toast.success("Fornecedor atualizado");
        } else {
          const novo = await criarFornecedor(data);
          setFornecedores((prev) => [...prev, novo as Fornecedor]);
          toast.success("Fornecedor cadastrado");
        }
        setModalNovo(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  };

  const handleExcluir = () => {
    if (!excluindo) return;
    startTransition(async () => {
      try {
        await excluirFornecedor(excluindo.id);
        setFornecedores((prev) => prev.filter((f) => f.id !== excluindo.id));
        toast.success("Fornecedor removido");
        setExcluindo(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao remover");
      }
    });
  };

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (!json.erro) {
        form.setValue("logradouro", json.logradouro ?? "");
        form.setValue("bairro", json.bairro ?? "");
        form.setValue("cidade", json.localidade ?? "");
        form.setValue("estado", json.uf ?? "");
      }
    } catch {
      // silently ignore CEP lookup errors
    }
  };

  const filtrados = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj_cpf ?? "").includes(busca) ||
    (f.email ?? "").toLowerCase().includes(busca.toLowerCase()) ||
    (f.cidade ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            {fornecedores.length} fornecedor{fornecedores.length !== 1 ? "es" : ""} cadastrado{fornecedores.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={abrirNovo} className="gap-2">
          <Plus className="size-4" /> Novo fornecedor
        </Button>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, CNPJ/CPF, e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Building2 className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{busca ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado ainda."}</p>
          {!busca && <Button variant="outline" className="mt-4" onClick={abrirNovo}>Cadastrar primeiro fornecedor</Button>}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ / CPF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>E-mail / WhatsApp</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((f) => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirEditar(f)}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{f.cnpj_cpf ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.nome_contato ? (
                      <span>{f.nome_contato}{f.cargo_contato && <span className="text-xs ml-1 opacity-60">({f.cargo_contato})</span>}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {f.email && <div>{f.email}</div>}
                    {f.whatsapp && <div className="text-xs opacity-70">{f.whatsapp}</div>}
                    {!f.email && !f.whatsapp && "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.cidade ? `${f.cidade}${f.estado ? ` / ${f.estado}` : ""}` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(f)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setExcluindo(f)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal criar / editar */}
      <Dialog open={modalNovo} onOpenChange={(v) => { setModalNovo(v); if (!v) { setEditando(null); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Dados Básicos */}
            <SectionTitle icon={Building2} label="Dados Básicos" />
            <div className="space-y-1.5">
              <Label>Nome / Razão Social *</Label>
              <Input className="h-10" {...form.register("nome")} placeholder="Ex.: Papelaria Central Ltda" />
              {form.formState.errors.nome && <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CNPJ / CPF</Label>
                <Input className="h-10" {...form.register("cnpj_cpf")} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input className="h-10" {...form.register("telefone")} placeholder="(00) 0000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input className="h-10" {...form.register("email")} type="email" placeholder="contato@empresa.com" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <Input className="h-10" {...form.register("whatsapp")} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {/* Pessoa de Contato */}
            <SectionTitle icon={Phone} label="Pessoa de Contato" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do contato</Label>
                <Input className="h-10" {...form.register("nome_contato")} placeholder="Pessoa responsável" />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input className="h-10" {...form.register("cargo_contato")} placeholder="Ex.: Gerente Comercial" />
              </div>
            </div>

            {/* Endereço */}
            <SectionTitle icon={MapPin} label="Endereço" />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input
                  className="h-10"
                  {...form.register("cep")}
                  placeholder="00000-000"
                  onBlur={(e) => buscarCep(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Logradouro</Label>
                <Input className="h-10" {...form.register("logradouro")} placeholder="Rua, Av., etc." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input className="h-10" {...form.register("numero")} placeholder="123" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Complemento</Label>
                <Input className="h-10" {...form.register("complemento")} placeholder="Apto, Sala, Bloco..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input className="h-10" {...form.register("bairro")} placeholder="Bairro" />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input className="h-10" {...form.register("cidade")} placeholder="Cidade" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                {(() => {
                  const estadoAtual = form.watch("estado");
                  return (
                    <Select value={estadoAtual || ""} onValueChange={(v) => form.setValue("estado", v || "")}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="UF">{estadoAtual || undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {ESTADOS_BR.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            </div>

            {/* Dados Bancários */}
            <SectionTitle icon={Banknote} label="Dados Bancários" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input className="h-10" {...form.register("banco")} placeholder="Ex.: Banco do Brasil" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                {(() => {
                  const tipoAtual = form.watch("tipo_conta");
                  return (
                    <Select value={tipoAtual || ""} onValueChange={(v) => form.setValue("tipo_conta", v || "")}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecionar">{tipoAtual || undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {TIPOS_CONTA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input className="h-10" {...form.register("agencia")} placeholder="0000-0" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input className="h-10" {...form.register("conta")} placeholder="00000-0" />
              </div>
            </div>

            {/* Chave Pix */}
            <SectionTitle icon={QrCode} label="Chave Pix" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de chave</Label>
                {(() => {
                  const tipoAtual = form.watch("tipo_chave_pix");
                  return (
                    <Select value={tipoAtual || ""} onValueChange={(v) => form.setValue("tipo_chave_pix", v || "")}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecionar">{tipoAtual || undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {TIPOS_CHAVE_PIX.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              <div className="space-y-1.5">
                <Label>Chave Pix</Label>
                <Input className="h-10" {...form.register("chave_pix")} placeholder="CPF, e-mail, telefone ou chave..." />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea className="resize-none" {...form.register("observacoes")} rows={2} placeholder="Informações adicionais..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNovo(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor <strong>{excluindo?.nome}</strong> será desativado. Esta ação pode ser revertida pelo suporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
