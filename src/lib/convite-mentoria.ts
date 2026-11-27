import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailAluno, hashPortalAluno } from "@/lib/portal-aluno-seguranca";
import { enviarEmailMentoria } from "@/lib/email";

export async function buscarConviteMentoria(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const convite = await prisma.portalAlunoConvite.findUnique({
    where: { token_hash: hashPortalAluno(token), usado_em: null, expira_em: { gt: new Date() } },
    include: { aluno: { select: {
      ativo: true, cliente_id: true,
      cliente: { select: { empresa_id: true, status: true, acesso_portal_aluno: { select: { cliente_id: true } } } },
      mentoria: { select: { id: true, empresa_id: true, nome: true } },
    } } },
  });
  if (!convite?.aluno.ativo || convite.aluno.cliente.status !== "ATIVO" ||
      convite.aluno.mentoria.empresa_id !== convite.aluno.cliente.empresa_id ||
      convite.aluno.cliente.acesso_portal_aluno) return null;
  return convite;
}

export async function prepararConviteMatricula(alunoId: string, empresaId: string, emailInformado?: string) {
  const aluno = await prisma.mentoriaAluno.findFirst({
    where: { id: alunoId, ativo: true, cliente: { empresa_id: empresaId, status: "ATIVO" }, mentoria: { empresa_id: empresaId } },
    select: {
      id: true, cliente_id: true,
      cliente: { select: { email: true, acesso_portal_aluno: { select: { email: true } } } },
      mentoria: { select: { id: true, nome: true } },
    },
  });
  if (!aluno) throw new Error("Matrícula ativa não encontrada.");
  const acesso = aluno.cliente.acesso_portal_aluno;
  const email = emailAluno.safeParse(acesso?.email ?? (emailInformado || aluno.cliente.email));
  if (!email.success) return { aviso: "A matrícula está ativa. Informe um e-mail válido em Alunos para enviar o convite." };

  const existente = await prisma.portalAlunoAcesso.findUnique({ where: { email: email.data }, select: { cliente_id: true } });
  if (existente && existente.cliente_id !== aluno.cliente_id) return { aviso: "Este e-mail já está vinculado ao acesso de outro aluno." };

  const token = acesso ? null : randomBytes(32).toString("base64url");
  if (token) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${empresaId}), hashtext(${aluno.cliente_id}))`;
      await tx.portalAlunoConvite.deleteMany({
        where: { usado_em: null, aluno: { cliente_id: aluno.cliente_id }, OR: [{ aluno_id: aluno.id }, { email: { not: email.data } }] },
      });
      await tx.portalAlunoConvite.create({
        data: {
          token_hash: hashPortalAluno(token), aluno_id: aluno.id, email: email.data,
          expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });
  }
  const endereco = token ? `/portal/ativar/${token}` : `/portal/acesso?mentoria=${encodeURIComponent(aluno.mentoria.id)}`;
  return {
    convite: endereco,
    dados: {
      email: email.data,
      nomeMentoria: aluno.mentoria.nome,
      url: new URL(endereco, "https://app.raccolto.com.br").href,
      primeiroAcesso: Boolean(token),
    },
  };
}

export async function notificarMatricula(alunoId: string, empresaId: string, email?: string) {
  try {
    const preparado = await prepararConviteMatricula(alunoId, empresaId, email);
    if (!preparado.dados) return preparado;
    try {
      await enviarEmailMentoria(preparado.dados);
      return { convite: preparado.convite, envioConfirmado: true };
    } catch {
      return {
        convite: preparado.convite,
        aviso: "O provedor não confirmou o envio. Copie o link para compartilhar com o aluno.",
      };
    }
  } catch {
    return { aviso: "O acesso à mentoria foi registrado. Abra Alunos para gerar o convite." };
  }
}
