const BASE = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://www.asaas.com/api/v3";

async function req<T = unknown>(method: string, path: string, body?: object): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
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
interface AsaasListResponse<T> { data: T[]; }

export async function asaasGetOrCreateCustomer(nome: string, cpfCnpj?: string, email?: string): Promise<AsaasCustomer> {
  const cpf = cpfCnpj?.replace(/\D/g, "");
  if (cpf) {
    const existing = await req<AsaasListResponse<AsaasCustomer>>("GET", `/customers?cpfCnpj=${cpf}`);
    if (existing.data?.length > 0) return existing.data[0];
  }
  return req<AsaasCustomer>("POST", "/customers", { name: nome, cpfCnpj: cpf || undefined, email: email || undefined });
}

export async function asaasCreateBoleto(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}): Promise<AsaasPayment> {
  return req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "BOLETO",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  });
}

export async function asaasGetPayment(paymentId: string): Promise<AsaasPayment> {
  return req<AsaasPayment>("GET", `/payments/${paymentId}`);
}

export async function asaasGetBarCode(paymentId: string): Promise<AsaasBarCode> {
  return req<AsaasBarCode>("GET", `/payments/${paymentId}/identificationField`);
}

export async function asaasCancelPayment(paymentId: string): Promise<void> {
  await req("DELETE", `/payments/${paymentId}`);
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
}): Promise<AsaasInvoice> {
  return req<AsaasInvoice>("POST", "/invoices", {
    customer: params.customerId,
    serviceDescription: params.descricao,
    value: params.valor,
    ...(params.codigoServico ? { municipalServiceCode: params.codigoServico } : {}),
    ...(params.paymentId ? { payment: params.paymentId } : {}),
  });
}

export async function asaasConsultarNFSe(invoiceId: string): Promise<AsaasInvoice> {
  return req<AsaasInvoice>("GET", `/invoices/${invoiceId}`);
}

export async function asaasCancelarNFSe(invoiceId: string): Promise<void> {
  await req("DELETE", `/invoices/${invoiceId}`);
}

// ─── PIX ──────────────────────────────────────────────────────────────────────

interface AsaasPixQrCode { encodedImage: string; payload: string; expirationDate?: string; }

export async function asaasCreatePix(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}): Promise<AsaasPayment> {
  return req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "PIX",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  });
}

export async function asaasGetPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return req<AsaasPixQrCode>("GET", `/payments/${paymentId}/pixQrCode`);
}

export async function asaasCreateBoletoPix(params: {
  customerId: string; valor: number; vencimento: string;
  descricao: string; externalRef: string;
}): Promise<AsaasPayment & { pixQrCode?: AsaasPixQrCode }> {
  const payment = await req<AsaasPayment>("POST", "/payments", {
    customer: params.customerId,
    billingType: "BOLETO",
    value: params.valor,
    dueDate: params.vencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  });
  try {
    const pix = await asaasGetPixQrCode(payment.id);
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
}): Promise<AsaasPaymentLink> {
  return req<AsaasPaymentLink>("POST", "/paymentLinks", {
    name: params.name,
    ...(params.value != null ? { value: params.value } : {}),
    billingType: params.billingType,
    chargeType: params.chargeType,
    ...(params.subscriptionCycle ? { subscriptionCycle: params.subscriptionCycle } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
  });
}

export async function asaasGetPaymentLink(linkId: string): Promise<AsaasPaymentLink> {
  return req<AsaasPaymentLink>("GET", `/paymentLinks/${linkId}`);
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
}): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("POST", "/subscriptions", {
    customer: params.customerId,
    billingType: params.billingType,
    cycle: params.cycle,
    value: params.valor,
    nextDueDate: params.proximoVencimento,
    description: params.descricao,
    externalReference: params.externalRef,
  });
}

export async function asaasGetSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("GET", `/subscriptions/${subscriptionId}`);
}

export async function asaasCancelSubscription(subscriptionId: string): Promise<void> {
  await req("DELETE", `/subscriptions/${subscriptionId}`);
}

export async function asaasUpdateSubscription(subscriptionId: string, params: {
  valor?: number; cycle?: string; nextDueDate?: string; status?: string;
}): Promise<AsaasSubscription> {
  return req<AsaasSubscription>("PUT", `/subscriptions/${subscriptionId}`, params);
}

// ─── CUSTOMER por ID ──────────────────────────────────────────────────────────

export async function asaasGetCustomer(customerId: string): Promise<AsaasCustomer> {
  return req<AsaasCustomer>("GET", `/customers/${customerId}`);
}

export async function asaasUpdateCustomer(customerId: string, params: {
  name?: string; email?: string; phone?: string; cpfCnpj?: string;
}): Promise<AsaasCustomer> {
  return req<AsaasCustomer>("PUT", `/customers/${customerId}`, params);
}
