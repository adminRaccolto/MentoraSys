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
} from "@/lib/asaas";

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

  // Obtém ou cria cliente no Asaas
  let asaasCustomerId = recebivel.cliente.asaas_id;
  if (!asaasCustomerId) {
    const customer = await asaasGetOrCreateCustomer(
      recebivel.cliente.nome,
      recebivel.cliente.cpf_cnpj ?? undefined,
      recebivel.cliente.email ?? undefined,
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
  });

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

  await asaasCancelPayment(recebivel.asaas_payment_id);

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

  const payment = await asaasGetPayment(recebivel.asaas_payment_id);

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
  criados: number; atualizados: number; ignorados: number; erros: string[];
}> {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const statusMap: Record<string, string> = {
    PENDING:              "PENDENTE",
    RECEIVED:             "PAGO",
    CONFIRMED:            "PAGO",
    OVERDUE:              "VENCIDO",
    REFUNDED:             "CANCELADO",
    CANCELLED:            "CANCELADO",
    AWAITING_RISK_ANALYSIS: "PENDENTE",
    APPROVED_BY_RISK_ANALYSIS: "PENDENTE",
    PARTIALLY_REFUNDED:   "PAGO",
  };

  let criados = 0, atualizados = 0, ignorados = 0;
  const erros: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data: pagamentos, hasMore } = await asaasListPayments({ offset, limit });
    if (pagamentos.length === 0) break;

    for (const pag of pagamentos) {
      try {
        const email = pag.externalReference;
        if (!email || !email.includes("@")) { ignorados++; continue; }

        // Idempotência: já existe recebível com esse payment_id?
        const existing = await prisma.recebivel.findFirst({
          where: { empresa_id: empresaId, asaas_payment_id: pag.id },
        });

        if (existing) {
          // Só atualiza status se necessário
          const novoStatus = statusMap[pag.status] ?? existing.status;
          if (existing.asaas_status !== pag.status) {
            await prisma.recebivel.update({
              where: { id: existing.id },
              data: {
                asaas_status: pag.status,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: novoStatus as any,
                ...( ["RECEIVED","CONFIRMED"].includes(pag.status) && !existing.data_pagamento
                  ? { data_pagamento: new Date(), valor_pago: pag.value }
                  : {}),
              },
            });
            atualizados++;
          } else {
            ignorados++;
          }
          continue;
        }

        // Localiza cliente pelo e-mail (externalReference = email do comprador)
        const cliente = await prisma.cliente.findFirst({
          where: { empresa_id: empresaId, email },
          select: { id: true },
        });
        if (!cliente) { ignorados++; continue; }

        const isAnual = (pag.installmentCount ?? 1) > 1;
        const totalParcelas = pag.installmentCount ?? 1;
        const numParcela    = pag.installmentNumber ?? 1;
        const descBase      = isAnual
          ? "O Conselho Agro — Plano Anual"
          : "O Conselho Agro — Mensalidade";
        const descricao = isAnual
          ? `${descBase} — Parcela ${numParcela}/${totalParcelas}`
          : descBase;

        const venc = pag.dueDate ? new Date(`${pag.dueDate}T12:00:00`) : new Date();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const novoStatus = (statusMap[pag.status] ?? "PENDENTE") as any;

        await prisma.recebivel.create({
          data: {
            empresa_id:       empresaId,
            cliente_id:       cliente.id,
            descricao,
            valor:            pag.value,
            data_vencimento:  venc,
            numero_parcela:   numParcela,
            total_parcelas:   totalParcelas,
            asaas_payment_id: pag.id,
            asaas_status:     pag.status,
            asaas_invoice_url: pag.invoiceUrl ?? null,
            asaas_boleto_url:  pag.bankSlipUrl ?? null,
            status:           novoStatus,
            ...( ["RECEIVED","CONFIRMED"].includes(pag.status)
              ? { data_pagamento: new Date(), valor_pago: pag.value }
              : {}),
          },
        });
        criados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`${pag.id}: ${msg}`);
      }
    }

    if (!hasMore) break;
    offset += limit;
  }

  revalidatePath("/financeiro/recebiveis");
  return { criados, atualizados, ignorados, erros };
}

// ─── LINKS DE PAGAMENTO (produto fixo) ───────────────────────────────────────

export async function gerarLinkPagamentoProduto(servicoId: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, empresa_id: empresaId },
  });
  if (!servico) throw new Error("Serviço não encontrado.");

  const link = await asaasCreatePaymentLink({
    name: servico.nome,
    value: servico.valor_base ? Number(servico.valor_base) : undefined,
    billingType: "UNDEFINED",
    chargeType: servico.tipo_cobranca === "ASSINATURA" ? "RECURRENT" : "DETACHED",
    subscriptionCycle: servico.tipo_cobranca === "ASSINATURA" ? "MONTHLY" : undefined,
    description: servico.descricao ?? undefined,
  });

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

  // Obtém ou cria cliente no Asaas se tiver e-mail
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
    });
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

  if (assinatura.asaas_subscription_id) {
    await asaasCancelSubscription(assinatura.asaas_subscription_id);
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

  const sub = await asaasGetSubscription(assinatura.asaas_subscription_id);

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

  if (assinatura.asaas_subscription_id) {
    await asaasUpdateSubscription(assinatura.asaas_subscription_id, { status: "INACTIVE" });
  }

  await prisma.assinatura.update({ where: { id }, data: { status: "PAUSADA" } });
  revalidatePath("/financeiro/assinaturas");
  return { ok: true };
}
