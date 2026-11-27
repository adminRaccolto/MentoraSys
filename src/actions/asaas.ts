"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import {
  asaasGetOrCreateCustomer,
  asaasCreateBoletoPix,
  asaasCancelPayment,
  asaasGetPayment,
  asaasCreateSubscription,
  asaasCancelSubscription,
  asaasGetSubscription,
  asaasUpdateSubscription,
  asaasCreatePaymentLink,
  asaasListPayments,
  idCheckoutAsaasValido,
  idCobrancaAsaasValido,
  obterChaveAsaas,
} from "@/lib/asaas";
import { importarParcelamentoCheckoutAsaas, importarRecebivelAsaas, importarRecebiveisCheckoutAsaas, localizarVendaConselhoAgro, pagamentoAsaasConfirmado, registrarVendaAsaasNoCrm } from "@/lib/asaas-recebiveis";

// ─── COBRANÇAS (Recebíveis) ───────────────────────────────────────────────────

export async function gerarCobrancaAsaas(recebivelId: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({
    where: { id: recebivelId, empresa_id: empresaId },
    include: { cliente: true },
  });
  if (!recebivel) throw new Error("Recebível não encontrado.");
  if (recebivel.asaas_payment_id) throw new Error("Cobrança já gerada no Asaas.");
  if (!recebivel.cliente) throw new Error("Recebível sem cliente vinculado.");

  const apiKey = await obterChaveAsaas(empresaId);

  let asaasCustomerId = recebivel.cliente.asaas_id;
  if (!asaasCustomerId) {
    const customer = await asaasGetOrCreateCustomer(
      recebivel.cliente.nome,
      recebivel.cliente.cpf_cnpj ?? undefined,
      recebivel.cliente.email ?? undefined,
      apiKey,
    );
    asaasCustomerId = customer.id;
    await prisma.cliente.update({
      where: { id: recebivel.cliente.id },
      data: { asaas_id: customer.id },
    });
  }

  const vencimento = recebivel.data_vencimento.toISOString().split("T")[0];
  const payment = await asaasCreateBoletoPix({
    customerId: asaasCustomerId,
    valor: Number(recebivel.valor),
    vencimento,
    descricao: recebivel.descricao,
    externalRef: recebivel.id,
  }, apiKey);

  await prisma.recebivel.update({
    where: { id: recebivelId },
    data: {
      asaas_payment_id:     payment.id,
      asaas_invoice_url:    payment.invoiceUrl ?? null,
      asaas_boleto_url:     payment.bankSlipUrl ?? null,
      asaas_pix_copia_cola: payment.pixQrCode?.payload ?? null,
      asaas_status:         payment.status,
    },
  });

  await registrar({ recurso: "financeiro", acao: "gerar_cobranca_asaas", registroId: recebivelId });
  revalidatePath("/financeiro/recebiveis");
  return { ok: true, payment_id: payment.id, invoice_url: payment.invoiceUrl };
}

export async function cancelarCobrancaAsaas(recebivelId: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({
    where: { id: recebivelId, empresa_id: empresaId },
  });
  if (!recebivel) throw new Error("Recebível não encontrado.");
  if (!recebivel.asaas_payment_id) throw new Error("Nenhuma cobrança Asaas para este recebível.");

  const apiKey = await obterChaveAsaas(empresaId);
  await asaasCancelPayment(recebivel.asaas_payment_id, apiKey);

  await prisma.recebivel.update({
    where: { id: recebivelId },
    data: { asaas_status: "CANCELLED", asaas_payment_id: null, asaas_invoice_url: null, asaas_boleto_url: null, asaas_pix_copia_cola: null },
  });

  revalidatePath("/financeiro/recebiveis");
  return { ok: true };
}

