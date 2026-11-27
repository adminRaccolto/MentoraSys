import Image from "next/image";
import { Mail } from "lucide-react";
import { obterClientePortal } from "@/lib/portal-sessao";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ erro?: string }>;
}

const ERROS: Record<string, string> = {
  invalido: "Este convite de acesso é inválido. Solicite outro link à equipe.",
  expirado: "O prazo do convite terminou. Solicite um novo link à equipe.",
};

export default async function PortalAcessoPage({ searchParams }: Props) {
  const [{ erro }, sessao] = await Promise.all([searchParams, obterClientePortal()]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f6ef] p-4">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="titulo-acesso">
        <Image src="/logo-raccolto.svg" width={120} height={42} alt="Raccolto" className="h-9 w-auto" />
        <div className="space-y-2 border-t pt-5">
          <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><Mail className="size-5" aria-hidden /></span>
          <h1 id="titulo-acesso" className="font-serif text-3xl tracking-tight">Entrar no portal</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Abra o link pessoal que recebeu da equipe da Raccolto. O convite dá acesso ao seu espaço por até sete dias.</p>
        </div>
        {erro && ERROS[erro] && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{ERROS[erro]}</p>}
        {sessao && <Link href={sessao.mentoria_id ? "/portal/mentorias" : "/portal"} className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Continuar para o portal</Link>}
      </section>
    </main>
  );
}
