"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

type FormData = z.infer<typeof schema>;

export default function RecuperarSenhaPage() {
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setEnviado(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl leading-tight tracking-tight">Recuperar senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {enviado ? "Verifique seu e-mail e siga o link enviado." : "Informe seu e-mail para receber um link de redefinição."}
        </p>
      </div>
      {!enviado && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register("email")}
              className="h-11 bg-background" aria-invalid={Boolean(errors.email)} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
      <p className="border-t pt-4 text-sm"><Link href="/login" className="font-medium text-primary underline underline-offset-4">Voltar ao login</Link></p>
    </div>
  );
}