export async function sincronizarCobrancaAsaas(recebivelId: string) {
  await verificarPermissao("financeiro", "visualizar");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({
    where: { id: recebivelId, empresa_id: empresaId },
  });
  if (!recebivel?.asaas_payment_id) throw new Error("Sem cobrança Asaas vinculada.");

  const apiKey = await obterChaveAsaas(empresaId);
  const payment = await asaasGetPayment(recebivel.asaas_payment_id, apiKey);

  const statusMap: Record<string, string> = {
    PENDING:   "PENDENTE",
    RECEIVED:  "PAGO",
    CONFIRMED: "PAGO",
    OVERDUE:   "VENCIDO",
    REFUNDED:  "CANCELADO",
    CANCELLED: "CANCELADO",
  };

  await prisma.recebivel.update({
    where: { id: recebivelId },
    data: {
      asaas_status: payment.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: (statusMap[payment.status] ?? recebivel.status) as any,
      ...(["RECEIVED", "CONFIRMED"].includes(payment.status) && !recebivel.data_pagamento
        ? { data_pagamento: new Date(), valor_pago: payment.value }
        : {}),
    },
  });

  revalidatePath("/financeiro/recebiveis");
  return { ok: true, status: payment.status };
}

// ─── SYNC RETROATIVO: Asaas → CR (O Conselho Agro) ──────────────────────────

export async function sincronizarReceiveisConselhoAgro(): Promise<{
  criados: number; atualizados: number; ignorados: number; erros: string[]; debug: string[];
}> {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const apiKey = await obterChaveAsaas(empresaId);
  let criados = 0, atualizados = 0, ignorados = 0;
  const erros: string[] = [];
  const debug: string[] = [];
  const referencias = new Map<string, string>();
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const { data: pagamentos, hasMore } = await asaasListPayments({ offset, limit }, apiKey);
    for (const pagamento of pagamentos) {
      try {
        const conselho = await localizarVendaConselhoAgro(pagamento, empresaId, apiKey, referencias);
        if (!conselho) {
          ignorados++;
          if (debug.length < 20) debug.push(`Sem referência do Conselho Agro: ${pagamento.id}`);
          continue;
        }
        const venda = await registrarVendaAsaasNoCrm(pagamento, empresaId, apiKey, conselho);
        const resultado = await importarRecebivelAsaas(pagamento, empresaId, apiKey, conselho, venda?.clienteId);
        if (resultado === "criado") criados++;
        else if (resultado === "atualizado") atualizados++;
        else ignorados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`${pagamento.id}: ${msg}`);
      }
    }
    if (!hasMore || pagamentos.length === 0) break;
  }

  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/financeiro/fluxo-caixa");
  revalidatePath("/crm");
  revalidatePath("/clientes");
  return { criados, atualizados, ignorados, erros, debug };
}

export async function importarCobrancaAsaas(id: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();
  const pagamentoId = typeof id === "string" ? id.trim() : "";
  const checkout = idCheckoutAsaasValido(pagamentoId);
  if (!checkout && !idCobrancaAsaasValido(pagamentoId)) {
    return { erro: "Informe o ID da cobrança (pay_...) ou da sessão de checkout." };
  }

  try {
    const ehEmpresaConselho = empresaId === process.env.CONSELHO_AGRO_EMPRESA_ID;
    const apiKey = await obterChaveAsaas(empresaId, ehEmpresaConselho);
    if (checkout) {
      const info = await importarRecebiveisCheckoutAsaas(pagamentoId.toLowerCase(), empresaId, apiKey);
      if (!info.confirmados) {
        return { erro: info.encontradas
          ? "O Asaas ainda não confirmou o pagamento desse checkout."
          : "Nenhuma cobrança vinculada a esse checkout foi encontrada na conta Asaas desta empresa." };
      }
      revalidatePath("/financeiro/recebiveis");
      revalidatePath("/financeiro/fluxo-de-caixa");
      revalidatePath("/crm");
      revalidatePath("/clientes");
      return { checkout: info };
    }
    const pagamento = await asaasGetPayment(pagamentoId, apiKey);
    if (pagamento.checkoutSession && pagamentoAsaasConfirmado(pagamento)) {
      const info = await importarParcelamentoCheckoutAsaas(pagamento, empresaId, apiKey);
      revalidatePath("/financeiro/recebiveis");
      revalidatePath("/financeiro/fluxo-de-caixa");
      revalidatePath("/crm");
      revalidatePath("/clientes");
      return { checkout: info };
    }
    const conselho = ehEmpresaConselho
      ? await localizarVendaConselhoAgro(pagamento, empresaId, apiKey)
      : null;
    const venda = await registrarVendaAsaasNoCrm(pagamento, empresaId, apiKey, conselho ?? undefined);
    const resultado = await importarRecebivelAsaas(pagamento, empresaId, apiKey, conselho ?? undefined, venda?.clienteId);
    revalidatePath("/financeiro/recebiveis");
    revalidatePath("/financeiro/fluxo-de-caixa");
    revalidatePath("/crm");
    revalidatePath("/clientes");
    return { resultado };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao importar cobrança do Asaas." };
  }
}

