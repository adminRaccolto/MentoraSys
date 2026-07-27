"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schemaFornecedor = z.object({
  nome:       z.string().min(1, "Nome obrigatório"),
  cnpj_cpf:   z.string().optional(),
  email:      z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone:   z.string().optional(),
  contato:    z.string().optional(),
  observacoes: z.string().optional(),
});

type InputFornecedor = z.input<typeof schemaFornecedor>;

export async function listarFornecedores() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.fornecedor.findMany({
    where: { empresa_id: empresaId, ativo: true },
    orderBy: { nome: "asc" },
  });
}

export async function criarFornecedor(input: InputFornecedor) {
  await verificarPermissao("cadastros", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaFornecedor.parse(input);

  const f = await prisma.fornecedor.create({
    data: {
      empresa_id:  empresaId,
      nome:        data.nome,
      cnpj_cpf:    data.cnpj_cpf || null,
      email:       data.email || null,
      telefone:    data.telefone || null,
      contato:     data.contato || null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "fornecedores", acao: "criar", registroId: f.id });
  revalidatePath("/fornecedores");
  return f;
}

export async function editarFornecedor(id: string, input: InputFornecedor) {
  await verificarPermissao("cadastros", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaFornecedor.parse(input);

  const exists = await prisma.fornecedor.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Fornecedor não encontrado");

  const f = await prisma.fornecedor.update({
    where: { id },
    data: {
      nome:        data.nome,
      cnpj_cpf:    data.cnpj_cpf || null,
      email:       data.email || null,
      telefone:    data.telefone || null,
      contato:     data.contato || null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "fornecedores", acao: "editar", registroId: id });
  revalidatePath("/fornecedores");
  return f;
}

export async function excluirFornecedor(id: string) {
  await verificarPermissao("cadastros", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const exists = await prisma.fornecedor.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Fornecedor não encontrado");

  await prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
  await registrar({ recurso: "fornecedores", acao: "excluir", registroId: id });
  revalidatePath("/fornecedores");
}
