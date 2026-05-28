"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, X } from "lucide-react";
import { criarEmpresa } from "@/actions/empresas";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
});

interface Membro {
  empresa: { id: string; nome: string; logo_url: string | null; plano: string };
  perfil: { nome: string };
}

interface Props {
  membros: Membro[];
}

export default function SelecionarEmpresaClient({ membros }: Props) {
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
    // Salva empresa ativa em cookie via route handler
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-primary">Nova Empresa</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setCriando(false); reset(); setErro(null); }}>
              <X className="size-4" />
            </Button>
          </div>
          <CardDescription>Preencha os dados da nova empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCriar)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Razão Social / Nome *</Label>
              <Input {...register("nome")} placeholder="Ex: Raccolto Agronegócios Ltda" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input {...register("cnpj")} placeholder="00.000.000/0001-00" />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-primary">Selecione a empresa</CardTitle>
        <CardDescription>Escolha com qual empresa deseja trabalhar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {membros.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhuma empresa vinculada ainda.
          </p>
        )}
        {membros.map(({ empresa, perfil }) => (
          <Button
            key={empresa.id}
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            disabled={selecionando === empresa.id}
            onClick={() => selecionar(empresa.id)}
          >
            <Building2 className="size-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="font-medium">{empresa.nome}</p>
              <p className="text-xs text-muted-foreground">{perfil.nome}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {empresa.plano}
            </Badge>
          </Button>
        ))}
        <div className="pt-2 border-t">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={() => setCriando(true)}>
            <Plus className="size-4" />
            Criar nova empresa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
