import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { obterSessaoAluno } from "@/lib/portal-aluno-sessao";

export const COOKIE_PORTAL = "portal_sessao";
export const DURACAO_PORTAL = 7 * 24 * 60 * 60;

export const obterClientePortal = cache(async () => {
  const aluno = await obterSessaoAluno();
  if (aluno) return aluno.trocarSenha ? null : { id: aluno.id, empresa_id: aluno.empresa_id, nome: aluno.nome, tipo: "ALUNO" as const };

  const token = (await cookies()).get(COOKIE_PORTAL)?.value;
  if (!token) return null;

  const sessao = await prisma.tokenPortal.findUnique({
    where: { token, mentoria_id: null, usado_em: { not: null }, expira_em: { gt: new Date() } },
    select: { cliente: { select: { id: true, empresa_id: true, nome: true } } },
  });
  return sessao ? { ...sessao.cliente, tipo: "CLIENTE" as const } : null;
});

export async function criarTokenPortal(cliente: { id: string; email: string | null }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.tokenPortal.create({
    data: {
      cliente_id: cliente.id,
      email: cliente.email ?? "",
      token,
      expira_em: new Date(Date.now() + DURACAO_PORTAL * 1000),
    },
  });
  return token;
}
