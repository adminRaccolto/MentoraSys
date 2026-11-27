import { tratarWebhookZoom } from "@/lib/mentorias-zoom-webhook";

export async function POST(request: Request) {
  const empresaId = process.env.ZOOM_EMPRESA_ID;
  const conta = process.env.ZOOM_ACCOUNT_ID;
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!empresaId || !conta || !secret) return new Response(null, { status: 503 });
  return tratarWebhookZoom(request, async () => ({ empresaId, conta, secret }));
}
