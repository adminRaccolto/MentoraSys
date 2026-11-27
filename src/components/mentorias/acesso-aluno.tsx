"use client";

import { useActionState, useState } from "react";
import { gerarSenhaAluno } from "@/actions/mentorias";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AcessoAluno({ mentoriaId, alunoId, email, cadastrado }: {
  mentoriaId: string; alunoId: string; email?: string | null; cadastrado: boolean;
}) {
  const [estado, executar, pendente] = useActionState(gerarSenhaAluno.bind(null, mentoriaId, alunoId), {});
  const [copiada, setCopiada] = useState<string | null>(null);
  const acesso = estado.acesso;

  async function copiar(dados: { email: string; senha: string }) {
    try {
      await navigator.clipboard.writeText(`Área do Aluno de O Conselho Agro\n${new URL("/portal/acesso", location.origin)}\nE-mail: ${dados.email}\nSenha provisória: ${dados.senha}`);
      setCopiada(dados.senha);
    } catch {
      setCopiada(null);
    }
  }

  return (
    <details className="min-w-0 rounded-lg border px-3 py-1.5 text-sm">
      <summary className="cursor-pointer font-medium">{cadastrado ? "Redefinir senha" : "Criar acesso do aluno"}</summary>
      <form action={executar} className="mt-3 space-y-3">
        {cadastrado && <p className="text-xs text-muted-foreground">Ao redefinir a senha, as sessões abertas do aluno serão encerradas.</p>}
        <label className="block text-sm font-medium">E-mail de acesso
          <Input key={email ?? ""} name="email" type="email" required maxLength={254} defaultValue={email ?? ""} className="mt-1" />
        </label>
        <Button size="sm" type="submit" variant="outline" disabled={pendente}>{pendente ? "Gerando…" : "Gerar senha provisória"}</Button>
        {estado.erro && <p role="alert" className="text-sm text-destructive">{estado.erro}</p>}
        {acesso && (
          <div className="space-y-2 rounded-md bg-secondary p-3">
            <p className="font-medium">Senha provisória do aluno</p>
            <p className="break-all text-xs">{acesso.email}</p>
            <code className="block break-all">{acesso.senha}</code>
            <p className="text-xs text-muted-foreground">Compartilhe o acesso com o aluno. A senha vence em sete dias e será trocada no primeiro acesso.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => copiar(acesso)}>{copiada === acesso.senha ? "Copiado" : "Copiar dados de acesso"}</Button>
          </div>
        )}
      </form>
    </details>
  );
}