// ─── LINKS DE PAGAMENTO (produto fixo) ───────────────────────────────────────

export async function gerarLinkPagamentoProduto(servicoId: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, empresa_id: empresaId },
  });
  if (!servico) throw new Error("Serviço não encontrado.");

  const apiKey = await obterChaveAsaas(empresaId);
  const link = await asaasCreatePaymentLink({
    name: servico.nome,
    value: servico.valor_base ? Number(servico.valor_base) : undefined,
    billingType: "UNDEFINED",
    chargeType: servico.tipo_cobranca === "ASSINATURA" ? "RECURRENT" : "DETACHED",
    subscriptionCycle: servico.tipo_cobranca === "ASSINATURA" ? "MONTHLY" : undefined,
    description: servico.descricao ?? undefined,
  }, apiKey);

  await prisma.servico.update({
    where: { id: servicoId },
    data: { asaas_link_pagamento: link.url },
  });

  revalidatePath("/configuracoes");
  return { ok: true, url: link.url };
}

// ─── ASSINATURAS ──────────────────────────────────────────────────────────────

const schemaAssinatura = z.object({
  nome_cliente:     z.string().min(1),
  email_cliente:    z.string().email().optional().or(z.literal("")),
  telefone_cliente: z.string().optional(),
  cliente_id:       z.string().optional(),
  servico_id:       z.string().optional(),
  canal:            z.string().min(1),
  plano:            z.string().optional(),
  valor:            z.coerce.number().positive(),
  ciclo:            z.enum(["MONTHLY", "YEARLY", "WEEKLY"]).default("MONTHLY"),
  proximo_vencimento: z.string().min(1),
  observacoes:      z.string().optional(),
});

type InputAssinatura = z.input<typeof schemaAssinatura>;

