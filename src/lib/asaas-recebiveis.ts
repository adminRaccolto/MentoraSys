import {
  AsaasApiError,
  asaasGetCustomer,
  asaasGetSubscription,
  asaasListPayments,
  type AsaasPaymentFull,
} from "@/lib/asaas";
import type { StatusRecebivel } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

const statusRecebivel: Partial<Record<string, StatusRecebivel>> = {
  PENDING: "PENDENTE",
  AWAITING_RISK_ANALYSIS: "PENDENTE",
  APPROVED_BY_RISK_ANALYSIS: "PENDENTE",
  CONFIRMED: "PAGO",
  RECEIVED: "PAGO",
  RECEIVED_IN_CASH: "PAGO",
  PARTIALLY_REFUNDED: "PAGO",
  OVERDUE: "VENCIDO",
  REFUNDED: "CANCELADO",
  CANCELLED: "CANCELADO",
};

export type ResultadoImportacaoAsaas = "criado" | "atualizado" | "ignorado";

export function pagamentoAsaasConfirmado(pagamento: AsaasPaymentFull): boolean {
  return !pagamento.deleted && statusRecebivel[pagamento.status] === "PAGO";
}

export async function importarRecebiveisCheckoutAsaas(
  checkoutSession: string,
  empresaId: string,
  apiKey: string,
) {
  const pagamentos = new Map<string, AsaasPaymentFull>();
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, hasMore } = await asaasListPayments({ checkoutSession, limit, offset }, apiKey);
    for (const pagamento of data) {
      if (pagamento.checkoutSession === checkoutSession) pagamentos.set(pagamento.id, pagamento);
    }
    if (!hasMore || data.length === 0) break;
  }

  const parcelas = new Map<string, number>();
  for (const pagamento of pagamentos.values()) {
    if (pagamento.installment) {
      parcelas.set(pagamento.installment, (parcelas.get(pagamento.installment) ?? 0) + 1);
    }
  }
  let confirmados = 0, criados = 0, atualizados = 0;
  const referencias = new Map<string, string>();
  for (const pagamento of pagamentos.values()) {
    if (!pagamentoAsaasConfirmado(pagamento)) continue;
    confirmados++;
    const conselho = empresaId === process.env.CONSELHO_AGRO_EMPRESA_ID
      ? await localizarVendaConselhoAgro(pagamento, empresaId, apiKey, referencias)
      : null;
    const cobranca = {
      ...pagamento,
      installmentCount: pagamento.installmentCount ??
        (pagamento.installment ? parcelas.get(pagamento.installment) : undefined),
    };
    const resultado = await importarRecebivelAsaas(cobranca, empresaId, apiKey, conselho ?? undefined);
    if (resultado === "criado") criados++;
    if (resultado === "atualizado") atualizados++;
  }
  return { encontradas: pagamentos.size, confirmados, criados, atualizados };
}

export async function localizarVendaConselhoAgro(
  pagamento: AsaasPaymentFull,
  empresaId: string,
  apiKey: string,
  referencias = new Map<string, string>(),
) {
  const assinatura = pagamento.subscription
    ? await prisma.assinatura.findFirst({
        where: {
          empresa_id: empresaId,
          canal: "CONSELHO_AGRO",
          asaas_subscription_id: pagamento.subscription,
        },
        select: { cliente_id: true, email_cliente: true },
      })
    : null;

  let email = pagamento.externalReference?.trim();
  if (!email?.includes("@") && assinatura?.email_cliente) email = assinatura.email_cliente;
  if (!email?.includes("@") && !assinatura && pagamento.subscription) {
    let referencia = referencias.get(pagamento.subscription);
    if (referencia === undefined) {
      try {
        const sub = await asaasGetSubscription(pagamento.subscription, apiKey);
        referencia = sub.externalReference?.trim() ?? "";
      } catch (err) {
        if (!(err instanceof AsaasApiError && err.status === 404)) throw err;
        referencia = "";
      }
      referencias.set(pagamento.subscription, referencia);
    }
    email = referencia;
  }

  if (!assinatura && !email?.includes("@")) return null;
  return { clienteId: assinatura?.cliente_id, email: email?.includes("@") ? email : undefined };
}

