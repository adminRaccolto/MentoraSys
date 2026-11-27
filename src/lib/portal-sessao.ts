import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const COOKIE_PORTAL = "portal_sessao";
export const DURACAO_PORTAL = 7 * 24 * 60 * 60;

export const obterClientePortal = cache(async () => {
  const token = (await cookies()).get(COOKIE_PORTAL)?.value;
  if (!token) return null;

  const sessao = await prisma.tokenPortal.findUnique({
    where: { token, usado_em: { not: null }, expira_em: { gt: new Date() } },
    select: { mentoria_id: true, cliente: { select: { id: true, empresa_id: true, nome: true } } },
  });
  return sessao ? { ...sessao.cliente, mentoria_id: sessao.mentoria_id } : null;
});

export async function criarTokenPortal(cliente: { id: string; email: string | null }, mentoriaId?: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.tokenPortal.create({
    data: {
      cliente_id: cliente.id,
      mentoria_id: mentoriaId,
      email: cliente.email ?? "",
      token,
      expira_em: new Date(Date.now() + DURACAO_PORTAL * 1000),
    },
  });
  return token;
}
