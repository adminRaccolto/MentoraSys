"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";

const schemaCreate = z.object({
  descricao: z.string().min(1, "Descrição obrigatória"),
  fornecedor: z.string().optional(),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  data_vencimento: z.string().min(1, "Data obrigatória"),
  plano_contas_id: z.string().optional(),
  conta_bancaria_id: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaBaixar = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  valor_pago: z.coerce.number().positive("Valor deve ser positivo"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});

type InputCreate = z.input<typeof schemaCreate>;
type InputBaixar = z.input<typeof schemaBaixar>;

export async function criarContaPagar(input: InputCreate) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaCreate.parse(input);

  const conta = await prisma.contaPagar.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id,
      descricao: data.descricao,
      fornecedor: data.fornecedor || null,
      valor: data.valor,
      data_vencimento: parseLocalDate(data.data_vencimento),
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "contas-pagar", acao: "criar", registroId: conta.id });
  revalidatePath("/financeiro/contas-a-pagar");
  return { data: { ...conta, valor: Number(conta.valor), valor_pago: conta.valor_pago != null ? Number(conta.valor_pago) : null } };
}

export async function baixarContaPagar(id: string, input: InputBaixar) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaBaixar.parse(input);

  const conta = await prisma.contaPagar.findFirst({ where: { id, empresa_id: empresaId } });
  if (!conta) throw new Error("Conta a pagar não encontrada");
  if (conta.status === "PAGO") throw new Error("Conta já foi baixada");
  if (conta.status === "CANCELADO") throw new Error("Conta cancelada não pode ser baixada");

  const novoStatus = data.valor_pago < Number(conta.valor) ? "PARCIAL" : "PAGO";

  const updated = await prisma.contaPagar.update({
    where: { id },
    data: {
      status: novoStatus,
      data_pagamento: parseLocalDate(data.data_pagamento),
      valor_pago: data.valor_pago,
      forma_pagamento: data.forma_pagamento,
      conta_bancaria_id: data.conta_bancaria_id || null,
    },
  });

  await registrar({ recurso: "contas-pagar", acao: "baixar", registroId: id, detalhes: { status: novoStatus, valor_pago: data.valor_pago } });
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: updated.valor_pago != null ? Number(updated.valor_pago) : null } };
}

export async function estornarContaPagar(id: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const conta = await prisma.contaPagar.findFirst({ where: { id, empresa_id: empresaId } });
  if (!conta) throw new Error("Conta não encontrada");
  if (conta.status !== "PAGO" && conta.status !== "PARCIAL") throw new Error("Apenas contas pagas ou parciais podem ser estornadas");

  const novoStatus = conta.data_vencimento < new Date() ? "VENCIDO" : "PENDENTE";

  const updated = await prisma.contaPagar.update({
    where: { id },
    data: { status: novoStatus, data_pagamento: null, valor_pago: null, forma_pagamento: null },
  });

  await registrar({ recurso: "contas-pagar", acao: "estornar", registroId: id });
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: null } };
}

const schemaBaixarLote = z.object({
  data_pagamento: z.string().min(1, "Data obrigatória"),
  forma_pagamento: z.string().min(1, "Forma obrigatória"),
  conta_bancaria_id: z.string().optional(),
});
type InputBaixarLote = z.input<typeof schemaBaixarLote>;

export async function baixarLoteContasPagar(ids: string[], input: InputBaixarLote) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaBaixarLote.parse(input);

  const contas = await prisma.contaPagar.findMany({ where: { id: { in: ids }, empresa_id: empresaId } });
  const elegíveis = contas.filter(c => c.status !== "PAGO" && c.status !== "CANCELADO");
  if (elegíveis.length === 0) throw new Error("Nenhuma conta elegível para baixa");

  await Promise.all(elegíveis.map(c =>
    prisma.contaPagar.update({
      where: { id: c.id },
      data: {
        status: "PAGO",
        data_pagamento: parseLocalDate(data.data_pagamento),
        valor_pago: c.valor,
        forma_pagamento: data.forma_pagamento,
        conta_bancaria_id: data.conta_bancaria_id || null,
      },
    })
  ));

  await registrar({ recurso: "contas-pagar", acao: "baixar_lote", detalhes: { ids: elegíveis.map(c => c.id), qtd: elegíveis.length } });
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro");
  return { data: { qtd: elegíveis.length } };
}

export async function editarContaPagar(id: string, input: InputCreate) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCreate.parse(input);

  const conta = await prisma.contaPagar.findFirst({ where: { id, empresa_id: empresaId } });
  if (!conta) throw new Error("Conta não encontrada");
  if (conta.status === "PAGO") throw new Error("Conta paga não pode ser editada");

  const updated = await prisma.contaPagar.update({
    where: { id },
    data: {
      descricao: data.descricao,
      fornecedor: data.fornecedor || null,
      valor: data.valor,
      data_vencimento: parseLocalDate(data.data_vencimento),
      plano_contas_id: data.plano_contas_id || null,
      conta_bancaria_id: data.conta_bancaria_id || null,
      observacoes: data.observacoes || null,
    },
  });

  await registrar({ recurso: "contas-pagar", acao: "editar", registroId: id });
  revalidatePath("/financeiro/contas-a-pagar");
  return { data: { ...updated, valor: Number(updated.valor), valor_pago: updated.valor_pago != null ? Number(updated.valor_pago) : null } };
}

export async function excluirContaPagar(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const conta = await prisma.contaPagar.findFirst({ where: { id, empresa_id: empresaId } });
  if (!conta) throw new Error("Conta não encontrada");
  if (conta.status === "PAGO") throw new Error("Conta paga não pode ser excluída");

  await prisma.contaPagar.delete({ where: { id } });
  await registrar({ recurso: "contas-pagar", acao: "excluir", registroId: id });
  revalidatePath("/financeiro/contas-a-pagar");
  return { data: null };
}
