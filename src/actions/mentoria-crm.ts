"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { empresaMentorias } from "@/lib/mentorias";
import { verificarPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { emailAluno } from "@/lib/portal-aluno-seguranca";
import { matricularClienteMentoria } from "@/lib/matriculas-mentoria";
import { notificarMatricula } from "@/lib/convite-mentoria";

class ErroMatricula extends Error {}
type Resultado = { erro?: string; sucesso?: string; link?: string; aviso?: string; convite?: string; envioConfirmado?: boolean };

export async function matricularLeadGanho(leadId: string, _: Resultado, form: FormData): Promise<Resultado> {
  const dados = z.object({
    nome: z.string().trim().min(2).max(140),
    email: z.union([z.literal(""), emailAluno]),
    destino: z.string().min(1).max(100),
  }).safeParse({
    nome: form.get("nome"), email: String(form.get("email") ?? "").trim(), destino: form.get("destino"),
  });
  if (!dados.success) return { erro: "Confira o nome, o e-mail e a mentoria selecionada." };

  try {
    const { nome, email, destino } = dados.data;
    const individual = destino === "nova-individual";
    await verificarPermissao("crm", "editar");
    const empresaId = await empresaMentorias();
    if (individual) await empresaMentorias("criar");

    const matricula = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${empresaId}), hashtext(${`lead-mentoria:${leadId}`}))`;
      const lead = await tx.lead.findUnique({
        where: { id: leadId, empresa_id: empresaId, etapa_chave: "GANHO" },
        select: { cliente_id: true, email: true, telefone: true, whatsapp: true, empresa_nome: true },
      });
      if (!lead) throw new ErroMatricula("A oportunidade precisa estar em Ganho para gerar uma matrícula.");

      const identidade = lead.email?.trim().toLowerCase() || email;
      if (identidade) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${empresaId}), hashtext(${identidade}))`;
      const turma = individual ? null : await tx.mentoria.findUnique({
        where: { id: destino, empresa_id: empresaId, tipo: "GRUPO" }, select: { id: true },
      });
      if (!individual && !turma) throw new ErroMatricula("Selecione uma turma desta empresa.");

      const clienteVinculado = lead.cliente_id
        ? await tx.cliente.findUnique({ where: { id: lead.cliente_id, empresa_id: empresaId }, select: { id: true, status: true } })
        : null;
      if (lead.cliente_id && !clienteVinculado) throw new ErroMatricula("O cliente vinculado ao lead pertence a outro cadastro.");
      const correspondencias = !clienteVinculado && identidade ? await tx.cliente.findMany({
        where: { empresa_id: empresaId, email: { equals: identidade, mode: "insensitive" } },
        select: { id: true, status: true }, take: 2,
      }) : [];
      if (correspondencias.length > 1) throw new ErroMatricula("Há mais de um cliente com este e-mail. Vincule o cadastro correto no CRM.");
      const existente = clienteVinculado ?? correspondencias[0];
      if (existente?.status === "INATIVO") throw new ErroMatricula("Reative o cadastro do cliente antes de matricular.");

      const cliente = existente ?? await tx.cliente.create({
        data: {
          empresa_id: empresaId, nome, nome_fantasia: lead.empresa_nome, tipo: "PESSOA_FISICA",
          email: email || identidade || null, telefone: lead.telefone, whatsapp: lead.whatsapp,
        },
        select: { id: true, status: true },
      });
      if (cliente.status === "PROSPECT") await tx.cliente.update({ where: { id: cliente.id }, data: { status: "ATIVO" } });
      if (lead.cliente_id !== cliente.id) await tx.lead.update({ where: { id: leadId }, data: { cliente_id: cliente.id } });

      let mentoriaId = turma?.id;
      if (!mentoriaId) {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${empresaId}), hashtext(${`mentoria-individual:${cliente.id}`}))`;
        const atual = await tx.mentoria.findFirst({
          where: { empresa_id: empresaId, tipo: "INDIVIDUAL", alunos: { some: { cliente_id: cliente.id } } },
          orderBy: { criado_em: "desc" }, select: { id: true },
        });
        const mentoria = atual ?? await tx.mentoria.create({
          data: { empresa_id: empresaId, tipo: "INDIVIDUAL", nome: `Mentoria individual · ${nome}` },
          select: { id: true },
        });
        mentoriaId = mentoria.id;
      }

      return { mentoriaId, ...await matricularClienteMentoria(tx, mentoriaId, cliente.id) };
    });

    const convite = matricula.alterada ? await notificarMatricula(matricula.alunoId, empresaId, email || undefined) : {};
    for (const rota of ["/crm", "/clientes", "/mentorias", `/mentorias/${matricula.mentoriaId}`, "/portal/mentorias"]) revalidatePath(rota);
    return {
      sucesso: matricula.alterada ? "Aluno matriculado." : "O aluno já está matriculado nessa mentoria.",
      link: `/mentorias/${matricula.mentoriaId}?secao=alunos`, ...convite,
    };
  } catch (erro) {
    if (erro instanceof ErroMatricula) return { erro: erro.message };
    console.error("Falha ao matricular oportunidade", erro instanceof Error ? erro.name : typeof erro);
    return { erro: "Não foi possível matricular. Confira o acesso e tente novamente." };
  }
}
