"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailAluno, protegerSenhaAluno } from "@/lib/portal-aluno-seguranca";
import { alunoMentoria, checkinAberto, empresaMentorias, localEncontro, NOME_MESA, textoObrigatorio, textoOpcional, urlOpcional } from "@/lib/mentorias";
import { atualizarSalaZoom, criarSalaZoom, ErroZoom } from "@/lib/mentorias-zoom";
import { notificarMatricula } from "@/lib/convite-mentoria";
import { matricularClienteMentoria } from "@/lib/matriculas-mentoria";
import { obterConfiguracaoZoom } from "@/lib/mentorias-zoom-config";

type Resultado = {
  erro?: string;
  sucesso?: string;
  link?: string;
  acesso?: { email: string; senha: string };
  aviso?: string;
  convite?: string;
  envioConfirmado?: boolean;
};

class ErroFormulario extends Error {}

async function executar(trabalho: () => Promise<Resultado>): Promise<Resultado> {
  try {
    return await trabalho();
  } catch (erro) {
    if (erro instanceof ErroFormulario || erro instanceof ErroZoom) return { erro: erro.message };
    if (erro instanceof z.ZodError) return { erro: erro.issues[0]?.message ?? "Revise os campos." };
    if (erro instanceof Error && /^(Sem permissão|Acesso negado|Não autenticado|Nenhuma empresa)/.test(erro.message)) {
      return { erro: "Você não tem permissão para esta ação." };
    }
    console.error("Falha no módulo Mentorias", erro instanceof Error ? erro.name : typeof erro);
    return { erro: "Não foi possível concluir a operação. Tente novamente." };
  }
}

function campos<T extends z.ZodRawShape>(form: FormData, formato: T) {
  return z.object(formato).parse(Object.fromEntries(Object.keys(formato).map((nome) => [nome, form.get(nome) ?? ""])));
}

function atualizarPaginas(mentoriaId: string) {
  revalidatePath("/mentorias");
  revalidatePath(`/mentorias/${mentoriaId}`);
  revalidatePath("/portal/mentorias");
  revalidatePath(`/portal/mentorias/${mentoriaId}`);
}

async function buscarMentoria(mentoriaId: string) {
  const empresaId = await empresaMentorias();
  const mentoria = await prisma.mentoria.findUnique({ where: { id: mentoriaId, empresa_id: empresaId } });
  if (!mentoria) throw new ErroFormulario("Mentoria não encontrada.");
  return mentoria;
}

async function buscarAluno(mentoriaId: string, alunoId: string) {
  const mentoria = await buscarMentoria(mentoriaId);
  const aluno = await prisma.mentoriaAluno.findUnique({
    where: { id: alunoId, mentoria_id: mentoria.id, cliente: { empresa_id: mentoria.empresa_id } },
    include: { cliente: { select: { id: true, email: true } } },
  });
  if (!aluno) throw new ErroFormulario("Aluno não encontrado.");
  return { mentoria, aluno };
}

export async function cadastrarMentoria(_: Resultado, form: FormData) {
  return executar(async () => {
    const empresaId = await empresaMentorias("criar");
    const dados = campos(form, {
      tipo: z.enum(["GRUPO", "INDIVIDUAL"]),
      nome: textoOpcional(140),
      turma: textoOpcional(100),
      descricao: textoOpcional(3000),
      cliente: textoOpcional(100),
    });
    const individual = dados.tipo === "INDIVIDUAL";
    if (!individual && !dados.turma) throw new ErroFormulario("Informe o nome da turma.");
    const cliente = individual && dados.cliente
      ? await prisma.cliente.findUnique({ where: { id: dados.cliente, empresa_id: empresaId, status: "ATIVO" }, select: { id: true, nome: true } })
      : null;
    if (individual && !cliente) throw new ErroFormulario("Selecione um cliente para a mentoria individual.");
    const mentoria = await prisma.mentoria.create({
      data: {
        empresa_id: empresaId,
        tipo: dados.tipo,
        nome: dados.nome ?? (cliente ? `Mentoria individual · ${cliente.nome}` : NOME_MESA),
        turma: individual ? null : dados.turma,
        descricao: dados.descricao,
        alunos: cliente ? { create: { cliente_id: cliente.id } } : undefined,
      },
      include: { alunos: { select: { id: true } } },
    });
    const convite = mentoria.alunos[0] ? await notificarMatricula(mentoria.alunos[0].id, empresaId) : {};
    atualizarPaginas(mentoria.id);
    return { sucesso: "Mentoria cadastrada.", link: `/mentorias/${mentoria.id}`, ...convite };
  });
}

