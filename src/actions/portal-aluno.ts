"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailAluno, permitirTentativaAluno, protegerSenhaAluno, senhaNovaAluno, verificarSenhaAluno } from "@/lib/portal-aluno-seguranca";
import { alunoTemMatricula, finalizarSessaoAluno, gravarCookieAluno, iniciarSessaoAluno, obterSessaoAluno, prepararSessaoAluno } from "@/lib/portal-aluno-sessao";
import { COOKIE_PORTAL } from "@/lib/portal-sessao";

type Resultado = { erro?: string };
const invalido = { erro: "E-mail ou senha inválidos. Solicite uma nova senha à equipe se precisar." };

export async function entrarPortalAluno(_: Resultado, form: FormData): Promise<Resultado> {
  const dados = z.object({ email: emailAluno, senha: z.string().min(1).max(128) })
    .safeParse({ email: form.get("email"), senha: form.get("senha") });
  if (!dados.success) return invalido;

  let trocarSenha = false;
  try {
    if (!await permitirTentativaAluno(dados.data.email)) return { erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    const acesso = await prisma.portalAlunoAcesso.findUnique({
      where: { email: dados.data.email },
      select: {
        senha_hash: true, provisoria_expira_em: true, versao: true, cliente_id: true,
        cliente: { select: { status: true, empresa_id: true, mentorias: {
          where: { ativo: true }, select: { mentoria: { select: { empresa_id: true } } },
        } } },
      },
    });
    const senhaValida = await verificarSenhaAluno(dados.data.senha, acesso?.senha_hash);
    if (!acesso || !senhaValida || acesso.cliente.status !== "ATIVO" ||
        !alunoTemMatricula(acesso.cliente) ||
        (acesso.provisoria_expira_em && acesso.provisoria_expira_em <= new Date())) return invalido;

    trocarSenha = Boolean(acesso.provisoria_expira_em);
    await iniciarSessaoAluno(acesso.cliente_id, acesso.versao, trocarSenha);
  } catch (erro) {
    console.error("Falha no login da mentoria", erro instanceof Error ? erro.name : typeof erro);
    return { erro: "O portal está temporariamente indisponível. Tente novamente." };
  }

  redirect(trocarSenha ? "/portal/definir-senha" : "/portal/mentorias");
}

export async function definirSenhaPortalAluno(_: Resultado, form: FormData): Promise<Resultado> {
  const sessao = await obterSessaoAluno();
  if (!sessao?.trocarSenha) redirect("/portal/acesso");

  const senha = senhaNovaAluno.safeParse(form.get("senha"));
  if (!senha.success) return { erro: senha.error.issues[0]?.message ?? "Informe uma senha válida." };
  if (senha.data !== form.get("confirmacao")) return { erro: "As senhas devem ser iguais." };

  try {
    const acesso = await prisma.portalAlunoAcesso.findUnique({
      where: { cliente_id: sessao.id, versao: sessao.versao },
      select: { senha_hash: true },
    });
    if (!acesso) return { erro: "O acesso mudou. Entre novamente." };
    if (await verificarSenhaAluno(senha.data, acesso.senha_hash)) return { erro: "Escolha uma senha diferente da provisória." };
    const senha_hash = await protegerSenhaAluno(senha.data);
    const seguinte = prepararSessaoAluno(sessao.id, sessao.versao + 1, false);
    await prisma.$transaction(async (tx) => {
      const alterado = await tx.portalAlunoAcesso.updateMany({
        where: { cliente_id: sessao.id, versao: sessao.versao, provisoria_expira_em: { gt: new Date() } },
        data: { senha_hash, provisoria_expira_em: null, versao: { increment: 1 } },
      });
      if (!alterado.count) throw new Error("Acesso expirado");
      await tx.portalAlunoSessao.deleteMany({ where: { cliente_id: sessao.id } });
      await tx.portalAlunoSessao.create({ data: seguinte.dados });
    });
    await gravarCookieAluno(seguinte);
  } catch (erro) {
    console.error("Falha na troca de senha da mentoria", erro instanceof Error ? erro.name : typeof erro);
    return { erro: "Não foi possível atualizar a senha. Entre novamente e tente outra vez." };
  }

  redirect("/portal/mentorias");
}

export async function sairPortalAluno() {
  await finalizarSessaoAluno();
  (await cookies()).delete(COOKIE_PORTAL);
  redirect("/portal/acesso");
}
