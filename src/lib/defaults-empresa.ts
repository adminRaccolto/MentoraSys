import { prisma } from "@/lib/prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type DbClient = Tx | typeof prisma;

// ─── Perfis padrão ────────────────────────────────────────────────────────────

const PERFIS_PADRAO: {
  nome: string;
  descricao: string;
  permissoes: { recurso: string; acao: string }[];
}[] = [
  {
    nome: "Consultor",
    descricao: "Acesso comercial e de projetos",
    permissoes: [
      { recurso: "clientes",     acao: "criar"  },
      { recurso: "clientes",     acao: "editar" },
      { recurso: "clientes",     acao: "excluir" },
      { recurso: "servicos",     acao: "criar"  },
      { recurso: "servicos",     acao: "editar" },
      { recurso: "servicos",     acao: "excluir" },
      { recurso: "crm",          acao: "criar"  },
      { recurso: "crm",          acao: "editar" },
      { recurso: "crm",          acao: "excluir" },
      { recurso: "propostas",    acao: "criar"  },
      { recurso: "propostas",    acao: "editar" },
      { recurso: "propostas",    acao: "excluir" },
      { recurso: "contratos",    acao: "criar"  },
      { recurso: "contratos",    acao: "editar" },
      { recurso: "projetos",     acao: "criar"  },
      { recurso: "projetos",     acao: "editar" },
      { recurso: "projetos",     acao: "excluir" },
      { recurso: "modelos",      acao: "criar"  },
      { recurso: "modelos",      acao: "editar" },
      { recurso: "modelos",      acao: "excluir" },
      { recurso: "agenda",       acao: "criar"  },
      { recurso: "agenda",       acao: "editar" },
      { recurso: "agenda",       acao: "excluir" },
      { recurso: "diagnosticos", acao: "criar"  },
      { recurso: "diagnosticos", acao: "editar" },
      { recurso: "diagnosticos", acao: "excluir" },
      { recurso: "faturamento",  acao: "editar" },
    ],
  },
  {
    nome: "Financeiro",
    descricao: "Acesso financeiro e faturamento",
    permissoes: [
      { recurso: "clientes",    acao: "editar" },
      { recurso: "contratos",   acao: "editar" },
      { recurso: "financeiro",  acao: "criar"  },
      { recurso: "financeiro",  acao: "editar" },
      { recurso: "financeiro",  acao: "excluir" },
      { recurso: "faturamento", acao: "criar"  },
      { recurso: "faturamento", acao: "editar" },
      { recurso: "faturamento", acao: "excluir" },
    ],
  },
];

async function garantirPermissao(tx: DbClient, recurso: string, acao: string) {
  return tx.permissao.upsert({
    where: { recurso_acao: { recurso, acao } },
    update: {},
    create: { recurso, acao, descricao: `${acao} ${recurso}` },
  });
}

export async function criarPerfisPadrao(empresaId: string, tx: DbClient = prisma) {
  for (const def of PERFIS_PADRAO) {
    const perfil = await tx.perfil.create({
      data: { empresa_id: empresaId, nome: def.nome, descricao: def.descricao },
    });
    for (const { recurso, acao } of def.permissoes) {
      const perm = await garantirPermissao(tx, recurso, acao);
      await tx.perfilPermissao.create({ data: { perfil_id: perfil.id, permissao_id: perm.id } });
    }
  }
}

// ─── Plano de contas padrão ───────────────────────────────────────────────────

