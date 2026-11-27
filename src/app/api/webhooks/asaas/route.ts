import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AsaasApiError, asaasGetCustomer, asaasGetPayment, idCheckoutAsaasValido, idCobrancaAsaasValido, obterChaveAsaas } from "@/lib/asaas";
import { importarParcelamentoCheckoutAsaas, importarRecebivelAsaas, importarRecebiveisCheckoutAsaas, localizarVendaConselhoAgro, pagamentoAsaasConfirmado } from "@/lib/asaas-recebiveis";

// Eventos Asaas que nos interessam
// Docs: https://docs.asaas.com/reference/webhooks
const PAYMENT_RECEIVED   = "PAYMENT_RECEIVED";
const PAYMENT_CONFIRMED  = "PAYMENT_CONFIRMED";
const PAYMENT_OVERDUE    = "PAYMENT_OVERDUE";
const PAYMENT_DELETED    = "PAYMENT_DELETED";
const PAYMENT_REFUNDED   = "PAYMENT_REFUNDED";
const PAYMENT_CHARGEBACK = "PAYMENT_CHARGEBACK_DISPUTE";

const SUBSCRIPTION_CREATED   = "SUBSCRIPTION_CREATED";
const SUBSCRIPTION_UPDATED   = "SUBSCRIPTION_UPDATED";
const SUBSCRIPTION_DELETED   = "SUBSCRIPTION_DELETED";
const SUBSCRIPTION_OVERDUE   = "SUBSCRIPTION_OVERDUE";
const SUBSCRIPTION_REACTIVATED = "SUBSCRIPTION_REACTIVATED";

