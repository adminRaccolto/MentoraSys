"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";
import { criarNotificacao } from "@/lib/notificacoes";
import { enviarOtpAceite } from "@/lib/email";

const schemaItem = z.object({
  servico_id: z.string().optional(),
  descricao: z.string().min(1),
  quantidade: z.number().positive(),
  valor_unitario: z.number().min(0),
  desconto: z.number().min(0).max(100).default(0),
  ordem: z.number().default(0),
});

const schemaParcela = z.object({
  numero: z.coerce.number(),
  vencimento: z.string(),
  valor: z.coerce.number(),
});

const schemaProposta = z.object({
  cliente_id: z.string().min(1, "Cliente obrigatório"),
  lead_id: z.string().optional().nullable(),
  responsavel_id: z.string().optional().nullable(),
  titulo: z.string().min(2, "Título obrigatório"),
  objeto: z.string().optional(),
  introducao: z.string().optional(),
  condicoes: z.string().optional(),
  validade: z.string().optional(),
  forma_pagamento: z.string().optional(),
  periodicidade: z.string().optional(),
  numero_parcelas: z.coerce.number().int().positive().optional().nullable(),
  primeiro_vencimento: z.string().optional(),
  contato_nome: z.string().optional(),
  contato_email: z.string().optional(),
  contato_telefone: z.string().optional(),
  parcelas_json: z.array(schemaParcela).optional().nullable(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type PropostaInput = z.infer<typeof schemaProposta>;

function calcularTotal(itens: z.infer<typeof schemaItem>[]) {
  return itens.reduce((acc, item) => {
    const subtotal = item.quantidade * item.valor_unitario;
    return acc + subtotal * (1 - item.desconto / 100);
  }, 0);
}

export async function criarProposta(input: PropostaInput) {
  await verificarPermissao("propostas", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const data = schemaProposta.parse(input);
  const valor_total = calcularTotal(data.itens);

  const proposta = await prisma.proposta.create({
    data: {
      empresa_id: empresaId,
      cliente_id: data.cliente_id,
      lead_id: data.lead_id || null,
      responsavel_id: data.responsavel_id || null,
      titulo: data.titulo,
      objeto: data.objeto || null,
      introducao: data.introducao || null,
      condicoes: data.condicoes || null,
      validade: data.validade ? new Date(data.validade) : null,
      forma_pagamento: data.forma_pagamento || null,
      periodicidade: data.periodicidade || null,
      numero_parcelas: data.numero_parcelas ?? null,
      primeiro_vencimento: data.primeiro_vencimento ? parseLocalDate(data.primeiro_vencimento) : null,
      contato_nome: data.contato_nome || null,
      contato_email: data.contato_email || null,
      contato_telefone: data.contato_telefone || null,
      parcelas_json: data.parcelas_json ?? undefined,
      valor_total,
      criado_por: user?.id,
      itens: {
        create: data.itens.map((item, idx) => ({
          servico_id: item.servico_id || null,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto,
          ordem: item.ordem ?? idx,
        })),
      },
    },
    include: { itens: true },
  });

  await registrar({ recurso: "propostas", acao: "criar", registroId: proposta.id, detalhes: { titulo: data.titulo } });
  revalidatePath("/propostas");
  return { data: { ...proposta, valor_total: Number(proposta.valor_total), itens: proposta.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario), desconto: Number(i.desconto) })) } };
}

export async function editarProposta(id: string, input: PropostaInput) {
  await verificarPermissao("propostas", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.proposta.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Proposta não encontrada");

  const data = schemaProposta.parse(input);
  const valor_total = calcularTotal(data.itens);

  // Itens são gerenciados separadamente para evitar conflito de tipos no Prisma
  // (nested create no update força checked input que rejeita scalar FKs como cliente_id)
  await prisma.itemProposta.deleteMany({ where: { proposta_id: id } });
  await prisma.itemProposta.createMany({
    data: data.itens.map((item, idx) => ({
      proposta_id: id,
      servico_id: item.servico_id || null,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      desconto: item.desconto,
      ordem: item.ordem ?? idx,
    })),
  });

  const proposta = await prisma.proposta.update({
    where: { id },
    data: {
      cliente_id: data.cliente_id,
      lead_id: data.lead_id || null,
      responsavel_id: data.responsavel_id || null,
      titulo: data.titulo,
      objeto: data.objeto || null,
      introducao: data.introducao || null,
      condicoes: data.condicoes || null,
      validade: data.validade ? new Date(data.validade) : null,
      forma_pagamento: data.forma_pagamento || null,
      periodicidade: data.periodicidade || null,
      numero_parcelas: data.numero_parcelas ?? null,
      primeiro_vencimento: data.primeiro_vencimento ? parseLocalDate(data.primeiro_vencimento) : null,
      contato_nome: data.contato_nome || null,
      contato_email: data.contato_email || null,
      contato_telefone: data.contato_telefone || null,
      parcelas_json: data.parcelas_json ?? undefined,
      valor_total,
    },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });

  revalidatePath("/propostas");
  return { data: { ...proposta, valor_total: Number(proposta.valor_total), itens: proposta.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario), desconto: Number(i.desconto) })) } };
}