export async function editarMentoria(id: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    const dados = campos(form, { nome: textoObrigatorio(140), turma: mentoria.tipo === "GRUPO" ? textoObrigatorio(100) : textoOpcional(100), descricao: textoOpcional(3000) });
    await prisma.mentoria.update({ where: { id: mentoria.id }, data: { ...dados, turma: mentoria.tipo === "GRUPO" ? dados.turma : null } });
    atualizarPaginas(id);
    return { sucesso: "Mentoria atualizada." };
  });
}

export async function matricularAluno(id: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    if (mentoria.tipo !== "GRUPO") throw new ErroFormulario("A matrícula em turma é exclusiva das mentorias em grupo.");
    const { cliente: clienteId } = campos(form, { cliente: textoObrigatorio(100) });
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId, empresa_id: mentoria.empresa_id, status: "ATIVO" }, select: { id: true } });
    if (!cliente) throw new ErroFormulario("Cliente não encontrado.");
    const matricula = await prisma.$transaction((tx) => matricularClienteMentoria(tx, id, cliente.id));
    const convite = matricula.alterada ? await notificarMatricula(matricula.alunoId, mentoria.empresa_id) : {};
    atualizarPaginas(id);
    return { sucesso: matricula.alterada ? "Aluno matriculado." : "O aluno já está matriculado.", ...convite };
  });
}

export async function alterarAcessoAluno(id: string, alunoId: string, ativo: boolean) {
  return executar(async () => {
    const { aluno } = await buscarAluno(id, alunoId);
    await prisma.mentoriaAluno.update({ where: { id: aluno.id }, data: { ativo } });
    atualizarPaginas(id);
    return { sucesso: ativo ? "Acesso ativado." : "Acesso suspenso." };
  });
}

export async function enviarConviteAluno(id: string, alunoId: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const { mentoria, aluno } = await buscarAluno(id, alunoId);
    if (!aluno.ativo) throw new ErroFormulario("Ative a matrícula antes de enviar o convite.");
    const { email } = campos(form, { email: emailAluno });
    return notificarMatricula(aluno.id, mentoria.empresa_id, email);
  });
}

export async function gerarSenhaAluno(id: string, alunoId: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const { aluno } = await buscarAluno(id, alunoId);
    if (!aluno.ativo) throw new ErroFormulario("Ative a matrícula do aluno antes de configurar o acesso.");
    const { email } = campos(form, { email: emailAluno });
    const senha = randomBytes(15).toString("base64url");
    const senha_hash = await protegerSenhaAluno(senha);
    const provisoria_expira_em = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.portalAlunoAcesso.upsert({
          where: { cliente_id: aluno.cliente_id },
          create: { cliente_id: aluno.cliente_id, email, senha_hash, provisoria_expira_em },
          update: { email, senha_hash, provisoria_expira_em, versao: { increment: 1 } },
        });
        await tx.portalAlunoSessao.deleteMany({ where: { cliente_id: aluno.cliente_id } });
      });
    } catch (erro) {
      if (erro && typeof erro === "object" && "code" in erro && erro.code === "P2002") {
        throw new ErroFormulario("Este e-mail já está vinculado ao acesso de outro aluno. Informe outro e-mail.");
      }
      throw erro;
    }
    atualizarPaginas(id);
    return { acesso: { email, senha } };
  });
}

