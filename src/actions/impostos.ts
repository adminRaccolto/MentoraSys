"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { obterOuCriarContaImposto } from "@/lib/plano-contas-impostos";
import { registrar } from "@/lib/auditoria";

// Lucro presumido — prestação de serviços de consultoria, regime de caixa
// (impostos calculados sobre a receita efetivamente recebida, não a faturada).
const ALIQ_PIS = 0.0065;
const ALIQ_COFINS = 0.03;
const PRESUNCAO_IRPJ_CSLL = 0.32; // base de cálculo = 32% da receita (serviços)
const ALIQ_IRPJ = 0.15;
const ALIQ_IRPJ_ADICIONAL = 0.10;
const LIMITE_ADICIONAL_TRIMESTRE = 60000; // R$20.000/mês × 3 meses
const ALIQ_CSLL = 0.09;

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

function marcadorImposto(tipo: "PIS" | "COFINS" | "IRPJ" | "CSLL", competencia: string): string {
  return `imposto:${tipo}|competencia:${competencia}`;
}

function mesesDoTrimestre(trimestre: number): [number, number] {
  const inicio = (trimestre - 1) * 3 + 1;
  return [inicio, inicio + 2];
}

// Último dia do mês seguinte a `mes1Indexed` (que pode passar de 12, ex: 13 = janeiro do ano seguinte).
function ultimoDiaMesSeguinte(ano: number, mes1Indexed: number): Date {
  return new Date(ano, mes1Indexed + 1, 0);
}

async function receitaRecebida(empresaId: string, inicio: Date, fim: Date): Promise<number> {
  const agg = await prisma.recebivel.aggregate({
    where: { empresa_id: empresaId, status: "PAGO", data_pagamento: { gte: inicio, lte: fim } },
    _sum: { valor_pago: true },
  });
  return Number(agg._sum.valor_pago ?? 0);
}

function parseCompetenciaMensal(competencia: string): { ano: number; mes: number } {
  const [ano, mes] = competencia.split("-").map(Number);
  return { ano, mes };
}

function parseCompetenciaTrimestral(competencia: string): { ano: number; trimestre: number } {
  const [anoStr, tStr] = competencia.split("-T");
  return { ano: Number(anoStr), trimestre: Number(tStr) };
}

export interface PrevisaoPisCofins {
  competencia: string;
  receita: number;
  pis: number;
  cofins: number;
  vencimento: string;
  jaGerado: boolean;
}

export async function calcularPisCofins(competencia: string): Promise<PrevisaoPisCofins> {
  const empresaId = await obterEmpresaAtiva();
  const { ano, mes } = parseCompetenciaMensal(competencia);
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const receita = await receitaRecebida(empresaId, inicio, fim);
  const pis = arred(receita * ALIQ_PIS);
  const cofins = arred(receita * ALIQ_COFINS);
  const vencimento = new Date(ano, mes, 25); // dia 25 do mês seguinte

  const existente = await prisma.contaPagar.findFirst({
    where: {
      empresa_id: empresaId,
      observacoes: { in: [marcadorImposto("PIS", competencia), marcadorImposto("COFINS", competencia)] },
    },
    select: { id: true },
  });

  return {
    competencia,
    receita,
    pis,
    cofins,
    vencimento: vencimento.toISOString().split("T")[0],
    jaGerado: !!existente,
  };
}

export async function gerarPrevisaoPisCofins(competencia: string): Promise<void> {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const { receita, pis, cofins, vencimento } = await calcularPisCofins(competencia);

  if (receita <= 0) throw new Error("Nenhuma receita recebida nesse período — nada a lançar.");

  const { mes, ano } = parseCompetenciaMensal(competencia);
  const labelMes = `${String(mes).padStart(2, "0")}/${ano}`;
  const marcadorPis = marcadorImposto("PIS", competencia);
  const marcadorCofins = marcadorImposto("COFINS", competencia);

  const existentes = await prisma.contaPagar.findMany({
    where: { empresa_id: empresaId, observacoes: { in: [marcadorPis, marcadorCofins] } },
    select: { observacoes: true },
  });
  const jaTem = new Set(existentes.map((e) => e.observacoes));
  if (jaTem.has(marcadorPis) && jaTem.has(marcadorCofins)) {
    throw new Error("PIS e COFINS desse período já foram lançados.");
  }

  const planoContasId = await obterOuCriarContaImposto(empresaId, "PIS/COFINS");

  if (!jaTem.has(marcadorPis)) {
    await prisma.contaPagar.create({
      data: {
        empresa_id: empresaId,
        plano_contas_id: planoContasId,
        descricao: `PIS — previsão ${labelMes} (lucro presumido, 0,65% sobre receita recebida)`,
        valor: pis,
        data_vencimento: new Date(vencimento),
        observacoes: marcadorPis,
      },
    });
  }
  if (!jaTem.has(marcadorCofins)) {
    await prisma.contaPagar.create({
      data: {
        empresa_id: empresaId,
        plano_contas_id: planoContasId,
        descricao: `COFINS — previsão ${labelMes} (lucro presumido, 3% sobre receita recebida)`,
        valor: cofins,
        data_vencimento: new Date(vencimento),
        observacoes: marcadorCofins,
      },
    });
  }

  await registrar({
    recurso: "contas-pagar",
    acao: "criar",
    detalhes: { tipo: "previsao-pis-cofins", competencia, pis, cofins, receita },
  });
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro/impostos");
}

