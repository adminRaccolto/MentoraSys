import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPortalAluno } from "@/lib/portal-aluno-seguranca";

const COOKIE_ALUNO = "portal_aluno_sessao";
const DURACAO_COMPLETA = 7 * 24 * 60 * 60;
const DURACAO_PROVISORIA = 20 * 60;

export function alunoTemMatricula(cliente: { empresa_id: string; mentorias: { mentoria: { empresa_id: string } }[] }) {
  return cliente.mentorias.some(({ mentoria }) => mentoria.empresa_id === cliente.empresa_id);
}

export const obterSessaoAluno = cache(async () => {
  const token = (await cookies()).get(COOKIE_ALUNO)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const sessao = await prisma.portalAlunoSessao.findUnique({
    where: { token_hash: hashPortalAluno(token), expira_em: { gt: new Date() } },
    select: {
      versao: true,
      acesso: {
        select: {
          versao: true,
          provisoria_expira_em: true,
          cliente: {
            select: {
              id: true, nome: true, empresa_id: true, status: true,
              mentorias: { where: { ativo: true }, select: { mentoria: { select: { empresa_id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!sessao || sessao.versao !== sessao.acesso.versao) return null;

  const { cliente, provisoria_expira_em } = sessao.acesso;
  if (cliente.status !== "ATIVO" ||
      !alunoTemMatricula(cliente) ||
      (provisoria_expira_em && provisoria_expira_em <= new Date())) return null;
  return {
    id: cliente.id,
    nome: cliente.nome,
    empresa_id: cliente.empresa_id,
    versao: sessao.versao,
    trocarSenha: Boolean(provisoria_expira_em),
  };
});

export function prepararSessaoAluno(clienteId: string, versao: number, provisoria: boolean) {
  const token = randomBytes(32).toString("base64url");
  const maxAge = provisoria ? DURACAO_PROVISORIA : DURACAO_COMPLETA;
  return {
    token, maxAge,
    dados: {
      token_hash: hashPortalAluno(token), cliente_id: clienteId, versao,
      expira_em: new Date(Date.now() + maxAge * 1000),
    },
  };
}

export async function gravarCookieAluno({ token, maxAge }: ReturnType<typeof prepararSessaoAluno>) {
  const cookiesPortal = await cookies();
  cookiesPortal.delete("portal_sessao");
  cookiesPortal.set(COOKIE_ALUNO, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge,
  });
}

export async function iniciarSessaoAluno(clienteId: string, versao: number, provisoria: boolean) {
  const sessao = prepararSessaoAluno(clienteId, versao, provisoria);
  await prisma.portalAlunoSessao.create({ data: sessao.dados });
  await gravarCookieAluno(sessao);
}

export async function finalizarSessaoAluno() {
  const cookiesPortal = await cookies();
  const token = cookiesPortal.get(COOKIE_ALUNO)?.value;
  cookiesPortal.delete(COOKIE_ALUNO);
  if (token) await prisma.portalAlunoSessao.deleteMany({ where: { token_hash: hashPortalAluno(token) } });
}