export async function POST(req: Request) {
  // Validação do token Asaas (configurado no painel Asaas → Integrações → Webhooks)
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (token) {
    const incoming = req.headers.get("asaas-access-token");
    if (!incoming || incoming !== token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const event   = String(body.event ?? "");
  const payment = body.payment as Record<string, unknown> | undefined;
  const subscription = body.subscription as Record<string, unknown> | undefined;

  console.log(`[asaas-webhook] evento: ${event}`);

  if (token && event === "CHECKOUT_PAID") {
    const checkout = body.checkout as Record<string, unknown> | undefined;
    const id = checkout?.id;
    const empresaId = process.env.CONSELHO_AGRO_EMPRESA_ID;
    if (empresaId && typeof id === "string" && idCheckoutAsaasValido(id)) {
      const apiKey = await obterChaveAsaas(empresaId);
      const resultado = await importarRecebiveisCheckoutAsaas(id.toLowerCase(), empresaId, apiKey);
      revalidatePath("/financeiro/recebiveis");
      revalidatePath("/financeiro/fluxo-caixa");
      console.info(`[asaas-webhook] checkout ${id}:`, resultado);
    }
  }

  // ── EVENTOS DE PAGAMENTO ────────────────────────────────────────────────────

  if (payment && [PAYMENT_RECEIVED, PAYMENT_CONFIRMED].includes(event)) {
    await handlePaymentReceived(payment, event, Boolean(token));
  }

  if (payment && event === PAYMENT_OVERDUE) {
    await handlePaymentOverdue(payment);
  }

  if (payment && [PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_CHARGEBACK].includes(event)) {
    await handlePaymentCancelled(payment, event);
  }

  // ── EVENTOS DE ASSINATURA ───────────────────────────────────────────────────

  if (subscription && [SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_REACTIVATED].includes(event)) {
    await handleSubscriptionUpdated(subscription, event);
  }

  if (subscription && event === SUBSCRIPTION_DELETED) {
    await handleSubscriptionCancelled(subscription);
  }

  if (subscription && event === SUBSCRIPTION_OVERDUE) {
    await handleSubscriptionOverdue(subscription);
  }

  return NextResponse.json({ ok: true });
}

// ─── HANDLERS DE PAGAMENTO ────────────────────────────────────────────────────

async function handlePaymentReceived(payment: Record<string, unknown>, event: string, autenticado: boolean) {
  const asaasId = String(payment.id ?? "");
  if (!idCobrancaAsaasValido(asaasId)) return;
  const valor   = Number(payment.value ?? 0);
  const netValue = Number(payment.netValue ?? valor);
  const dataAsaas = payment.paymentDate ?? payment.clientPaymentDate ?? payment.confirmedDate;
  const dataPagamento = typeof dataAsaas === "string"
    ? new Date(`${dataAsaas.slice(0, 10)}T12:00:00Z`)
    : undefined;

  // Busca recebível pelo asaas_payment_id
  const recebivel = await prisma.recebivel.findFirst({
    where: { asaas_payment_id: asaasId },
  });

  if (recebivel) {
    await prisma.recebivel.updateMany({
      where: {
        id: recebivel.id,
        ...(event === PAYMENT_CONFIRMED ? {
          OR: [{ asaas_status: null }, { asaas_status: { not: "RECEIVED" } }],
        } : {}),
      },
      data: {
        status: "PAGO",
        data_pagamento: dataPagamento ?? recebivel.data_pagamento ?? new Date(),
        valor_pago: netValue,
        asaas_status: event === PAYMENT_CONFIRMED ? "CONFIRMED" : "RECEIVED",
      },
    });
    revalidatePath("/financeiro/recebiveis");
    revalidatePath("/financeiro/fluxo-caixa");
    console.log(`[asaas-webhook] recebível ${recebivel.id} marcado como PAGO`);
    return;
  }

  // Boleto?
  const boleto = await prisma.boleto.findFirst({ where: { asaas_id: asaasId } });
  if (boleto) {
    await prisma.boleto.update({ where: { id: boleto.id }, data: { status: "PAGO" } });
    await prisma.recebivel.update({
      where: { id: boleto.recebivel_id },
      data: { status: "PAGO", data_pagamento: dataPagamento ?? new Date(), valor_pago: netValue },
    });
    revalidatePath("/financeiro/recebiveis");
    console.log(`[asaas-webhook] boleto ${boleto.id} marcado como PAGO`);
    return;
  }

  const empresaId = process.env.CONSELHO_AGRO_EMPRESA_ID;
  const referencia = typeof payment.externalReference === "string" && payment.externalReference.includes("@");
  if (!autenticado || !empresaId || (!referencia && !payment.subscription && !payment.checkoutSession)) {
    console.info(`[asaas-webhook] cobrança sem vínculo local: ${asaasId}`);
    return;
  }

  const apiKey = await obterChaveAsaas(empresaId);
  // Confirma que a cobrança pertence à conta configurada para o Conselho Agro.
  const cobranca = await asaasGetPayment(asaasId, apiKey).catch((err: unknown) => {
    if (!(err instanceof AsaasApiError && err.status === 404)) throw err;
    console.info(`[asaas-webhook] cobrança fora da conta do Conselho Agro: ${asaasId}`);
    return null;
  });
  if (!cobranca || !pagamentoAsaasConfirmado(cobranca)) return;
  if (cobranca.checkoutSession && cobranca.installment) {
    const resultado = await importarParcelamentoCheckoutAsaas(cobranca, empresaId, apiKey);
    revalidatePath("/financeiro/recebiveis");
    revalidatePath("/financeiro/fluxo-de-caixa");
    console.info(`[asaas-webhook] parcelamento ${cobranca.installment}:`, resultado);
    return;
  }
  const conselho = await localizarVendaConselhoAgro(cobranca, empresaId, apiKey);
  if (!conselho && !cobranca.checkoutSession) {
    console.info(`[asaas-webhook] cobrança sem referência do Conselho Agro: ${asaasId}`);
    return;
  }
  const resultado = await importarRecebivelAsaas(cobranca, empresaId, apiKey, conselho ?? undefined);
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/financeiro/fluxo-caixa");
  console.info(`[asaas-webhook] cobrança ${asaasId}: ${resultado}`);
}

async function handlePaymentOverdue(payment: Record<string, unknown>) {
  const asaasId = String(payment.id ?? "");

  await prisma.recebivel.updateMany({
    where: { asaas_payment_id: asaasId, status: "PENDENTE" },
    data: { status: "VENCIDO", asaas_status: "OVERDUE" },
  });

  await prisma.boleto.updateMany({
    where: { asaas_id: asaasId },
    data: { status: "VENCIDO" },
  });

  revalidatePath("/financeiro/recebiveis");
}

async function handlePaymentCancelled(payment: Record<string, unknown>, event: string) {
  const asaasId = String(payment.id ?? "");
  const novoStatus = event === PAYMENT_REFUNDED ? "CANCELADO" : "CANCELADO";

  await prisma.recebivel.updateMany({
    where: { asaas_payment_id: asaasId },
    data: { status: novoStatus, asaas_status: event },
  });

  await prisma.boleto.updateMany({
    where: { asaas_id: asaasId },
    data: { status: "CANCELADO" },
  });

  revalidatePath("/financeiro/recebiveis");
}

// ─── HANDLERS DE ASSINATURA ───────────────────────────────────────────────────

async function handleSubscriptionUpdated(sub: Record<string, unknown>, event: string) {
  const asaasSubId = String(sub.id ?? "");
  const nextDueDate = sub.nextDueDate ? new Date(String(sub.nextDueDate)) : null;
  const novoStatus = event === SUBSCRIPTION_REACTIVATED ? "ATIVA" : "ATIVA";

  await prisma.assinatura.updateMany({
    where: { asaas_subscription_id: asaasSubId },
    data: {
      status: novoStatus,
      ...(nextDueDate ? { proximo_vencimento: nextDueDate } : {}),
    },
  });

  // Se o Asaas criou a assinatura via link de pagamento e ela ainda não existe localmente
  if (event === SUBSCRIPTION_CREATED) {
    const existente = await prisma.assinatura.findFirst({
      where: { asaas_subscription_id: asaasSubId },
    });
    if (!existente) {
      // Tenta localizar a empresa pelo externalReference ou customer
      const externalRef = String(sub.externalReference ?? "");
      // externalRef esperado: "empresa:{empresaId}:canal:{CANAL}:plano:{PLANO}"
      const match = externalRef.match(/empresa:([^:]+):canal:([^:]+):plano:([^:]+)/);
      if (match) {
        const [, empresaId, canal, plano] = match;
        const asaasCustomerId = String(sub.customer ?? "");

        // Busca dados do cliente no Asaas para criar/vincular no MentoraSys
        let nomeCliente = asaasCustomerId;
        let clienteId: string | null = null;
        try {
          const apiKey = await obterChaveAsaas(empresaId);
          const customer = await asaasGetCustomer(asaasCustomerId, apiKey);
          nomeCliente = customer.name;

          // Verifica se já existe cliente com este asaas_id
          let cliente = await prisma.cliente.findFirst({
            where: { empresa_id: empresaId, asaas_id: asaasCustomerId },
          });

          if (!cliente && customer.email) {
            cliente = await prisma.cliente.findFirst({
              where: { empresa_id: empresaId, email: customer.email },
            });
          }
          if (!cliente && customer.cpfCnpj) {
            cliente = await prisma.cliente.findFirst({
              where: { empresa_id: empresaId, cpf_cnpj: customer.cpfCnpj },
            });
          }

          if (!cliente) {
            cliente = await prisma.cliente.create({
              data: {
                empresa_id: empresaId,
                nome: customer.name,
                tipo: "PESSOA_FISICA",
                email: customer.email ?? null,
                cpf_cnpj: customer.cpfCnpj ?? null,
                asaas_id: asaasCustomerId,
              },
            });
            console.log(`[asaas-webhook] cliente criado: ${cliente.id}`);
          } else if (!cliente.asaas_id) {
            await prisma.cliente.update({
              where: { id: cliente.id },
              data: { asaas_id: asaasCustomerId },
            });
          }
          clienteId = cliente.id;
        } catch (err) {
          console.error("[asaas-webhook] erro ao sincronizar cliente:", err);
        }

        const servico = await prisma.servico.findFirst({
          where: { empresa_id: empresaId, canal, plano },
        });
        await prisma.assinatura.create({
          data: {
            empresa_id: empresaId,
            canal,
            plano,
            servico_id: servico?.id ?? null,
            cliente_id: clienteId,
            nome_cliente: nomeCliente,
            asaas_subscription_id: asaasSubId,
            asaas_customer_id: asaasCustomerId,
            valor: Number(sub.value ?? 0),
            ciclo: String(sub.cycle ?? "MONTHLY"),
            status: "ATIVA",
            proximo_vencimento: nextDueDate,
          },
        });
        console.log(`[asaas-webhook] assinatura ${asaasSubId} criada automaticamente`);
      }
    }
  }

  revalidatePath("/financeiro/assinaturas");
}

async function handleSubscriptionCancelled(sub: Record<string, unknown>) {
  const asaasSubId = String(sub.id ?? "");
  await prisma.assinatura.updateMany({
    where: { asaas_subscription_id: asaasSubId },
    data: { status: "CANCELADA", data_cancelamento: new Date() },
  });
  revalidatePath("/financeiro/assinaturas");
}

async function handleSubscriptionOverdue(sub: Record<string, unknown>) {
  const asaasSubId = String(sub.id ?? "");
  await prisma.assinatura.updateMany({
    where: { asaas_subscription_id: asaasSubId },
    data: { status: "INADIMPLENTE" },
  });
  revalidatePath("/financeiro/assinaturas");
}
