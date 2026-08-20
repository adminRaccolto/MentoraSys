import { listarReembolsos, listarClientesParaDeslocamento } from "@/actions/reembolsos";
import ReembolsoClient from "./reembolso-client";

export default async function ReembolsoPage() {
  const [raw, clientesRaw] = await Promise.all([
    listarReembolsos(),
    listarClientesParaDeslocamento(),
  ]);

  // Serializa Decimal → number para o client component
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

  return <ReembolsoClient reembolsos={reembolsos} clientes={clientes} />;
}
