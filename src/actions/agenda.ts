"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schemaCreate = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  inicio: z.string().min(1, "Data de início obrigatória"),
  fim: z.string().optional(),
  dia_todo: z.boolean().optional(),
  lembrete_minutos: z.coerce.number().optional(),
  responsavel_id: z.string().optional(),
  cliente_id: z.string().optional(),
  contrato_id: z.string().optional(),
  projeto_id: z.string().optional(),
});

const schemaEdit = schemaCreate.partial();

type InputCreate = z.input<typeof schemaCreate>;
type InputEdit = z.input<typeof schemaEdit>;

function calcularLembreteEm(inicio: string, lembrete_minutos?: number): Date | undefined {
  if (!lembrete_minutos) return undefined;
  const d = new Date(inicio);
  return new Date(d.getTime() - lembrete_minutos * 60 * 1000);
}

export async function criarEvento(input: InputCreate) {
  await verificarPermissao("agenda", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCreate.parse(input);

  const evento = await prisma.evento.create({
    data: {
      empresa_id: empresaId,
      titulo: data.titulo,
      descricao: data.descricao,
      inicio: new Date(data.inicio),
      fim: data.fim ? new Date(data.fim) : undefined,
      dia_todo: data.dia_todo ?? false,
      lembrete_minutos: data.lembrete_minutos,
      lembrete_em: calcularLembreteEm(data.inicio, data.lembrete_minutos),
      responsavel_id: data.responsavel_id || undefined,
      cliente_id: data.cliente_id || undefined,
      contrato_id: data.contrato_id || undefined,
      projeto_id: data.projeto_id || undefined,
    },
  });

  await registrar({ recurso: "agenda", acao: "criar", registroId: evento.id, detalhes: { titulo: data.titulo } });
  revalidatePath("/agenda");
  return { ok: true, id: evento.id };
}

export async function editarEvento(id: string, input: InputEdit) {
  await verificarPermissao("agenda", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaEdit.parse(input);

  const updateData: Record<string, unknown> = { ...data };
  if (data.inicio) {
    updateData.inicio = new Date(data.inicio);
    updateData.lembrete_em = calcularLembreteEm(data.inicio, data.lembrete_minutos);
    updateData.lembrete_enviado = false;
  }
  if (data.fim) updateData.fim = new Date(data.fim);
  if (data.responsavel_id === "") updateData.responsavel_id = null;
  if (data.cliente_id === "") updateData.cliente_id = null;
  if (data.contrato_id === "") updateData.contrato_id = null;
  if (data.projeto_id === "") updateData.projeto_id = null;

  await prisma.evento.updateMany({
    where: { id, empresa_id: empresaId },
    data: updateData,
  });

  await registrar({ recurso: "agenda", acao: "editar", registroId: id });
  revalidatePath("/agenda");
  return { ok: true };
}

export async function excluirEvento(id: string) {
  await verificarPermissao("agenda", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.evento.deleteMany({ where: { id, empresa_id: empresaId } });

  await registrar({ recurso: "agenda", acao: "excluir", registroId: id });
  revalidatePath("/agenda");
  return { ok: true };
}