export async function importarRecebivelAsaas(
  pagamento: AsaasPaymentFull,
  empresaId: string,
  apiKey: string,
  conselho?: { clienteId?: string | null; email?: string },
): Promise<ResultadoImportacaoAsaas> {
  const status = pagamento.deleted ? "CANCELADO" : statusRecebivel[pagamento.status];
  const dataAsaas = pagamento.paymentDate ?? pagamento.clientPaymentDate ?? pagamento.confirmedDate;
  const dadosPagamento = status === "PAGO"
    ? {
        ...(dataAsaas ? { data_pagamento: new Date(`${dataAsaas.slice(0, 10)}T12:00:00Z`) } : {}),
        valor_pago: pagamento.netValue ?? pagamento.value,
      }
    : {};
  const vinculo = {
    empresa_id: empresaId,
    OR: [
      { asaas_payment_id: pagamento.id },
      { boleto: { asaas_id: pagamento.id } },
      ...(pagamento.externalReference
        ? [{ id: pagamento.externalReference, asaas_payment_id: null, boleto: null }]
        : []),
    ],
  };

  const existente = await prisma.recebivel.findFirst({ where: vinculo, select: { id: true } });
  if (!existente && (!status || pagamento.deleted)) return "ignorado";
  const customer = !existente && pagamento.customer
    ? await asaasGetCustomer(pagamento.customer, apiKey).catch((err: unknown) => {
        if (conselho?.email && err instanceof AsaasApiError && err.status === 404) return null;
        throw err;
      })
    : null;

  return prisma.$transaction(async (tx) => {
    // O webhook e a sincronização manual podem importar a mesma cobrança ao mesmo tempo.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${pagamento.id}))`;
    const atual = await tx.recebivel.findFirst({
      where: vinculo,
      include: { boleto: { select: { id: true, asaas_id: true, status: true } } },
    });
    if (atual) {
      const statusBoleto = status === "PAGO" || status === "VENCIDO" || status === "CANCELADO"
        ? status : undefined;
      const boleto = atual.boleto;
      const atualizarBoleto = boleto && statusBoleto && boleto.status !== statusBoleto;
      const jaVinculado = atual.asaas_payment_id === pagamento.id || boleto?.asaas_id === pagamento.id;
      if (jaVinculado && atual.asaas_status === pagamento.status &&
          atual.status === (status ?? atual.status) && !atualizarBoleto) {
        return "ignorado";
      }
      await tx.recebivel.update({
        where: { id: atual.id },
        data: {
          ...(boleto?.asaas_id === pagamento.id ? {} : { asaas_payment_id: pagamento.id }),
          asaas_status: pagamento.status,
          status,
          ...dadosPagamento,
        },
      });
      if (atualizarBoleto) {
        await tx.boleto.update({ where: { id: boleto.id }, data: { status: statusBoleto } });
      }
      return "atualizado";
    }

    if (existente || !status || pagamento.deleted) return "ignorado";
    const email = conselho?.email ?? customer?.email ?? null;
    const cpfCnpj = customer?.cpfCnpj?.replace(/\D/g, "") || null;
    const cliente = await tx.cliente.findFirst({
      where: {
        empresa_id: empresaId,
        OR: [
          ...(conselho?.clienteId ? [{ id: conselho.clienteId }] : []),
          ...(customer ? [{ asaas_id: customer.id }] : []),
          ...(cpfCnpj ? [{ cpf_cnpj: cpfCnpj, asaas_id: null }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const }, asaas_id: null }] : []),
        ],
      },
      select: { id: true, asaas_id: true },
    });
    let clienteId = cliente?.id;
    const nomeCliente = customer?.name || email?.split("@")[0];
    if (!clienteId && nomeCliente) {
      const novo = await tx.cliente.create({
        data: {
          empresa_id: empresaId,
          nome: nomeCliente,
          email,
          cpf_cnpj: cpfCnpj,
          tipo: cpfCnpj?.length === 14 ? "PESSOA_JURIDICA" : "PESSOA_FISICA",
          asaas_id: customer?.id ?? null,
        },
        select: { id: true },
      });
      clienteId = novo.id;
    } else if (cliente && !cliente.asaas_id && customer) {
      await tx.cliente.updateMany({
        where: { id: cliente.id, asaas_id: null },
        data: { asaas_id: customer.id },
      });
    }

    const plano = conselho ? await tx.planoDeContas.findFirst({
      where: { empresa_id: empresaId, nome: "Novo Agro", ativo: true, tipo: "RECEITA" },
      select: { id: true },
    }) : null;
    const numeroParcela = pagamento.installmentNumber ?? 1;
    const totalParcelas = pagamento.installmentCount ?? 1;
    const descricao = conselho
      ? totalParcelas > 1
        ? `O Conselho Agro — Plano Anual — Parcela ${numeroParcela}/${totalParcelas}`
        : "O Conselho Agro — Mensalidade"
      : pagamento.description?.trim() || `Cobrança Asaas ${pagamento.id}`;

    await tx.recebivel.create({
      data: {
        empresa_id: empresaId,
        cliente_id: clienteId,
        plano_contas_id: plano?.id,
        descricao,
        valor: pagamento.value,
        data_vencimento: new Date(`${pagamento.dueDate}T12:00:00Z`),
        numero_parcela: numeroParcela,
        total_parcelas: totalParcelas,
        asaas_payment_id: pagamento.id,
        asaas_status: pagamento.status,
        asaas_invoice_url: pagamento.invoiceUrl,
        asaas_boleto_url: pagamento.bankSlipUrl,
        status,
        ...dadosPagamento,
      },
    });
    return "criado";
  });
}
