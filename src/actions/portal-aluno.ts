"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailAluno, permitirTentativaAluno, protegerSenhaAluno, senhaNovaAluno, verificarSenhaAluno } from "@/lib/portal-aluno-seguranca";
import { alunoTemMatricula, finalizarSessaoAluno, gravarCookieAluno, iniciarSessaoAluno, obterSessaoAluno, prepararSessaoAluno } from "@/lib/portal-aluno-sessao";
import { buscarConviteMentoria } from "@/lib/convite-mentoria";
import { COOKIE_PORTAL } from "@/lib/portal-sessao";

type Resultado = { erro?: string };
const invalido = { erro: "E-mail ou senha inválidos. Solicite uma nova senha à equipe se precisar." };

export async function entrarPortalAluno(_: Resultado, form: FormData): Promise<Resultado> {
  const dados = z.object({ email: emailAluno, senha: z.string().min(1).max(128) })
    .safeParse({ email: form.get("email"), senha: form.get("senha") });
  if (!dados.success) return invalido;

  const mentoriaPretendida = form.get("mentoria");
  let trocarSenha = false;
  let destino = "/portal/mentorias";
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
    if (typeof mentoriaPretendida === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(mentoriaPretendida)) {
      const matricula = await prisma.mentoriaAluno.findUnique({
        where: {
          mentoria_id_cliente_id: { mentoria_id: mentoriaPretendida, cliente_id: acesso.cliente_id },
          ativo: true, mentoria: { empresa_id: acesso.cliente.empresa_id },
        },
        select: { id: true },
      });
      if (matricula) destino = `/portal/mentorias/${mentoriaPretendida}`;
    }
    await iniciarSessaoAluno(acesso.cliente_id, acesso.versao, trocarSenha);
  } catch (erro) {
    console.error("Falha no login da mentoria", erro instanceof Error ? erro.name : typeof erro);
    return { erro: "O portal está temporariamente indisponível. Tente novamente." };
  }

  redirect(trocarSenha ? "/portal/definir-senha" : destino);
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

export async function ativarPortalAluno(token: string, _: Resultado, form: FormData): Promise<Resultado> {
  const convite = await buscarConviteMentoria(token);
  if (!convite) return { erro: "Convite inválido ou expirado. Solicite outro à equipe." };
  const senha = senhaNovaAluno.safeParse(form.get("senha"));
  if (!senha.success) return { erro: senha.error.issues[0]?.message ?? "Informe uma senha válida." };
  if (senha.data !== form.get("confirmacao")) return { erro: "As senhas devem ser iguais." };

  try {
    const senha_hash = await protegerSenhaAluno(senha.data);
    const seguinte = prepararSessaoAluno(convite.aluno.cliente_id, 0, false);
    await prisma.$transaction(async (tx) => {
      const consumido = await tx.portalAlunoConvite.updateMany({
        where: {
          token_hash: convite.token_hash, usado_em: null, expira_em: { gt: new Date() },
          aluno: { ativo: true, cliente: { status: "ATIVO", empresa_id: convite.aluno.mentoria.empresa_id } },
        },
        data: { usado_em: new Date() },
      });
      if (!consumido.count) throw new Error("Convite indisponível");
      await tx.portalAlunoAcesso.create({
        data: { cliente_id: convite.aluno.cliente_id, email: convite.email, senha_hash },
      });
      await tx.portalAlunoSessao.create({ data: seguinte.dados });
    });
    await gravarCookieAluno(seguinte);
  } catch {
    return { erro: "Convite indisponível. Se já criou sua senha, entre pelo login." };
  }

  redirect(`/portal/mentorias/${convite.aluno.mentoria.id}`);
}
