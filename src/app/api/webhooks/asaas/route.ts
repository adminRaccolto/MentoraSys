import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  // ── EVENTOS DE PAGAMENTO ────────────────────────────────────────────────────

  if (payment && [PAYMENT_RECEIVED, PAYMENT_CONFIRMED].includes(event)) {
    await handlePaymentReceived(payment);
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

async function handlePaymentReceived(payment: Record<string, unknown>) {
  const asaasId = String(payment.id ?? "");
  const valor   = Number(payment.value ?? 0);
  const netValue = Number(payment.netValue ?? valor);
  const dataPagamento = payment.paymentDate
    ? new Date(String(payment.paymentDate))
    : new Date();

  // Busca recebível pelo asaas_payment_id
  const recebivel = await prisma.recebivel.findFirst({
    where: { asaas_payment_id: asaasId },
  });

  if (recebivel) {
    await prisma.recebivel.update({
      where: { id: recebivel.id },
      data: {
        status: "PAGO",
        data_pagamento: dataPagamento,
        valor_pago: netValue,
        asaas_status: "RECEIVED",
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
      data: { status: "PAGO", data_pagamento: dataPagamento, valor_pago: netValue },
    });
    revalidatePath("/financeiro/recebiveis");
    console.log(`[asaas-webhook] boleto ${boleto.id} marcado como PAGO`);
  }
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
        const servico = await prisma.servico.findFirst({
          where: { empresa_id: empresaId, canal, plano },
        });
        await prisma.assinatura.create({
          data: {
            empresa_id: empresaId,
            canal,
            plano,
            servico_id: servico?.id ?? null,
            nome_cliente: String(sub.customer ?? ""),
            asaas_subscription_id: asaasSubId,
            asaas_customer_id: String(sub.customer ?? ""),
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
