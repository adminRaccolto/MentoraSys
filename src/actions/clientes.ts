"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schemaCliente = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["PESSOA_FISICA", "PESSOA_JURIDICA"]),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT"]).default("ATIVO"),
  nome_fantasia: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  contato_principal: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  nome_fazenda: z.string().optional(),
  distancia_km: z.coerce.number().nonnegative().optional().nullable(),
  preco_km: z.coerce.number().nonnegative().optional().nullable(),
});

type ClienteInput = z.infer<typeof schemaCliente>;

export async function criarCliente(input: ClienteInput) {
  await verificarPermissao("clientes", "criar");
  const empresaId = await obterEmpresaAtiva();

  const data = schemaCliente.parse(input);

  const cliente = await prisma.cliente.create({
    data: {
      ...data,
      email: data.email || null,
      empresa_id: empresaId,
    },
  });

  await registrar({ recurso: "clientes", acao: "criar", registroId: cliente.id, detalhes: { nome: data.nome } });
  revalidatePath("/clientes");
  return {
    data: {
      ...cliente,
      distancia_km: cliente.distancia_km != null ? Number(cliente.distancia_km) : null,
      preco_km: cliente.preco_km != null ? Number(cliente.preco_km) : null,
    },
  };
}

export async function editarCliente(id: string, input: ClienteInput) {
  await verificarPermissao("clientes", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.cliente.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Cliente não encontrado");

  const data = schemaCliente.parse(input);

  const cliente = await prisma.cliente.update({
    where: { id },
    data: { ...data, email: data.email || null },
  });

  await registrar({ recurso: "clientes", acao: "editar", registroId: id });
  revalidatePath("/clientes");
  return {
    data: {
      ...cliente,
      distancia_km: cliente.distancia_km != null ? Number(cliente.distancia_km) : null,
      preco_km: cliente.preco_km != null ? Number(cliente.preco_km) : null,
    },
  };
}

export async function excluirCliente(id: string) {
  await verificarPermissao("clientes", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.cliente.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Cliente não encontrado");

  await prisma.cliente.update({
    where: { id },
    data: { status: "INATIVO" },
  });

  await registrar({ recurso: "clientes", acao: "desativar", registroId: id });
  revalidatePath("/clientes");
  return { data: null };
}

export async function deletarCliente(id: string) {
  await verificarPermissao("clientes", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.cliente.findFirst({
    where: { id, empresa_id: empresaId },
    include: {
      _count: {
        select: { contratos: true, propostas: true, recebiveis: true, leads: true },
      },
    },
  });
  if (!existente) throw new Error("Cliente não encontrado");

  const total = existente._count.contratos + existente._count.propostas
    + existente._count.recebiveis + existente._count.leads;

  if (total > 0) {
    throw new Error(
      `Não é possível excluir: este cliente possui ${total} registro(s) vinculado(s) (contratos, propostas, recebíveis ou leads). Desative-o em vez de excluir.`
    );
  }

  await prisma.cliente.delete({ where: { id } });
  await registrar({ recurso: "clientes", acao: "excluir_definitivo", registroId: id });
  revalidatePath("/clientes");
  return { data: null };
}
