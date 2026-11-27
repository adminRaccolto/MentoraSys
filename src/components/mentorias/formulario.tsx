"use client";

import { useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmarPresenca } from "@/actions/mentorias";

type Resultado = { erro?: string; sucesso?: string; link?: string };
type Acao = (anterior: Resultado, form: FormData) => Promise<Resultado>;

export function Formulario({
  acao, botao, children, className = "space-y-3", variant = "outline",
}: {
  acao: Acao;
  botao: string;
  children?: ReactNode;
  className?: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [estado, executar, pendente] = useActionState(acao, {});
  const [copiado, setCopiado] = useState(false);
  const acessoPortal = estado.link?.startsWith("/portal/acesso/");

  async function copiarLink(caminho: string) {
    try {
      await navigator.clipboard.writeText(new URL(caminho, location.origin).href);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <form action={executar} className={className}>
      {children}
      <Button size="sm" type="submit" variant={variant} disabled={pendente}>{pendente ? "Salvando…" : botao}</Button>
      {estado.erro && <p className="text-sm text-destructive" role="alert">{estado.erro}</p>}
      {estado.sucesso && <p className="text-sm text-muted-foreground" role="status">{estado.sucesso}</p>}
      {estado.link && acessoPortal && (
        <div className="space-y-2">
          <Button type="button" size="sm" variant="outline" onClick={() => copiarLink(estado.link!)}>{copiado ? "Copiado" : "Copiar link de acesso"}</Button>
          <a className="ml-2 text-sm text-primary underline" href={estado.link} target="_blank" rel="noreferrer">Abrir link</a>
        </div>
      )}
      {estado.link && !acessoPortal && <Link className="ml-2 text-sm text-primary underline" href={estado.link}>Abrir mentoria</Link>}
    </form>
  );
}


export function CheckinMentoria({ mentoriaId, encontroId, abre, fecha, agora }: {
  mentoriaId: string; encontroId: string; abre: number; fecha: number; agora: number;
}) {
  const [horario, setHorario] = useState(agora);
  useEffect(() => {
    const intervalo = window.setInterval(() => setHorario(Date.now()), 5000);
    return () => window.clearInterval(intervalo);
  }, []);

  if (horario < abre) return <p className="text-sm text-muted-foreground">O check-in abre 30 minutos antes do encontro.</p>;
  if (horario > fecha) return null;
  return <Formulario acao={confirmarPresenca.bind(null, mentoriaId, encontroId)} botao="Fazer check-in" />;
}

export function AnexarArquivo({ alunoId, biblioteca = false }: { alunoId: string; biblioteca?: boolean }) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [resultado, setResultado] = useState<Resultado>({});

  async function anexar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dados = new FormData(form);
    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0 || arquivo.size > 4 * 1024 * 1024) {
      setResultado({ erro: "Selecione um arquivo de até 4 MB." });
      return;
    }

    setPendente(true);
    setResultado({});
    try {
      const resposta = await fetch(`/portal/mentorias/${biblioteca ? "biblioteca" : "arquivos"}/${alunoId}`, { method: "POST", body: dados });
      if (!resposta.headers.get("content-type")?.includes("application/json")) throw new Error();
      const retorno: Resultado = await resposta.json();
      setResultado(retorno);
      if (resposta.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setResultado({ erro: "Não foi possível anexar o documento." });
    } finally {
      setPendente(false);
    }
  }

  return (
    <form onSubmit={anexar} className="space-y-2">
      {biblioteca && (
        <label className="block text-sm font-medium">Categoria
          <input name="categoria" maxLength={80} className="mt-1 block w-full max-w-sm rounded-md border px-3 py-2 text-sm" />
        </label>
      )}
      <label className="block text-sm font-medium">
        Documento de até 4 MB
        <input className="mt-1 block max-w-full text-sm" type="file" name="arquivo" required accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.jpg,.jpeg,.png" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pendente}>{pendente ? "Anexando…" : biblioteca ? "Adicionar à biblioteca" : "Anexar documento"}</Button>
      {resultado.erro && <p role="alert" className="text-sm text-destructive">{resultado.erro}</p>}
      {resultado.sucesso && <p role="status" className="text-sm text-muted-foreground">{resultado.sucesso}</p>}
    </form>
  );
}