export interface PrevisaoIrpjCsll {
  competencia: string;
  receita: number;
  base: number;
  irpj: number;
  adicionalIrpj: number;
  csll: number;
  vencimento: string;
  jaGerado: boolean;
}

export async function calcularIrpjCsll(competencia: string): Promise<PrevisaoIrpjCsll> {
  const empresaId = await obterEmpresaAtiva();
  const { ano, trimestre } = parseCompetenciaTrimestral(competencia);
  const [mesIni, mesFim] = mesesDoTrimestre(trimestre);
  const inicio = new Date(ano, mesIni - 1, 1);
  const fim = new Date(ano, mesFim, 0, 23, 59, 59);

  const receita = await receitaRecebida(empresaId, inicio, fim);
  const base = arred(receita * PRESUNCAO_IRPJ_CSLL);
  const adicionalIrpj = base > LIMITE_ADICIONAL_TRIMESTRE ? arred((base - LIMITE_ADICIONAL_TRIMESTRE) * ALIQ_IRPJ_ADICIONAL) : 0;
  const irpj = arred(base * ALIQ_IRPJ) + adicionalIrpj;
  const csll = arred(base * ALIQ_CSLL);
  const vencimento = ultimoDiaMesSeguinte(ano, mesFim);

  const existente = await prisma.contaPagar.findFirst({
    where: {
      empresa_id: empresaId,
      observacoes: { in: [marcadorImposto("IRPJ", competencia), marcadorImposto("CSLL", competencia)] },
    },
    select: { id: true },
  });

  return {
    competencia,
    receita,
    base,
    irpj: arred(irpj),
    adicionalIrpj,
    csll,
    vencimento: vencimento.toISOString().split("T")[0],
    jaGerado: !!existente,
  };
}

export async function gerarPrevisaoIrpjCsll(competencia: string): Promise<void> {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const { receita, irpj, csll, vencimento } = await calcularIrpjCsll(competencia);

  if (receita <= 0) throw new Error("Nenhuma receita recebida nesse trimestre — nada a lançar.");

  const { ano, trimestre } = parseCompetenciaTrimestral(competencia);
  const labelTrimestre = `${trimestre}º trimestre de ${ano}`;
  const marcadorIrpj = marcadorImposto("IRPJ", competencia);
  const marcadorCsll = marcadorImposto("CSLL", competencia);

  const existentes = await prisma.contaPagar.findMany({
    where: { empresa_id: empresaId, observacoes: { in: [marcadorIrpj, marcadorCsll] } },
    select: { observacoes: true },
  });
  const jaTem = new Set(existentes.map((e) => e.observacoes));
  if (jaTem.has(marcadorIrpj) && jaTem.has(marcadorCsll)) {
    throw new Error("IRPJ e CSLL desse trimestre já foram lançados.");
  }

  if (!jaTem.has(marcadorIrpj)) {
    const planoIrpjId = await obterOuCriarContaImposto(empresaId, "IRPJ");
    await prisma.contaPagar.create({
      data: {
        empresa_id: empresaId,
        plano_contas_id: planoIrpjId,
        descricao: `IRPJ — previsão ${labelTrimestre} (lucro presumido, 15% + adicional sobre base de 32% da receita)`,
        valor: irpj,
        data_vencimento: new Date(vencimento),
        observacoes: marcadorIrpj,
      },
    });
  }
  if (!jaTem.has(marcadorCsll)) {
    const planoCsllId = await obterOuCriarContaImposto(empresaId, "CSLL");
    await prisma.contaPagar.create({
      data: {
        empresa_id: empresaId,
        plano_contas_id: planoCsllId,
        descricao: `CSLL — previsão ${labelTrimestre} (lucro presumido, 9% sobre base de 32% da receita)`,
        valor: csll,
        data_vencimento: new Date(vencimento),
        observacoes: marcadorCsll,
      },
    });
  }

  await registrar({
    recurso: "contas-pagar",
    acao: "criar",
    detalhes: { tipo: "previsao-irpj-csll", competencia, irpj, csll, receita },
  });
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro/impostos");
}

export async function listarPrevisoesGeradas() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.contaPagar.findMany({
    where: { empresa_id: empresaId, observacoes: { startsWith: "imposto:" } },
    orderBy: { data_vencimento: "desc" },
    select: {
      id: true, descricao: true, valor: true, data_vencimento: true, status: true, observacoes: true,
    },
  });
}
