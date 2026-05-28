import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function PortalProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const clienteId = cookieStore.get("portal_cliente")?.value;

  if (!clienteId) redirect("/portal/acesso");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight text-primary">MentoraSys</span>
          <span className="text-muted-foreground text-sm">— Área do Cliente</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
