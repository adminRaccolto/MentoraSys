"use client";

import { useActionState } from "react";
import { definirSenhaPortalAluno, entrarPortalAluno } from "@/actions/portal-aluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const estiloCampo = "mt-1.5 h-11 bg-background";

export function PortalAlunoFormulario({ troca = false }: { troca?: boolean }) {
  const [resultado, executar, pendente] = useActionState(troca ? definirSenhaPortalAluno : entrarPortalAluno, {});

  return (
    <form action={executar} className="space-y-4">
      {!troca && (
        <label className="block text-sm font-medium">E-mail
          <Input name="email" type="email" autoComplete="username" required maxLength={254} className={estiloCampo} />
        </label>
      )}
      <label className="block text-sm font-medium">{troca ? "Nova senha" : "Senha"}
        <Input name="senha" type="password" autoComplete={troca ? "new-password" : "current-password"}
          required minLength={troca ? 12 : undefined} maxLength={128} className={estiloCampo} />
      </label>
      {troca && (
        <label className="block text-sm font-medium">Confirme a nova senha
          <Input name="confirmacao" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={estiloCampo} />
        </label>
      )}
      {resultado.erro && <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{resultado.erro}</p>}
      <Button type="submit" disabled={pendente} className="h-11 w-full">
        {pendente ? "Aguarde…" : troca ? "Salvar senha e entrar" : "Entrar"}
      </Button>
    </form>
  );
}