const dataHora = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe a data e o horário do encontro.")
  .transform((s) => {
    const data = new Date(`${s}:00-04:00`);
    if (!Number.isFinite(data.getTime()) || localEncontro(data) !== s) throw new ErroFormulario("Data inválida.");
    return data;
  });

async function buscarEncontro(mentoriaId: string, encontroId: string) {
  const encontro = await prisma.mentoriaEncontro.findUnique({ where: { id: encontroId, mentoria_id: mentoriaId } });
  if (!encontro) throw new ErroFormulario("Encontro não encontrado.");
  return encontro;
}

async function reservarAlteracaoZoom(id: string, zoomId: string | null) {
  const agora = new Date();
  const pedido = await prisma.mentoriaEncontro.updateMany({
    where: {
      id, zoom_id: zoomId, status: { not: "CANCELADO" },
      OR: [{ zoom_pendente: null }, { zoom_pendente: { lt: new Date(agora.getTime() - 5 * 60_000) } }],
      ...(zoomId ? {} : { sala_url: null }),
    },
    data: { zoom_pendente: agora },
  });
  if (!pedido.count) throw new ErroFormulario("A sala foi alterada ou está sendo sincronizada. Atualize a página e tente novamente.");
}

export async function salvarEncontro(id: string, encontroId: string | null, _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    const dados = campos(form, {
      titulo: textoObrigatorio(160), pauta: textoOpcional(1500), inicio: dataHora,
      duracao: z.coerce.number().int().min(5).max(480), sala_url: urlOpcional, gravacao_url: urlOpcional,
    });
    if (!encontroId) {
      await prisma.mentoriaEncontro.create({ data: { ...dados, mentoria_id: id } });
    } else {
      const atual = await buscarEncontro(id, encontroId);
      if (atual.status === "CANCELADO") throw new ErroFormulario("Este encontro foi cancelado.");
      const alterouHorario = atual.titulo !== dados.titulo || atual.pauta !== dados.pauta ||
        atual.inicio.getTime() !== dados.inicio.getTime() || atual.duracao !== dados.duracao;
      if (atual.zoom_id && atual.status === "AGENDADO" && alterouHorario) {
        const zoom = await obterConfiguracaoZoom(mentoria.empresa_id);
        if (!zoom) throw new ErroFormulario("Configure o Zoom para alterar este encontro.");
        await reservarAlteracaoZoom(atual.id, atual.zoom_id);
        try {
          await atualizarSalaZoom(zoom, atual.zoom_id, dados);
          await prisma.mentoriaEncontro.update({
            where: { id: atual.id },
            data: { ...dados, sala_url: atual.sala_url, zoom_pendente: null },
          });
        } catch (erro) {
          await prisma.mentoriaEncontro.update({ where: { id: atual.id }, data: { zoom_pendente: null } });
          throw erro;
        }
      } else {
        const resultado = await prisma.mentoriaEncontro.updateMany({
          where: { id: atual.id, zoom_id: atual.zoom_id, status: atual.status,
            OR: [{ zoom_pendente: null }, { zoom_pendente: { lt: new Date(Date.now() - 5 * 60_000) } }],
          },
          data: { ...dados, sala_url: atual.zoom_id ? atual.sala_url : dados.sala_url, zoom_pendente: null },
        });
        if (!resultado.count) throw new ErroFormulario("O encontro está sendo atualizado. Tente novamente em instantes.");
      }
    }
    atualizarPaginas(id);
    return { sucesso: "Encontro salvo." };
  });
}

export async function conectarZoom(id: string, encontroId: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    const zoom = await obterConfiguracaoZoom(mentoria.empresa_id);
    if (!zoom) throw new ErroFormulario("A integração Zoom precisa ser configurada para esta empresa.");
    const encontro = await buscarEncontro(id, encontroId);
    if (encontro.status !== "AGENDADO" || encontro.zoom_id || encontro.sala_url) {
      throw new ErroFormulario("Só é possível criar uma sala para um encontro agendado sem link.");
    }
    await reservarAlteracaoZoom(encontro.id, null);
    try {
      const dados = await criarSalaZoom(zoom, encontro, form.get("gravar") === "on");
      await prisma.mentoriaEncontro.update({ where: { id: encontro.id }, data: { ...dados, zoom_pendente: null } });
    } catch (erro) {
      if (erro instanceof ErroZoom) {
        await prisma.mentoriaEncontro.update({ where: { id: encontro.id }, data: { zoom_pendente: null } });
        throw erro;
      }
      throw new ErroFormulario("O Zoom não confirmou a criação. Confira as reuniões no Zoom antes de repetir a operação.");
    }
    atualizarPaginas(id);
    return { sucesso: "Sala Zoom criada." };
  });
}

