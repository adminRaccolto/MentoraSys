import { createHmac } from "crypto";

function secret(): string {
  return process.env.FATURA_SECRET ?? "dev-changeme";
}

export function gerarTokenFatura(recebivelId: string, empresaId: string): string {
  const payload = Buffer.from(JSON.stringify({ r: recebivelId, e: empresaId })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verificarTokenFatura(token: string): { recebivelId: string; empresaId: string } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { r?: string; e?: string };
    if (!data.r || !data.e) return null;
    return { recebivelId: data.r, empresaId: data.e };
  } catch {
    return null;
  }
}
