import Link from "next/link";
import { sairPortalAluno } from "@/actions/portal-aluno";
import { PortalMarca } from "@/components/portal-marca";
import { obterClientePortal } from "@/lib/portal-sessao";
import { redirect } from "next/navigation";

export default async function PortalProtectedLayout({ children }: { children: React.ReactNode }) {
  const cliente = await obterClientePortal();
  if (!cliente) redirect("/portal/acesso");

  return (
    <div className="portal-cliente min-h-dvh bg-[#f4f6ef]">
      <header className="border-b border-[#dfe5da] bg-white">
        <div data-portal-largura className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-7">
          <PortalMarca sessaoAluno={cliente.tipo === "ALUNO"} />
          <nav aria-label="Portal do cliente" className="flex min-w-0 flex-wrap items-center gap-0.5">
            {cliente.tipo !== "ALUNO" && <Link href="/portal" className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted sm:px-3">Projetos</Link>}
            <Link href="/portal/mentorias" className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted sm:px-3">Mentorias</Link>
            {cliente.tipo === "ALUNO" && (
              <form action={sairPortalAluno}>
                <button type="submit" className="rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted sm:px-3">Sair</button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main data-portal-largura className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8">{children}</main>
    </div>
  );
}