export async function alterarStatusEncontro(id: string, encontroId: string, status: "CANCELADO" | "REALIZADO") {
  return executar(async () => {
    if (status !== "CANCELADO" && status !== "REALIZADO") throw new ErroFormulario("Status inválido.");
    const mentoria = await buscarMentoria(id);
    const encontro = await buscarEncontro(id, encontroId);
    if (encontro.status === status) return { sucesso: "Status atualizado." };
    if (encontro.status !== "AGENDADO") throw new ErroFormulario("O encontro já foi encerrado.");
    if (status === "CANCELADO" && encontro.zoom_id) {
      const zoom = await obterConfiguracaoZoom(mentoria.empresa_id);
      if (!zoom) throw new ErroFormulario("Configure o Zoom para cancelar este encontro.");
      await reservarAlteracaoZoom(encontro.id, encontro.zoom_id);
      try {
        await atualizarSalaZoom(zoom, encontro.zoom_id, null);
        await prisma.mentoriaEncontro.update({ where: { id: encontroId }, data: { status, zoom_pendente: null } });
      } catch (erro) {
        await prisma.mentoriaEncontro.update({ where: { id: encontroId }, data: { zoom_pendente: null } });
        throw erro;
      }
    } else {
      const resultado = await prisma.mentoriaEncontro.updateMany({
        where: { id: encontroId, status: "AGENDADO", zoom_id: encontro.zoom_id,
          OR: [{ zoom_pendente: null }, { zoom_pendente: { lt: new Date(Date.now() - 5 * 60_000) } }],
        },
        data: { status, zoom_pendente: null },
      });
      if (!resultado.count) throw new ErroFormulario("O encontro está sendo sincronizado. Tente novamente em instantes.");
    }
    atualizarPaginas(id);
    return { sucesso: "Status atualizado." };
  });
}

export async function publicarGravacaoZoom(id: string, encontroId: string) {
  return executar(async () => {
    await buscarMentoria(id);
    const encontro = await buscarEncontro(id, encontroId);
    if (!encontro.zoom_gravacao || encontro.status === "CANCELADO") throw new ErroFormulario("A gravação do Zoom ainda não está disponível.");
    await prisma.mentoriaEncontro.update({ where: { id: encontroId }, data: { gravacao_url: encontro.zoom_gravacao } });
    atualizarPaginas(id);
    return { sucesso: "Gravação publicada no portal." };
  });
}

export async function publicarMentoria(id: string, tipo: "MURAL" | "PUBLICACAO", _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    if (tipo !== "MURAL" && tipo !== "PUBLICACAO") throw new ErroFormulario("Tipo de publicação inválido.");
    const { titulo, texto, url } = campos(form, {
      titulo: tipo === "PUBLICACAO" ? textoObrigatorio(140) : textoOpcional(140),
      texto: textoObrigatorio(5000),
      url: urlOpcional,
    });
    await prisma.mentoriaPost.create({
      data: { mentoria_id: id, tipo, autor: "Equipe da mentoria", titulo, texto, url },
    });
    atualizarPaginas(mentoria.id);
    return { sucesso: tipo === "MURAL" ? "Mensagem publicada." : "Publicação disponível no portal." };
  });
}

export async function comentarMentoria(id: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const aluno = await alunoMentoria(id);
    if (!aluno) throw new ErroFormulario("Você não tem acesso a esta mentoria.");
    const { texto } = campos(form, { texto: textoObrigatorio(5000) });
    await prisma.mentoriaPost.create({ data: { mentoria_id: id, tipo: "MURAL", autor: aluno.cliente.nome, texto } });
    atualizarPaginas(id);
    return { sucesso: "Mensagem publicada." };
  });
}

