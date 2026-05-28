"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["RECEITA", "CUSTO", "DESPESA", "INVESTIMENTO", "TESOURARIA"]),
  codigo: z.string().optional(),
  parent_id: z.string().optional().nullable(),
  aceita_lancamento: z.boolean().default(true),
});

type PlanoInput = z.infer<typeof schema>;

export async function criarConta(input: PlanoInput) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const conta = await prisma.planoDeContas.create({
    data: { ...data, parent_id: data.parent_id ?? null, empresa_id: empresaId },
  });

  await registrar({ recurso: "plano-contas", acao: "criar", registroId: conta.id, detalhes: { nome: data.nome } });
  revalidatePath("/plano-contas");
  return { data: conta };
}

export async function editarConta(id: string, input: PlanoInput) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  const conta = await prisma.planoDeContas.update({
    where: { id, empresa_id: empresaId },
    data: { ...data, parent_id: data.parent_id ?? null },
  });

  await registrar({ recurso: "plano-contas", acao: "editar", registroId: id });
  revalidatePath("/plano-contas");
  return { data: conta };
}

export async function excluirConta(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.planoDeContas.update({
    where: { id, empresa_id: empresaId },
    data: { ativo: false },
  });

  await registrar({ recurso: "plano-contas", acao: "excluir", registroId: id });
  revalidatePath("/plano-contas");
  return { data: null };
}

export async function seedPlanoContas() {
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.planoDeContas.count({ where: { empresa_id: empresaId } });
  if (existente > 0) return { data: null, message: "Plano de contas já existe para esta empresa." };

  const c = (
    codigo: string,
    nome: string,
    tipo: "RECEITA" | "CUSTO" | "DESPESA" | "INVESTIMENTO" | "TESOURARIA",
    parent_id: string | null = null,
    aceita_lancamento = true,
  ) => prisma.planoDeContas.create({ data: { empresa_id: empresaId, codigo, nome, tipo, parent_id, aceita_lancamento } });

  const r = await c("1", "Receitas", "RECEITA", null, false);
  const rOp = await c("1.1", "Receitas Operacionais", "RECEITA", r.id, false);
  await c("1.1.1", "Consultoria", "RECEITA", rOp.id);
  await c("1.1.2", "Mentoria", "RECEITA", rOp.id);
  await c("1.1.3", "Valuation", "RECEITA", rOp.id);
  await c("1.1.4", "Estudo de Viabilidade", "RECEITA", rOp.id);
  await c("1.1.5", "Conselheiro", "RECEITA", rOp.id);
  const rOut = await c("1.2", "Outras Receitas", "RECEITA", r.id, false);
  await c("1.2.1", "Juros Recebidos", "RECEITA", rOut.id);
  await c("1.2.2", "Reembolsos", "RECEITA", rOut.id);
  await c("1.2.3", "Receitas Não Operacionais", "RECEITA", rOut.id);

  const cu = await c("2", "Custos Diretos dos Serviços", "CUSTO", null, false);
  await c("2.1", "Terceiros Vinculados a Projetos", "CUSTO", cu.id);
  await c("2.2", "Deslocamentos de Projeto", "CUSTO", cu.id);
  await c("2.3", "Ferramentas Específicas por Contrato", "CUSTO", cu.id);

  const d = await c("3", "Despesas Operacionais", "DESPESA", null, false);
  const adm = await c("3.1", "Administrativas", "DESPESA", d.id, false);
  await c("3.1.1", "Salários e Pró-labore", "DESPESA", adm.id);
  await c("3.1.2", "Encargos", "DESPESA", adm.id);
  await c("3.1.3", "Aluguel", "DESPESA", adm.id);
  await c("3.1.4", "Internet e Telefonia", "DESPESA", adm.id);
  await c("3.1.5", "Softwares e Sistemas", "DESPESA", adm.id);
  await c("3.1.6", "Contabilidade", "DESPESA", adm.id);
  await c("3.1.7", "Jurídico", "DESPESA", adm.id);
  await c("3.1.8", "Material de Escritório", "DESPESA", adm.id);
  const com = await c("3.2", "Comerciais", "DESPESA", d.id, false);
  await c("3.2.1", "Marketing", "DESPESA", com.id);
  await c("3.2.2", "Tráfego", "DESPESA", com.id);
  await c("3.2.3", "Comissões", "DESPESA", com.id);
  await c("3.2.4", "Prospecção", "DESPESA", com.id);
  const ger = await c("3.3", "Despesas Gerais", "DESPESA", d.id, false);
  await c("3.3.1", "Viagens", "DESPESA", ger.id);
  await c("3.3.2", "Reuniões", "DESPESA", ger.id);
  await c("3.3.3", "Assinaturas Diversas", "DESPESA", ger.id);

  const fin = await c("4", "Financeiras", "DESPESA", null, false);
  await c("4.1", "Tarifas Bancárias", "DESPESA", fin.id);
  await c("4.2", "Juros Pagos", "DESPESA", fin.id);
  await c("4.3", "IOF", "DESPESA", fin.id);
  await c("4.4", "Multas", "DESPESA", fin.id);

  const inv = await c("5", "Investimentos", "INVESTIMENTO", null, false);
  await c("5.1", "Equipamentos", "INVESTIMENTO", inv.id);
  await c("5.2", "Estruturação de Sistemas", "INVESTIMENTO", inv.id);
  await c("5.3", "Desenvolvimento Tecnológico", "INVESTIMENTO", inv.id);

  const tes = await c("6", "Tesouraria", "TESOURARIA", null, false);
  await c("6.1", "Movimentações de Caixa e Bancos", "TESOURARIA", tes.id);
  await c("6.2", "Ajustes de Saldo", "TESOURARIA", tes.id);

  revalidatePath("/plano-contas");
  return { data: null, message: "Plano de contas padrão criado com sucesso." };
}
