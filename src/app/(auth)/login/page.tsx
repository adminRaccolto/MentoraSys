"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
      {/* cabeçalho */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
        <p className="text-sm text-white/60 mt-1">Entre na sua conta para continuar</p>
      </div>

      {/* formulário */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-white/80 block">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            {...register("email")}
            className="w-full h-11 rounded-lg px-3 text-sm text-white placeholder:text-white/35 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(212,172,13,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212,172,13,0.12)"; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          {errors.email && <p className="text-red-300 text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="senha" className="text-sm font-medium text-white/80">
              Senha
            </label>
            <Link href="/recuperar-senha" className="text-xs text-[#D4AC0D] hover:text-[#D4AC0D]/80 transition-colors">
              Esqueceu a senha?
            </Link>
          </div>
          <input
            id="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("senha")}
            className="w-full h-11 rounded-lg px-3 text-sm text-white placeholder:text-white/35 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(212,172,13,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212,172,13,0.12)"; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          {errors.senha && <p className="text-red-300 text-xs">{errors.senha.message}</p>}
        </div>

        {erro && (
          <div className="rounded-lg px-4 py-3" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-red-300 text-sm">{erro}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-lg font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          style={{ background: "#D4AC0D", color: "#1B4F72" }}
          onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = "#c9a20c"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#D4AC0D"; }}
        >
          {isSubmitting ? (
            <><Loader2 className="size-4 animate-spin" /> Entrando...</>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      <p className="text-xs text-center text-white/40">
        Problemas para acessar?{" "}
        <a href="mailto:suporte@raccolto.com.br" className="text-white/60 hover:text-white transition-colors underline underline-offset-2">
          Fale conosco
        </a>
      </p>
    </div>
  );
}