export async function confirmarPresenca(id: string, encontroId: string) {
  return executar(async () => {
    const aluno = await alunoMentoria(id);
    if (!aluno || aluno.mentoria.tipo !== "GRUPO") throw new ErroFormulario("Check-in disponível para alunos da turma.");
    const encontro = await buscarEncontro(id, encontroId);
    if (!checkinAberto(encontro)) throw new ErroFormulario("O período de check-in está fechado.");
    const chave = { encontro_id: encontro.id, aluno_id: aluno.id };
    const checkin_em = new Date();
    await prisma.$transaction([
      prisma.mentoriaPresenca.createMany({ data: { ...chave, checkin_em }, skipDuplicates: true }),
      prisma.mentoriaPresenca.updateMany({ where: { ...chave, checkin_em: null }, data: { checkin_em } }),
    ]);
    atualizarPaginas(id);
    return { sucesso: "Check-in registrado." };
  });
}

export async function ajustarPresenca(id: string, encontroId: string, alunoId: string, _: Resultado, form: FormData) {
  return executar(async () => {
    const { aluno, mentoria } = await buscarAluno(id, alunoId);
    if (mentoria.tipo !== "GRUPO") throw new ErroFormulario("A presença pertence às mentorias em grupo.");
    const encontro = await buscarEncontro(id, encontroId);
    if (encontro.status === "CANCELADO") throw new ErroFormulario("Este encontro foi cancelado.");
    const { presenca } = campos(form, { presenca: z.enum(["PRESENTE", "AUSENTE", "AUTOMATICA"]) });
    const presente_manual = presenca === "AUTOMATICA" ? null : presenca === "PRESENTE";
    const chave = { aluno_id: aluno.id, encontro_id: encontro.id };
    await prisma.mentoriaPresenca.upsert({
      where: { encontro_id_aluno_id: chave }, create: { ...chave, presente_manual }, update: { presente_manual },
    });
    atualizarPaginas(id);
    return { sucesso: "Presença atualizada." };
  });
}

export async function salvarTarefa(id: string, alunoId: string, tarefaId: string | null, _: Resultado, form: FormData) {
  return executar(async () => {
    const { aluno, mentoria } = await buscarAluno(id, alunoId);
    if (mentoria.tipo !== "INDIVIDUAL") throw new ErroFormulario("As tarefas são exclusivas da mentoria individual.");
    const dados = campos(form, {
      titulo: textoObrigatorio(160), descricao: textoOpcional(3000),
      prazo: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Prazo inválido.").transform((s) => s ? new Date(`${s}T00:00:00Z`) : null)
        .refine((d) => !d || Number.isFinite(d.getTime()), "Prazo inválido."),
    });
    if (tarefaId) {
      const resultado = await prisma.mentoriaTarefa.updateMany({ where: { id: tarefaId, aluno_id: aluno.id }, data: dados });
      if (!resultado.count) throw new ErroFormulario("Tarefa não encontrada.");
    } else {
      await prisma.mentoriaTarefa.create({ data: { ...dados, aluno_id: aluno.id } });
    }
    atualizarPaginas(id);
    return { sucesso: "Tarefa salva." };
  });
}

export async function concluirTarefa(id: string, tarefaId: string, concluir: boolean) {
  return executar(async () => {
    const aluno = await alunoMentoria(id);
    if (!aluno || aluno.mentoria.tipo !== "INDIVIDUAL") throw new ErroFormulario("Tarefa indisponível.");
    const resultado = await prisma.mentoriaTarefa.updateMany({
      where: { id: tarefaId, aluno_id: aluno.id, concluida_em: concluir ? null : { not: null } },
      data: { concluida_em: concluir ? new Date() : null },
    });
    if (!resultado.count && !await prisma.mentoriaTarefa.findUnique({ where: { id: tarefaId, aluno_id: aluno.id } })) {
      throw new ErroFormulario("Tarefa não encontrada.");
    }
    atualizarPaginas(id);
    return { sucesso: concluir ? "Tarefa concluída." : "Tarefa reaberta." };
  });
}