export async function criarPlanoContasPadrao(empresaId: string, tx: DbClient = prisma) {
  const grupo = async (
    nome: string,
    tipo: "RECEITA" | "DESPESA" | "CUSTO" | "INVESTIMENTO" | "TESOURARIA",
    parent_id: string | null,
    aceita = false,
    codigo?: string,
  ) =>
    tx.planoDeContas.create({
      data: { empresa_id: empresaId, nome, tipo, parent_id, aceita_lancamento: aceita, codigo: codigo ?? null },
    });

  // ── RECEITAS ──────────────────────────────────────────────────────────────
  const recOp = await grupo("Receitas Operacionais",        "RECEITA", null);
  const recSvc = await grupo("Receita de Serviços",         "RECEITA", recOp.id);
  await grupo("Consultoria Financeira",                      "RECEITA", recSvc.id, true, "1.1.1");
  await grupo("Consultoria Administrativa",                  "RECEITA", recSvc.id, true, "1.1.2");
  await grupo("Consultoria Estratégica",                     "RECEITA", recSvc.id, true, "1.1.3");
  await grupo("Consultoria Agroempresarial",                 "RECEITA", recSvc.id, true, "1.1.4");
  await grupo("Outros Serviços",                             "RECEITA", recSvc.id, true, "1.1.5");

  const recNOp = await grupo("Receitas Não Operacionais",   "RECEITA", null);
  const recFin  = await grupo("Receitas Financeiras",       "RECEITA", recNOp.id);
  await grupo("Juros e Multas",                              "RECEITA", recFin.id, true, "2.1.1");
  await grupo("Rendimentos de Aplicações",                   "RECEITA", recFin.id, true, "2.1.2");
  await grupo("Outras Receitas Não Operacionais",            "RECEITA", recNOp.id, true, "2.2");

  // ── DESPESAS ──────────────────────────────────────────────────────────────
  const despOp  = await grupo("Despesas Operacionais",      "DESPESA", null);
  const pessoal = await grupo("Pessoal",                    "DESPESA", despOp.id);
  await grupo("Salários e Pró-labore",                       "DESPESA", pessoal.id, true, "3.1.1");
  await grupo("Encargos Sociais",                            "DESPESA", pessoal.id, true, "3.1.2");
  await grupo("Benefícios",                                  "DESPESA", pessoal.id, true, "3.1.3");

  const admin = await grupo("Despesas Administrativas",     "DESPESA", despOp.id);
  await grupo("Aluguel",                                     "DESPESA", admin.id, true, "3.2.1");
  await grupo("Contas de Consumo (Água/Luz/Internet)",       "DESPESA", admin.id, true, "3.2.2");
  await grupo("Material de Escritório",                      "DESPESA", admin.id, true, "3.2.3");
  await grupo("Serviços de Terceiros",                       "DESPESA", admin.id, true, "3.2.4");
  await grupo("TI e Software",                               "DESPESA", admin.id, true, "3.2.5");

  const vendas = await grupo("Despesas com Vendas",         "DESPESA", despOp.id);
  await grupo("Marketing e Publicidade",                     "DESPESA", vendas.id, true, "3.3.1");
  await grupo("Comissões",                                   "DESPESA", vendas.id, true, "3.3.2");

  const impost = await grupo("Impostos e Taxas",            "DESPESA", despOp.id);
  await grupo("ISS",                                         "DESPESA", impost.id, true, "3.4.1");
  await grupo("PIS/COFINS",                                  "DESPESA", impost.id, true, "3.4.2");
  await grupo("Outros Impostos",                             "DESPESA", impost.id, true, "3.4.3");

  // ── CUSTOS ────────────────────────────────────────────────────────────────
  const custSvc = await grupo("Custos dos Serviços",        "CUSTO", null);
  const custDir = await grupo("Custos Diretos",             "CUSTO", custSvc.id);
  await grupo("Honorários de Consultores",                   "CUSTO", custDir.id, true, "4.1.1");
  await grupo("Deslocamento e Hospedagem",                   "CUSTO", custDir.id, true, "4.1.2");
  await grupo("Materiais e Impressos",                       "CUSTO", custDir.id, true, "4.1.3");

  // ── INVESTIMENTOS ─────────────────────────────────────────────────────────
  const invGrp = await grupo("Investimentos",               "INVESTIMENTO", null);
  const ativosFix = await grupo("Ativos Fixos",             "INVESTIMENTO", invGrp.id);
  await grupo("Equipamentos e Mobiliário",                   "INVESTIMENTO", ativosFix.id, true, "5.1.1");
  await grupo("Software e Licenças",                         "INVESTIMENTO", ativosFix.id, true, "5.1.2");

  // ── TESOURARIA ────────────────────────────────────────────────────────────
  const tesGrp = await grupo("Caixa e Bancos",              "TESOURARIA", null);
  await grupo("Caixa",                                       "TESOURARIA", tesGrp.id, true, "6.1");
  await grupo("Contas Bancárias",                            "TESOURARIA", tesGrp.id, true, "6.2");
}
