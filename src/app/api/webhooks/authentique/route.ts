import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// Authentique envia HMAC-SHA256 do payload no header X-Autentique-Signature.
// Configure AUTHENTIQUE_WEBHOOK_SECRET com o Endpoint Secret gerado pelo Authentique.

export async function POST(req: Request) {
  const rawBody = await req.text();

  const secret = process.env.AUTHENTIQUE_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get("x-autentique-signature");
    if (!signature) {
      console.log("[authentique-webhook] missing signature header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        console.log("[authentique-webhook] invalid signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;

  console.log("[authentique-webhook] event:", event);

  if (event === "DOCUMENT_FINISHED") {
    const doc = (body.data as Record<string, unknown>)?.document as Record<string, unknown> | undefined;
    const documentId = doc?.id as string | undefined;
    const signedPdfUrl = (doc?.files as Record<string, string> | undefined)?.signed ?? null;

    console.log("[authentique-webhook] document_finished document_id:", documentId, "pdf:", !!signedPdfUrl);

    if (documentId) {
      const result = await prisma.contrato.updateMany({
        where: { authentique_id: documentId },
        data: {
          status: "ASSINADO",
          assinado_em: new Date(),
          pdf_assinado_url: signedPdfUrl,
        },
      });
      console.log("[authentique-webhook] updated contratos:", result.count);
    }
  }

  return NextResponse.json({ received: true });
}