export async function enviarProposta(id: string) {
  await verificarPermissao("propostas", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.proposta.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Proposta não encontrada");

  const proposta = await prisma.proposta.update({
    where: { id },
    data: { status: "ENVIADA", enviado_em: new Date() },
  });

  revalidatePath("/propostas");
  return { data: { ...proposta, valor_total: Number(proposta.valor_total) } };
}

export async function aceitarPropostaPublica(token: string) {
  const proposta = await prisma.proposta.findUnique({
    where: { token_aceite: token },
  });

  if (!proposta) return { error: "Proposta não encontrada" };
  if (proposta.status === "ACEITA") return { error: "already_accepted" };
  if (proposta.status === "RECUSADA") return { error: "already_refused" };
  if (proposta.status === "EXPIRADA") return { error: "expired" };

  if (proposta.validade && proposta.validade < new Date()) {
    await prisma.proposta.update({
      where: { id: proposta.id },
      data: { status: "EXPIRADA" },
    });
    return { error: "expired" };
  }

  await prisma.proposta.update({
    where: { id: proposta.id },
    data: { status: "ACEITA", aceito_em: new Date() },
  });

  await criarNotificacao({
    empresa_id: proposta.empresa_id,
    tipo: `proposta_aceita:${proposta.id}`,
    titulo: "Proposta aceita pelo cliente",
    mensagem: `"${proposta.titulo}" foi aceita.`,
    url: "/propostas",
  });

  return { data: { ...proposta, valor_total: Number(proposta.valor_total) } };
}

export async function marcarPropostaAceita(id: string) {
  await verificarPermissao("propostas", "editar");
  const empresaId = await obterEmpresaAtiva();

  const proposta = await prisma.proposta.findFirst({ where: { id, empresa_id: empresaId } });
  if (!proposta) throw new Error("Proposta não encontrada");
  if (proposta.status === "ACEITA") return { ok: false, error: "Proposta já está aceita" };

  await prisma.proposta.update({
    where: { id },
    data: { status: "ACEITA", aceito_em: new Date() },
  });

  revalidatePath("/propostas");
  return { ok: true };
}

export async function excluirProposta(id: string) {
  await verificarPermissao("propostas", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.proposta.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Proposta não encontrada");

  await prisma.proposta.delete({ where: { id } });

  await registrar({ recurso: "propostas", acao: "excluir", registroId: id });
  revalidatePath("/propostas");
  return { data: null };
}

export async function solicitarOtpAceite(token: string) {
  const proposta = await prisma.proposta.findUnique({
    where: { token_aceite: token },
    include: { cliente: { select: { email: true } } },
  });

  if (!proposta) return { error: "Proposta não encontrada." };
  if (proposta.status === "ACEITA") return { error: "already_accepted" };
  if (proposta.status === "RECUSADA" || proposta.status === "EXPIRADA") return { error: "expired" };
  if (proposta.validade && proposta.validade < new Date()) return { error: "expired" };

  const email = proposta.contato_email || proposta.cliente?.email || null;
  if (!email) return { error: "Nenhum e-mail cadastrado para envio do código. Entre em contato com a empresa." };

  const codigo = String(Math.floor(1000 + Math.random() * 9000));
  const expira_em = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.aceiteOtp.deleteMany({ where: { proposta_id: proposta.id } });
  await prisma.aceiteOtp.create({ data: { proposta_id: proposta.id, codigo, email, expira_em } });

  await enviarOtpAceite(email, codigo, proposta.titulo);

  const [user, domain] = email.split("@");
  const emailMasked = `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;

  return { ok: true as const, email_masked: emailMasked };
}

export async function confirmarOtpAceite(token: string, codigo: string) {
  const proposta = await prisma.proposta.findUnique({
    where: { token_aceite: token },
    include: { aceite_otps: { orderBy: { criado_em: "desc" }, take: 1 } },
  });

  if (!proposta) return { error: "Proposta não encontrada." };
  if (proposta.status === "ACEITA") return { error: "already_accepted" };

  const otp = proposta.aceite_otps[0];
  if (!otp) return { error: "Código não solicitado. Clique em Aceitar para receber um novo código." };
  if (otp.expira_em < new Date()) return { error: "Código expirado. Clique em Reenviar para um novo código." };
  if (otp.tentativas >= 5) return { error: "Muitas tentativas inválidas. Clique em Reenviar para um novo código." };

  if (otp.codigo !== codigo) {
    await prisma.aceiteOtp.update({ where: { id: otp.id }, data: { tentativas: { increment: 1 } } });
    return { error: "Código inválido. Verifique e tente novamente." };
  }

  await prisma.aceiteOtp.deleteMany({ where: { proposta_id: proposta.id } });
  return aceitarPropostaPublica(token);
}
