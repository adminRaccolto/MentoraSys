"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  banco_id: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  digito: z.string().optional(),
  pix_chave: z.string().optional(),
  tipo: z.enum(["CORRENTE", "POUPANCA", "CAIXA", "INVESTIMENTO"]).default("CORRENTE"),
  saldo_inicial: z.coerce.number().default(0),
});

type Input = z.input<typeof schema>;

export async function listarBancos() {
  return prisma.banco.findMany({ orderBy: [{ codigo: "asc" }] });
}

export async function criarConta(input: Input) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const conta = await prisma.contaBancaria.create({
    data: {
      empresa_id: empresaId,
      nome: data.nome,
      banco_id: data.banco_id || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      digito: data.digito || null,
      pix_chave: data.pix_chave || null,
      tipo: data.tipo,
      saldo_inicial: data.saldo_inicial,
    },
    include: { banco_ref: true },
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/contas-bancarias");
  return { data: conta };
}

export async function editarConta(id: string, input: Input) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const conta = await prisma.contaBancaria.update({
    where: { id, empresa_id: empresaId },
    data: {
      nome: data.nome,
      banco_id: data.banco_id || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      digito: data.digito || null,
      pix_chave: data.pix_chave || null,
      tipo: data.tipo,
      saldo_inicial: data.saldo_inicial,
    },
    include: { banco_ref: true },
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/contas-bancarias");
  return { data: conta };
}

export async function excluirConta(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.contaBancaria.update({
    where: { id, empresa_id: empresaId },
    data: { ativo: false },
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/contas-bancarias");
  return { data: null };
}
