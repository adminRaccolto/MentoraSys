const BASE = "https://api.nfse.io/v2";

function authHeader() {
  const key = process.env.NFSIO_API_KEY;
  if (!key) throw new Error("NFSIO_API_KEY não configurada");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function req<T = unknown>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return {} as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `NFSe.io ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

function empresaId() {
  const id = process.env.NFSIO_EMPRESA_ID;
  if (!id) throw new Error("NFSIO_EMPRESA_ID não configurada");
  return id;
}

export interface NfsioNota {
  id: string; status: string; number?: string;
  pdfUrl?: string; xmlUrl?: string;
}

export async function nfsioEmitirNota(params: {
  tomadorNome: string;
  tomadorCpfCnpj?: string;
  tomadorEmail?: string;
  valorServico: number;
  descricaoServico: string;
  codigoServico: string;
  aliquotaIss: number;
}): Promise<NfsioNota> {
  return req<NfsioNota>("POST", `/companies/${empresaId()}/serviceinvoices`, {
    borrower: {
      name: params.tomadorNome,
      federalTaxNumber: params.tomadorCpfCnpj?.replace(/\D/g, "") || undefined,
      email: params.tomadorEmail || undefined,
    },
    serviceCode: params.codigoServico,
    description: params.descricaoServico,
    servicesAmount: params.valorServico,
    issRate: params.aliquotaIss / 100,
  });
}

export async function nfsioConsultarNota(notaId: string): Promise<NfsioNota> {
  return req<NfsioNota>("GET", `/companies/${empresaId()}/serviceinvoices/${notaId}`);
}

export async function nfsioCancelarNota(notaId: string): Promise<void> {
  await req("DELETE", `/companies/${empresaId()}/serviceinvoices/${notaId}`);
}
