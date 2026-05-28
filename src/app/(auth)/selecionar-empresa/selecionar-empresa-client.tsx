"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

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

  if (membros.length === 0) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-primary">Sem acesso</CardTitle>
          <CardDescription>
            Você não está vinculado a nenhuma empresa. Solicite um convite ao administrador.
          </CardDescription>
        </CardHeader>
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
      </CardContent>
    </Card>
  );
}
