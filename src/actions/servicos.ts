"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schemaServico = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional(),
  valor_base: z.string().optional(),
  plano_contas_id: z.string().optional().nullable(),
  canal: z.enum(["ARATO", "CONSELHO_AGRO", "CONSULTORIA"]).optional().nullable(),
  plano: z.enum(["ESSENCIAL", "GESTAO", "PERFORMANCE", "NOVO_AGRO", "MESA_AGRO", "CONSULTORIA_AGRO"]).optional().nullable(),
  tipo_cobranca: z.enum(["ASSINATURA", "PROJETO", "PONTUAL"]).optional().nullable(),
  asaas_link_pagamento: z.string().optional().nullable(),
});

type ServicoInput = z.infer<typeof schemaServico>;

export async function criarServico(input: ServicoInput) {
  await verificarPermissao("servicos", "criar");
  const empresaId = await obterEmpresaAtiva();

  const data = schemaServico.parse(input);

  const servico = await prisma.servico.create({
    data: {
      nome: data.nome,
      descricao: data.descricao || null,
      valor_base: data.valor_base ? parseFloat(data.valor_base) : null,
      plano_contas_id: data.plano_contas_id ?? null,
      canal: data.canal ?? null,
      plano: data.plano ?? null,
      tipo_cobranca: data.tipo_cobranca ?? null,
      asaas_link_pagamento: data.asaas_link_pagamento ?? null,
      empresa_id: empresaId,
    },
  });

  revalidatePath("/servicos");
  return { data: servico };
}

export async function editarServico(id: string, input: ServicoInput) {
  await verificarPermissao("servicos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.servico.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Serviço não encontrado");

  const data = schemaServico.parse(input);

  const servico = await prisma.servico.update({
    where: { id },
    data: {
      nome: data.nome,
      descricao: data.descricao || null,
      valor_base: data.valor_base ? parseFloat(data.valor_base) : null,
      plano_contas_id: data.plano_contas_id ?? null,
      canal: data.canal ?? null,
      plano: data.plano ?? null,
      tipo_cobranca: data.tipo_cobranca ?? null,
      asaas_link_pagamento: data.asaas_link_pagamento ?? null,
    },
  });

  revalidatePath("/servicos");
  return { data: servico };
}

export async function excluirServico(id: string) {
  await verificarPermissao("servicos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existenteExcluir = await prisma.servico.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existenteExcluir) throw new Error("Serviço não encontrado");

  await prisma.servico.update({
    where: { id },
    data: { ativo: false },
  });

  revalidatePath("/servicos");
  return { data: null };
}
