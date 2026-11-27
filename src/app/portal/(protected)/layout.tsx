import Link from "next/link";
import { obterClientePortal } from "@/lib/portal-sessao";
import { redirect } from "next/navigation";

export default async function PortalProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clienteId = (await obterClientePortal())?.id;

  if (!clienteId) redirect("/portal/acesso");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/portal" className="font-bold text-lg tracking-tight text-primary">MentoraSys</Link>
          <span className="text-muted-foreground text-sm">— Área do Cliente</span>
        <Link href="/portal/mentorias" className="ml-auto text-sm font-medium text-primary hover:underline">Mentorias</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
