"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, senha }: FormData) => {
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { setErro("E-mail ou senha incorretos."); return; }
    router.push("/selecionar-empresa");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B4F72]">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground mt-1">Entre na sua conta para continuar</p>
      </div>

      {/* formulário */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            className="h-11"
            {...register("email")}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="senha" className="text-sm font-medium">Senha</Label>
            <Link
              href="/recuperar-senha"
              className="text-xs text-[#1B4F72] hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Input
            id="senha"
            type="password"
            placeholder="••••••••"
            className="h-11"
            {...register("senha")}
          />
          {errors.senha && <p className="text-destructive text-xs">{errors.senha.message}</p>}
        </div>

        {erro && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-destructive text-sm">{erro}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 bg-[#1B4F72] hover:bg-[#1B4F72]/90 text-white font-medium"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <><Loader2 className="size-4 mr-2 animate-spin" /> Entrando...</>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        Problemas para acessar?{" "}
        <a href="mailto:suporte@mentorasys.com.br" className="text-[#1B4F72] hover:underline">
          Fale conosco
        </a>
      </p>
    </div>
  );
}