export async function alterarTarefaPelaEquipe(id: string, alunoId: string, tarefaId: string, concluir: boolean) {
  return executar(async () => {
    const { aluno, mentoria } = await buscarAluno(id, alunoId);
    if (mentoria.tipo !== "INDIVIDUAL") throw new ErroFormulario("Tarefa indisponível.");
    const resultado = await prisma.mentoriaTarefa.updateMany({
      where: { id: tarefaId, aluno_id: aluno.id },
      data: { concluida_em: concluir ? new Date() : null },
    });
    if (!resultado.count) throw new ErroFormulario("Tarefa não encontrada.");
    atualizarPaginas(id);
    return { sucesso: concluir ? "Tarefa concluída." : "Tarefa reaberta." };
  });
}

export async function salvarPaginaMentoria(id: string, paginaId: string | null, _: Resultado, form: FormData) {
  return executar(async () => {
    await buscarMentoria(id);
    const dados = campos(form, { titulo: textoObrigatorio(140), conteudo: textoObrigatorio(16000) });
    if (paginaId) {
      const atual = await prisma.mentoriaPagina.updateMany({ where: { id: paginaId, mentoria_id: id }, data: dados });
      if (!atual.count) throw new ErroFormulario("Página não encontrada.");
    } else {
      await prisma.mentoriaPagina.create({ data: { ...dados, mentoria_id: id } });
    }
    atualizarPaginas(id);
    return { sucesso: "Página publicada." };
  });
}

export async function salvarItemMentoria(id: string, itemId: string | null, _: Resultado, form: FormData) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    if (mentoria.tipo !== "GRUPO") throw new ErroFormulario("Lista de acompanhamento indisponível.");
    const dados = campos(form, {
      titulo: textoObrigatorio(160),
      descricao: textoOpcional(3000),
      responsavel: textoOpcional(120),
      prazo: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Prazo inválido.").transform((s) => {
        if (!s) return null;
        const data = new Date(`${s}T00:00:00Z`);
        if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== s) throw new ErroFormulario("Prazo inválido.");
        return data;
      }),
    });
    if (itemId) {
      const atual = await prisma.mentoriaItem.updateMany({ where: { id: itemId, mentoria_id: id }, data: dados });
      if (!atual.count) throw new ErroFormulario("Item não encontrado.");
    } else {
      await prisma.mentoriaItem.create({ data: { ...dados, mentoria_id: id } });
    }
    atualizarPaginas(id);
    return { sucesso: "Item salvo." };
  });
}

export async function alterarItemMentoria(id: string, itemId: string, concluir: boolean) {
  return executar(async () => {
    const mentoria = await buscarMentoria(id);
    if (mentoria.tipo !== "GRUPO") throw new ErroFormulario("Lista de acompanhamento indisponível.");
    const atual = await prisma.mentoriaItem.updateMany({
      where: { id: itemId, mentoria_id: id },
      data: { concluida_em: concluir ? new Date() : null },
    });
    if (!atual.count) throw new ErroFormulario("Item não encontrado.");
    atualizarPaginas(id);
    return { sucesso: concluir ? "Item concluído." : "Item reaberto." };
  });
}

export async function editarNoticiaMentoria(id: string, noticiaId: string, _: Resultado, form: FormData) {
  return executar(async () => {
    await buscarMentoria(id);
    const dados = campos(form, { titulo: textoObrigatorio(140), texto: textoObrigatorio(5000), url: urlOpcional });
    const atual = await prisma.mentoriaPost.updateMany({ where: { id: noticiaId, mentoria_id: id, tipo: "PUBLICACAO" }, data: dados });
    if (!atual.count) throw new ErroFormulario("Notícia não encontrada.");
    atualizarPaginas(id);
    return { sucesso: "Notícia atualizada." };
  });
}
