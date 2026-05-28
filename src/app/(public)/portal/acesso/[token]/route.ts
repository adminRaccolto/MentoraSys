import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
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

  const cookieStore = await cookies();
  cookieStore.set("portal_cliente", tokenPortal.cliente_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return NextResponse.redirect(`${origin}/portal`);
}
