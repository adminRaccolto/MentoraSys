"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";

const schemaItem = z.object({
  tipo: z.enum(["DESLOCAMENTO", "REFEICAO", "HOTEL", "PEDAGIO"]),
  data: z.string().min(1),
  descricao: z.string().min(1),
  valor: z.coerce.number().positive(),
  km: z.coerce.number().nonnegative().optional().nullable(),
  valor_km: z.coerce.number().nonnegative().optional().nullable(),
  clientes_ids: z.array(z.string()).optional().default([]),
});

const schemaReembolso = z.object({
  periodo: z.string().min(1),
  descricao: z.string().optional(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type InputReembolso = z.input<typeof schemaReembolso>;

export async function listarReembolsos() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.reembolso.findMany({
    where: { empresa_id: empresaId },
    include: { itens: true },
    orderBy: { criado_em: "desc" },
  });
}

export async function obterReembolso(id: string) {
  const empresaId = await obterEmpresaAtiva();
  return prisma.reembolso.findFirst({
    where: { id, empresa_id: empresaId },
    include: { itens: true },
  });
}

export async function criarReembolso(input: InputReembolso) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaReembolso.parse(input);
  const total = data.itens.reduce((s, i) => s + i.valor, 0);

  const r = await prisma.reembolso.create({
    data: {
      empresa_id: empresaId,
      periodo: data.periodo,
      descricao: data.descricao || null,
      total,
      itens: {
        create: data.itens.map((i) => ({
          tipo: i.tipo,
          data: new Date(i.data),
          descricao: i.descricao,
          valor: i.valor,
          km: i.km ?? null,
          valor_km: i.valor_km ?? null,
          clientes_ids: i.clientes_ids ?? [],
        })),
      },
    },
  });

  revalidatePath("/relatorios/reembolso");
  return r;
}

export async function editarReembolso(id: string, input: InputReembolso) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaReembolso.parse(input);
  const total = data.itens.reduce((s, i) => s + i.valor, 0);

  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolsoItem.deleteMany({ where: { reembolso_id: id } });

  const r = await prisma.reembolso.update({
    where: { id },
    data: {
      periodo: data.periodo,
      descricao: data.descricao || null,
      total,
      itens: {
        create: data.itens.map((i) => ({
          tipo: i.tipo,
          data: new Date(i.data),
          descricao: i.descricao,
          valor: i.valor,
          km: i.km ?? null,
          valor_km: i.valor_km ?? null,
          clientes_ids: i.clientes_ids ?? [],
        })),
      },
    },
  });

  revalidatePath("/relatorios/reembolso");
  return r;
}

export async function marcarPago(id: string) {
  const empresaId = await obterEmpresaAtiva();
  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolso.update({ where: { id }, data: { status: "PAGO" } });
  revalidatePath("/relatorios/reembolso");
}

export async function excluirReembolso(id: string) {
  const empresaId = await obterEmpresaAtiva();
  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolso.delete({ where: { id } });
  revalidatePath("/relatorios/reembolso");
}

export async function listarClientesParaDeslocamento() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.cliente.findMany({
    where: { empresa_id: empresaId },
    select: { id: true, nome: true, distancia_km: true, preco_km: true, cidade: true, estado: true },
    orderBy: { nome: "asc" },
  });
}