export async function criarAssinatura(input: InputAssinatura) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaAssinatura.parse(input);

  const apiKey = await obterChaveAsaas(empresaId);

  let asaasCustomerId: string | null = null;
  if (data.cliente_id) {
    const cliente = await prisma.cliente.findFirst({ where: { id: data.cliente_id, empresa_id: empresaId } });
    if (cliente) {
      asaasCustomerId = cliente.asaas_id;
      if (!asaasCustomerId) {
        const customer = await asaasGetOrCreateCustomer(
          cliente.nome,
          cliente.cpf_cnpj ?? undefined,
          cliente.email ?? undefined,
          apiKey,
        );
        asaasCustomerId = customer.id;
        await prisma.cliente.update({ where: { id: cliente.id }, data: { asaas_id: customer.id } });
      }
    }
  }

  let asaasSubscriptionId: string | null = null;
  if (asaasCustomerId) {
    const sub = await asaasCreateSubscription({
      customerId: asaasCustomerId,
      billingType: "BOLETO",
      cycle: data.ciclo,
      valor: data.valor,
      proximoVencimento: data.proximo_vencimento,
      descricao: `${data.canal} — ${data.plano ?? "Assinatura"}`,
      externalRef: `empresa:${empresaId}:canal:${data.canal}:plano:${data.plano ?? ""}`,
    }, apiKey);
    asaasSubscriptionId = sub.id;
  }

  const assinatura = await prisma.assinatura.create({
    data: {
      empresa_id:           empresaId,
      cliente_id:           data.cliente_id || null,
      servico_id:           data.servico_id || null,
      nome_cliente:         data.nome_cliente,
      email_cliente:        data.email_cliente || null,
      telefone_cliente:     data.telefone_cliente || null,
      canal:                data.canal,
      plano:                data.plano || null,
      valor:                data.valor,
      ciclo:                data.ciclo,
      status:               "ATIVA",
      asaas_subscription_id: asaasSubscriptionId,
      asaas_customer_id:    asaasCustomerId,
      proximo_vencimento:   new Date(`${data.proximo_vencimento}T12:00:00`),
      observacoes:          data.observacoes || null,
    },
  });

  await registrar({ recurso: "financeiro", acao: "criar_assinatura", registroId: assinatura.id });
  revalidatePath("/financeiro/assinaturas");
  return assinatura;
}

export async function cancelarAssinatura(id: string, motivo?: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const assinatura = await prisma.assinatura.findFirst({ where: { id, empresa_id: empresaId } });
  if (!assinatura) throw new Error("Assinatura não encontrada.");

  const apiKey = await obterChaveAsaas(empresaId);
  if (assinatura.asaas_subscription_id) {
    await asaasCancelSubscription(assinatura.asaas_subscription_id, apiKey);
  }

  await prisma.assinatura.update({
    where: { id },
    data: { status: "CANCELADA", data_cancelamento: new Date(), motivo_cancelamento: motivo ?? null },
  });

  revalidatePath("/financeiro/assinaturas");
  return { ok: true };
}

export async function sincronizarAssinatura(id: string) {
  await verificarPermissao("financeiro", "visualizar");
  const empresaId = await obterEmpresaAtiva();

  const assinatura = await prisma.assinatura.findFirst({ where: { id, empresa_id: empresaId } });
  if (!assinatura?.asaas_subscription_id) throw new Error("Sem assinatura Asaas vinculada.");

  const apiKey = await obterChaveAsaas(empresaId);
  const sub = await asaasGetSubscription(assinatura.asaas_subscription_id, apiKey);

  const statusMap: Record<string, string> = {
    ACTIVE:    "ATIVA",
    INACTIVE:  "PAUSADA",
    CANCELLED: "CANCELADA",
    OVERDUE:   "INADIMPLENTE",
  };

  await prisma.assinatura.update({
    where: { id },
    data: {
      status:              statusMap[sub.status] ?? assinatura.status,
      proximo_vencimento:  sub.nextDueDate ? new Date(sub.nextDueDate) : assinatura.proximo_vencimento,
    },
  });

  revalidatePath("/financeiro/assinaturas");
  return { ok: true, status: sub.status };
}

export async function pausarAssinatura(id: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const assinatura = await prisma.assinatura.findFirst({ where: { id, empresa_id: empresaId } });
  if (!assinatura) throw new Error("Assinatura não encontrada.");

  const apiKey = await obterChaveAsaas(empresaId);
  if (assinatura.asaas_subscription_id) {
    await asaasUpdateSubscription(assinatura.asaas_subscription_id, { status: "INACTIVE" }, apiKey);
  }

  await prisma.assinatura.update({ where: { id }, data: { status: "PAUSADA" } });
  revalidatePath("/financeiro/assinaturas");
  return { ok: true };
}

// ─── VENDA DIRETA DO CRM ─────────────────────────────────────────────────────

