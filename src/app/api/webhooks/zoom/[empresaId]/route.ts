import { obterConfiguracaoZoomSalva } from "@/lib/mentorias-zoom-config";
import { tratarWebhookZoom } from "@/lib/mentorias-zoom-webhook";

export async function POST(request: Request, { params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(empresaId)) return new Response(null, { status: 404 });
  return tratarWebhookZoom(request, async () => {
    const config = await obterConfiguracaoZoomSalva(empresaId);
    return config?.webhook ? { empresaId, conta: config.conta, secret: config.webhook } : null;
  });
}
