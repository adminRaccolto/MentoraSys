"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

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
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-[2rem] leading-tight tracking-tight sm:text-[2.45rem]">Entrar na Raccolto</h1>
        <p className="mt-2 text-sm text-muted-foreground">Acesse com o e-mail da sua conta.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">E-mail</label>
          <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email"
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "erro-email" : undefined}
            {...register("email")} className="h-11 bg-background" />
          {errors.email && <p id="erro-email" className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <label htmlFor="senha" className="text-sm font-medium">Senha</label>
            <Link href="/recuperar-senha" className="text-xs font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary">
              Esqueceu a senha?
            </Link>
          </div>
          <Input id="senha" type="password" autoComplete="current-password"
            aria-invalid={Boolean(errors.senha)} aria-describedby={errors.senha ? "erro-senha" : undefined}
            {...register("senha")} className="h-11 bg-background" />
          {errors.senha && <p id="erro-senha" className="text-xs text-destructive">{errors.senha.message}</p>}
        </div>

        {erro && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erro}</p>}

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full justify-between px-4 text-sm font-semibold">
          {isSubmitting ? "Entrando…" : "Entrar"}
          {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </form>

      <p className="border-t pt-4 text-sm text-muted-foreground">
        <a href="mailto:suporte@raccolto.com.br" className="font-medium text-primary underline underline-offset-4">Suporte para acesso</a>
      </p>
    </div>
  );
}
