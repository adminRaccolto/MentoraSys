"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schemaFornecedor = z.object({
  nome:          z.string().min(1, "Nome obrigatório"),
  cnpj_cpf:      z.string().optional(),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone:      z.string().optional(),
  whatsapp:      z.string().optional(),
  nome_contato:  z.string().optional(),
  cargo_contato: z.string().optional(),
  // endereço
  cep:           z.string().optional(),
  logradouro:    z.string().optional(),
  numero:        z.string().optional(),
  complemento:   z.string().optional(),
  bairro:        z.string().optional(),
  cidade:        z.string().optional(),
  estado:        z.string().optional(),
  // dados bancários
  banco:         z.string().optional(),
  agencia:       z.string().optional(),
  conta:         z.string().optional(),
  tipo_conta:    z.string().optional(),
  // pix
  chave_pix:     z.string().optional(),
  tipo_chave_pix: z.string().optional(),
  observacoes:   z.string().optional(),
});

type InputFornecedor = z.input<typeof schemaFornecedor>;

function mapData(d: z.output<typeof schemaFornecedor>) {
  return {
    nome:          d.nome,
    cnpj_cpf:      d.cnpj_cpf      || null,
    email:         d.email         || null,
    telefone:      d.telefone      || null,
    whatsapp:      d.whatsapp      || null,
    nome_contato:  d.nome_contato  || null,
    cargo_contato: d.cargo_contato || null,
    cep:           d.cep           || null,
    logradouro:    d.logradouro    || null,
    numero:        d.numero        || null,
    complemento:   d.complemento   || null,
    bairro:        d.bairro        || null,
    cidade:        d.cidade        || null,
    estado:        d.estado        || null,
    banco:         d.banco         || null,
    agencia:       d.agencia       || null,
    conta:         d.conta         || null,
    tipo_conta:    d.tipo_conta    || null,
    chave_pix:     d.chave_pix     || null,
    tipo_chave_pix: d.tipo_chave_pix || null,
    observacoes:   d.observacoes   || null,
  };
}

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
    data: { empresa_id: empresaId, ...mapData(data) },
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
    data: mapData(data),
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
