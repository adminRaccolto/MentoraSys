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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-primary">Recuperar senha</CardTitle>
        <CardDescription>
          Enviaremos um link para redefinir sua senha
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enviado ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifique seu e-mail e siga o link enviado.
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar link"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/login" className="hover:text-primary">
                Voltar ao login
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
