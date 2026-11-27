import { COOKIE_PORTAL, DURACAO_PORTAL } from "@/lib/portal-sessao";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { finalizarSessaoAluno } from "@/lib/portal-aluno-sessao";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = new URL(_request.url).origin;

  const tokenPortal = await prisma.tokenPortal.findUnique({
    where: { token },
  });

  if (!tokenPortal) {
    return NextResponse.redirect(`${origin}/portal/acesso?erro=invalido`);
  }

  if (tokenPortal.mentoria_id) {
    return NextResponse.redirect(`${origin}/portal/acesso`, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  }

  if (tokenPortal.expira_em < new Date()) {
    return NextResponse.redirect(`${origin}/portal/acesso?erro=expirado`);
  }

  // Marca como usado (mantém válido para múltiplos acessos dentro do prazo)
  if (!tokenPortal.usado_em) {
    await prisma.tokenPortal.update({
      where: { id: tokenPortal.id },
      data: { usado_em: new Date() },
    });
  }

  await finalizarSessaoAluno();
  const cookieStore = await cookies();
  cookieStore.delete("portal_cliente");
  cookieStore.set(COOKIE_PORTAL, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.min(DURACAO_PORTAL, Math.max(0, Math.floor((tokenPortal.expira_em.getTime() - Date.now()) / 1000))),
    path: "/",
  });

  return NextResponse.redirect(`${origin}/portal`, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
}
