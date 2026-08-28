import { listarReembolsos, listarClientesParaDeslocamento } from "@/actions/reembolsos";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ReembolsoClient from "./reembolso-client";

export interface PagamentoReembolso {
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  chave_pix: string;
}

export default async function ReembolsoPage() {
  const empresaId = await obterEmpresaAtiva();

  const [raw, clientesRaw, empresa] = await Promise.all([
    listarReembolsos(),
    listarClientesParaDeslocamento(),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    }),
  ]);

  const cfg = (empresa?.configuracoes as Record<string, unknown>) ?? {};
  const pagamentoConfig = (cfg.pagamento_reembolso as PagamentoReembolso) ?? null;

  const reembolsos = raw.map((r) => ({
    ...r,
    total: Number(r.total),
    itens: r.itens.map((i) => ({
      ...i,
      valor: Number(i.valor),
      km: i.km != null ? Number(i.km) : null,
      valor_km: i.valor_km != null ? Number(i.valor_km) : null,
    })),
  }));

  const clientes = clientesRaw.map((c) => ({
    ...c,
    distancia_km: c.distancia_km != null ? Number(c.distancia_km) : null,
    preco_km: c.preco_km != null ? Number(c.preco_km) : null,
  }));

  return (
    <ReembolsoClient
      reembolsos={reembolsos}
      clientes={clientes}
      pagamentoConfig={pagamentoConfig}
    />
  );
}
