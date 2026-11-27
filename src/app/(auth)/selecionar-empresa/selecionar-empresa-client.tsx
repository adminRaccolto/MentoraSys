"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, X, Loader2, ChevronRight } from "lucide-react";
import { criarEmpresa } from "@/actions/empresas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
});

interface Membro {
  empresa: { id: string; nome: string; logo_url: string | null; plano: string };
  perfil: { nome: string };
}

const PLANO_LABEL: Record<string, string> = {
  BASICO: "Básico",
  PROFISSIONAL: "Profissional",
  ENTERPRISE: "Enterprise",
};

export default function SelecionarEmpresaClient({ membros }: { membros: Membro[] }) {
  const router = useRouter();
  const [selecionando, setSelecionando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onCriar = async (data: z.input<typeof schema>) => {
    setErro(null);
    const res = await criarEmpresa(data);
    if (res.ok) {
      await fetch("/api/auth/empresa", {
        method: "POST",
        body: JSON.stringify({ empresaId: res.empresaId }),
        headers: { "Content-Type": "application/json" },
      });
      router.push("/dashboard");
      router.refresh();
    }
  };

  const selecionar = async (empresaId: string) => {
    setSelecionando(empresaId);
    await fetch("/api/auth/empresa", {
      method: "POST",
      body: JSON.stringify({ empresaId }),
      headers: { "Content-Type": "application/json" },
    });
    router.push("/dashboard");
    router.refresh();
  };

  if (criando) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">Nova empresa</h1>
          <Button type="button" variant="ghost" size="icon" aria-label="Voltar à seleção de empresa"
            onClick={() => { setCriando(false); reset(); setErro(null); }}>
            <X className="size-5" aria-hidden />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onCriar)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="empresa-nome" className="block text-sm font-medium">Razão social ou nome</label>
            <Input id="empresa-nome" {...register("nome")} className="h-11 bg-background"
              aria-invalid={Boolean(errors.nome)} aria-describedby={errors.nome ? "erro-nome-empresa" : undefined} />
            {errors.nome && <p id="erro-nome-empresa" className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="empresa-cnpj" className="block text-sm font-medium">CNPJ</label>
            <Input id="empresa-cnpj" {...register("cnpj")} placeholder="00.000.000/0001-00" className="h-11 bg-background" />
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isSubmitting ? "Criando…" : "Criar empresa"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl leading-tight tracking-tight">Selecione a empresa</h1>
      {membros.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada ainda.</p>}
      {membros.length > 0 && (
        <ul className="space-y-2">
          {membros.map(({ empresa, perfil }) => (
            <li key={empresa.id}>
              <button type="button" disabled={!!selecionando} onClick={() => selecionar(empresa.id)}
                className="group flex w-full items-center gap-2.5 rounded-xl border bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted disabled:opacity-60 sm:gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  {selecionando === empresa.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Building2 className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold">{empresa.nome}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{perfil.nome}</span>
                </span>
                <Badge variant="secondary" className="hidden sm:inline-flex">{PLANO_LABEL[empresa.plano] ?? empresa.plano}</Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t pt-4">
        <Button type="button" variant="outline" className="w-full" onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden /> Criar nova empresa
        </Button>
      </div>
    </div>
  );
}
