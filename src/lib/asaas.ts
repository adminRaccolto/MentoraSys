import { prisma } from "@/lib/prisma";

const BASE = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://www.asaas.com/api/v3";

// Busca a chave Asaas da empresa no banco; cai no env var como fallback.
export async function obterChaveAsaas(empresaId: string): Promise<string> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { asaas_api_key: true },
  });
  const key = empresa?.asaas_api_key ?? process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Chave de API Asaas não configurada para esta empresa");
  return key;
}

async function req<T = unknown>(method: string, path: string, body?: object, apiKey?: string): Promise<T> {
  const key = apiKey ?? process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "access_token": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { errors?: { description: string }[] }).errors?.[0]?.description
      ?? `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

interface AsaasCustomer { id: string; name: string; cpfCnpj?: string; email?: string; }
interface AsaasPayment {
  id: string; status: string; value: number; dueDate: string;
  bankSlipUrl?: string; invoiceUrl?: string; nossoNumero?: string;
}
interface AsaasBarCode { identificationField?: string; barCode?: string; }
interface AsaasListResponse<T> { data: T[]; totalCount?: number; hasMore?: boolean; }

export interface AsaasPaymentFull {
  id: string; status: string; value: number; dueDate: string;
  description?: string; externalReference?: string;
  customer?: string;
  subscription?: string;
  installment?: string; installmentNumber?: number; installmentCount?: number;
  bankSlipUrl?: string; invoiceUrl?: string; nossoNumero?: string;
}

export async function asaasListPayments(params?: {
  offset?: number; limit?: number; externalReference?: string;
}, apiKey?: string): Promise<{ data: AsaasPaymentFull[]; totalCount: number; hasMore: boolean }> {
  const qs = new URLSearchParams({ limit: String(params?.limit ?? 100) })
  if (params?.offset) qs.set("offset", String(params.offset))
  if (params?.externalReference) qs.set("externalReference", params.externalReference)
  const res = await req<AsaasListResponse<AsaasPaymentFull>>("GET", `/payments?${qs}`, undefined, apiKey)
  return { data: res.data, totalCount: res.totalCount ?? res.data.length, hasMore: res.hasMore ?? false }
}

export async function asaasGetOrCreateCustomer(nome: string, cpfCnpj?: string, email?: string, apiKey?: string): Promise<AsaasCustomer> {
  const cpf = cpfCnpj?.replace(/\D/g, "");
  if (cpf) {
    const existing = await req<AsaasListResponse<AsaasCustomer>>("GET", `/customers?cpfCnpj=${cpf}`, undefined, apiKey);
    if (existing.data?.length > 0) return existing.data[0];
  }
  return req<AsaasCustomer>("POST", "/customers", { name: nome, cpfCnpj: cpf || undefined, email: email || undefined }, apiKey);
}

export async function asaasCreateBoleto(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}, apiKey?: string): Promise<AsaasPayment> {
  return req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "BOLETO",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  }, apiKey);
}

export async function asaasGetPayment(paymentId: string, apiKey?: string): Promise<AsaasPayment> {
  return req<AsaasPayment>("GET", `/payments/${paymentId}`, undefined, apiKey);
}

export async function asaasGetBarCode(paymentId: string, apiKey?: string): Promise<AsaasBarCode> {
  return req<AsaasBarCode>("GET", `/payments/${paymentId}/identificationField`, undefined, apiKey);
}

export async function asaasCancelPayment(paymentId: string, apiKey?: string): Promise<void> {
  await req("DELETE", `/payments/${paymentId}`, undefined, apiKey);
}

// ─── NFS-e ────────────────────────────────────────────────────────────────────

export interface AsaasInvoice {
  id: string;
  status: string; // RECEIVED | SYNCHRONIZED | CANCELLED | ERROR
  number?: string;
  pdf?: string;
  xml?: string;
}

export async function asaasEmitirNFSe(params: {
  customerId: string;
  valor: number;
  descricao: string;
  codigoServico?: string;
  paymentId?: string;
}, apiKey?: string): Promise<AsaasInvoice> {
  return req<AsaasInvoice>("POST", "/invoices", {
    customer: params.customerId,
    serviceDescription: params.descricao,
    value: params.valor,
    ...(params.codigoServico ? { municipalServiceCode: params.codigoServico } : {}),
    ...(params.paymentId ? { payment: params.paymentId } : {}),
  }, apiKey);
}

export async function asaasConsultarNFSe(invoiceId: string, apiKey?: string): Promise<AsaasInvoice> {
  return req<AsaasInvoice>("GET", `/invoices/${invoiceId}`, undefined, apiKey);
}

export async function asaasCancelarNFSe(invoiceId: string, apiKey?: string): Promise<void> {
  await req("DELETE", `/invoices/${invoiceId}`, undefined, apiKey);
}

// ─── PIX ──────────────────────────────────────────────────────────────────────

interface AsaasPixQrCode { encodedImage: string; payload: string; expirationDate?: string; }

export async function asaasCreatePix(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}, apiKey?: string): Promise<AsaasPayment> {
  return req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "PIX",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  }, apiKey);
}

export async function asaasGetPixQrCode(paymentId: string, apiKey?: string): Promise<AsaasPixQrCode> {
  return req<AsaasPixQrCode>("GET", `/payments/${paymentId}/pixQrCode`, undefined, apiKey);
}

export async function asaasCreateBoletoPix(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}, apiKey?: string): Promise<AsaasPayment & { pixQrCode?: AsaasPixQrCode }> {
  const payment = await req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "BOLETO",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  }, apiKey);
  try {
    const pix = await asaasGetPixQrCode(payment.id, apiKey);
    return { ...payment, pixQrCode: pix };
  } catch {
    return payment;
  }
}

// ─── LINKS DE PAGAMENTO (produto fixo) ───────────────────────────────────────

export interface AsaasPaymentLink {
  id: string;
  name: string;
  url: string;
  value?: number;
  billingType: string;
  chargeType: string;
  status: string;
}

export async function asaasCreatePaymentLink(params: {
  name: string;
  value?: number;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  chargeType: "RECURRENT" | "DETACHED";
  subscriptionCycle?: "MONTHLY" | "YEARLY" | "WEEKLY";
  description?: string;
  endDate?: string;
}, apiKey?: string): Promise<AsaasPaymentLink> {
  return req<AsaasPaymentLink>("POST", "/paymentLinks", {
    name: params.name,
    ...(params.value != null ? { value: params.value } : {}),
    billingType: params.billingType,
    chargeType: params.chargeType,
    ...(params.subscriptionCycle ? { subscriptionCycle: params.subscriptionCycle } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
  }, apiKey);
}

export async function asaasGetPaymentLink(linkId: string, apiKey?: string): Promise<AsaasPaymentLink> {
  return req<AsaasPaymentLink>("GET", `/paymentLinks/${linkId}`, undefined, apiKey);
}

// ─── ASSINATURAS RECORRENTES ──────────────────────────────────────────────────

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: string;
  cycle: string;
  value: number;
  nextDueDate: string;
  status: string;
  description?: string;
  externalReference?: string;
}

export async function asaasCreateSubscription(params: {
  customerId: string;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD";
  cycle: "MONTHLY" | "YEARLY" | "WEEKLY";
  valor: number;
  proximoVencimento: string;
  descricao: string;
  externalRef: string;
}, apiKey?: string): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("POST", "/subscriptions", {
    customer: params.customerId,
    billingType: params.billingType,
    cycle: params.cycle,
    value: params.valor,
    nextDueDate: params.proximoVencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  }, apiKey);
}

export async function asaasGetSubscription(subscriptionId: string, apiKey?: string): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("GET", `/subscriptions/${subscriptionId}`, undefined, apiKey);
}

export async function asaasCancelSubscription(subscriptionId: string, apiKey?: string): Promise<void> {
  await req("DELETE", `/subscriptions/${subscriptionId}`, undefined, apiKey);
}

export async function asaasUpdateSubscription(subscriptionId: string, params: {
  valor?: number; cycle?: string; nextDueDate?: string; status?: string;
}, apiKey?: string): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("PUT", `/subscriptions/${subscriptionId}`, params, apiKey);
}

// ─── CUSTOMER por ID ──────────────────────────────────────────────────────────

export async function asaasGetCustomer(customerId: string, apiKey?: string): Promise<AsaasCustomer> {
  return req<AsaasCustomer>("GET", `/customers/${customerId}`, undefined, apiKey);
}

export async function asaasUpdateCustomer(customerId: string, params: {
  name?: string; email?: string; phone?: string; cpfCnpj?: string;
}, apiKey?: string): Promise<AsaasCustomer> {
  return req<AsaasCustomer>("PUT", `/customers/${customerId}`, params, apiKey);
}