const schemaVendaLead = z.object({
  canal:               z.string().min(1),
  plano:               z.string().min(1),
  valor:               z.coerce.number().positive(),
  ciclo:               z.enum(["MONTHLY", "YEARLY", "WEEKLY"]).default("MONTHLY"),
  proximo_vencimento:  z.string().min(1),
  servico_id:          z.string().optional(),
});

export async function venderAssinaturaDoLead(
  leadId: string,
  input: z.input<typeof schemaVendaLead>,
) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaVendaLead.parse(input);

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, empresa_id: empresaId },
    include: { cliente: true },
  });
  if (!lead) throw new Error("Lead não encontrado.");

  // Cria Cliente se não existir
  let clienteId = lead.cliente_id;
  if (!clienteId) {
    const novoCliente = await prisma.cliente.create({
      data: {
        empresa_id: empresaId,
        nome: lead.empresa_nome || lead.nome,
        tipo: "PESSOA_JURIDICA",
        email: lead.email ?? null,
        telefone: lead.telefone ?? null,
        whatsapp: lead.whatsapp ?? null,
      },
    });
    clienteId = novoCliente.id;
    await prisma.lead.update({ where: { id: leadId }, data: { cliente_id: clienteId } });
  }

  const apiKey = await obterChaveAsaas(empresaId);

  let asaasCustomerId: string | null = lead.cliente?.asaas_id ?? null;
  if (!asaasCustomerId && (lead.email || lead.cliente?.cpf_cnpj)) {
    try {
      const customer = await asaasGetOrCreateCustomer(
        lead.empresa_nome || lead.nome,
        lead.cliente?.cpf_cnpj ?? undefined,
        lead.email ?? undefined,
        apiKey,
      );
      asaasCustomerId = customer.id;
      await prisma.cliente.update({ where: { id: clienteId }, data: { asaas_id: customer.id } });
    } catch (err) {
      console.error("[venderAssinaturaDoLead] erro Asaas customer:", err);
    }
  }

  // Cria assinatura Asaas
  let asaasSubscriptionId: string | null = null;
  if (asaasCustomerId) {
    try {
      const sub = await asaasCreateSubscription({
        customerId: asaasCustomerId,
        billingType: "BOLETO",
        cycle: data.ciclo,
        valor: data.valor,
        proximoVencimento: data.proximo_vencimento,
        descricao: `${data.canal} — ${data.plano}`,
        externalRef: `empresa:${empresaId}:canal:${data.canal}:plano:${data.plano}`,
      }, apiKey);
      asaasSubscriptionId = sub.id;
    } catch (err) {
      console.error("[venderAssinaturaDoLead] erro Asaas subscription:", err);
    }
  }

  // Cria Assinatura local
  const assinatura = await prisma.assinatura.create({
    data: {
      empresa_id:            empresaId,
      cliente_id:            clienteId,
      servico_id:            data.servico_id || null,
      nome_cliente:          lead.empresa_nome || lead.nome,
      email_cliente:         lead.email ?? null,
      telefone_cliente:      lead.telefone ?? null,
      canal:                 data.canal,
      plano:                 data.plano,
      valor:                 data.valor,
      ciclo:                 data.ciclo,
      status:                "ATIVA",
      asaas_subscription_id: asaasSubscriptionId,
      asaas_customer_id:     asaasCustomerId,
      proximo_vencimento:    new Date(`${data.proximo_vencimento}T12:00:00`),
    },
  });

  // Move lead para GANHO
  const etapaGanho = await prisma.etapaCrm.findFirst({
    where: { empresa_id: empresaId, chave: "GANHO" },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      etapa_chave: "GANHO",
      etapa_id:    etapaGanho?.id ?? lead.etapa_id,
    },
  });

  await registrar({ recurso: "financeiro", acao: "criar_assinatura", registroId: assinatura.id, detalhes: { origem: "crm_lead", leadId } });
  revalidatePath("/crm");
  revalidatePath("/financeiro/assinaturas");
  return { ok: true, assinaturaId: assinatura.id };
}
