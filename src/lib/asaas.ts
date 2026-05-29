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
