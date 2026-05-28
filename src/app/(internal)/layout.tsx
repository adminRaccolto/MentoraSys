import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import AppSidebar from "@/components/app-sidebar";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const empresaId = cookieStore.get("empresa_ativa")?.value;
  if (!empresaId) redirect("/selecionar-empresa");

  const [usuario, empresa, notificacoes] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: user.id },
      select: { nome: true, avatar_url: true },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nome: true, logo_url: true },
    }),
    prisma.notificacao.findMany({
      where: {
        empresa_id: empresaId,
        OR: [{ usuario_id: user.id }, { usuario_id: null }],
      },
      orderBy: { criado_em: "desc" },
      take: 30,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensagem: true,
        url: true,
        lida: true,
        criado_em: true,
      },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        nomeUsuario={usuario?.nome ?? user.email ?? "Usuário"}
        nomeEmpresa={empresa?.nome ?? "Empresa"}
        logoUrl={empresa?.logo_url ?? ""}
        avatarUrl={usuario?.avatar_url ?? ""}
        notificacoesIniciais={notificacoes.map((n: { id: string; tipo: string; titulo: string; mensagem: string | null; url: string | null; lida: boolean; criado_em: Date }) => ({
          ...n,
          criado_em: n.criado_em.toISOString(),
        }))}
        empresaId={empresaId}
        usuarioId={user.id}
      />
      <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
    </div>
  );
}
