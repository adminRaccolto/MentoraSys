import Link from "next/link";
import Image from "next/image";
import { obterClientePortal } from "@/lib/portal-sessao";
import { redirect } from "next/navigation";

export default async function PortalProtectedLayout({ children }: { children: React.ReactNode }) {
  const cliente = await obterClientePortal();
  if (!cliente) redirect("/portal/acesso");

  return (
    <div className="min-h-dvh bg-[#f4f6ef]">
      <header className="border-b border-[#dfe5da] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-7">
          <Link href={cliente.mentoria_id ? "/portal/mentorias" : "/portal"} className="flex min-w-0 items-center gap-3">
            <Image src="/logo-raccolto.svg" width={108} height={36} alt="Raccolto" className="h-8 w-auto shrink-0" />
            <span className="hidden border-l pl-3 text-sm font-medium text-muted-foreground sm:inline">Área do cliente</span>
          </Link>
          <nav aria-label="Portal do cliente" className="flex min-w-0 flex-wrap items-center gap-0.5">
            {!cliente.mentoria_id && <Link href="/portal" className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted sm:px-3">Projetos</Link>}
            <Link href="/portal/mentorias" className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted sm:px-3">Mentorias</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8">{children}</main>
    </div>
  );
}
