"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aceitarConvite } from "@/actions/equipe";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  senha: z.string().min(8, "Mínimo 8 caracteres"),
  confirmar: z.string(),
}).refine((d) => d.senha === d.confirmar, {
  message: "As senhas não coincidem",
  path: ["confirmar"],
});

type FormData = z.input<typeof schema>;

interface Props {
  token: string;
  convite: {
    email: string;
    empresa: { nome: string; logo_url: string | null };
  };
}

export default function MembroConviteClient({ token, convite }: Props) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setErro(null);
    const res = await aceitarConvite(token, { nome: data.nome, senha: data.senha });
    if (res.ok) {
      setAceito(true);
      setTimeout(() => router.push("/login"), 3000);
    } else {
      setErro(res.error);
    }
  };

  if (aceito) {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <CheckCircle className="size-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold">Conta criada com sucesso!</h2>
          <p className="text-sm text-muted-foreground">
            Redirecionando para o login...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        {convite.empresa.logo_url ? (
          <img
            src={convite.empresa.logo_url}
            alt={convite.empresa.nome}
            className="h-10 object-contain mx-auto mb-2"
          />
        ) : (
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="size-6 text-primary" />
            <span className="font-semibold text-primary">{convite.empresa.nome}</span>
          </div>
        )}
        <CardTitle className="text-xl">Você foi convidado</CardTitle>
        <CardDescription>
          Crie sua senha para acessar <strong>{convite.empresa.nome}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={convite.email} disabled className="bg-muted" />
          </div>

          <div className="space-y-1.5">
            <Label>Seu nome completo *</Label>
            <Input {...register("nome")} placeholder="Como você se chama?" />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Senha *</Label>
            <Input {...register("senha")} type="password" placeholder="Mínimo 8 caracteres" />
            {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Confirmar senha *</Label>
            <Input {...register("confirmar")} type="password" placeholder="Repita a senha" />
            {errors.confirmar && <p className="text-xs text-destructive">{errors.confirmar.message}</p>}
          </div>

          {erro && <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{erro}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Criando conta..." : "Criar conta e entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
