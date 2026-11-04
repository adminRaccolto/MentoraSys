import { listarPrevisoesGeradas } from "@/actions/impostos";
import ImpostosClient from "./impostos-client";

export default async function ImpostosPage() {
  const previsoes = await listarPrevisoesGeradas();

  return (
    <ImpostosClient
      previsoes={previsoes.map((p) => ({
        id: p.id,
        descricao: p.descricao,
        valor: Number(p.valor),
        data_vencimento: p.data_vencimento,
        status: p.status,
        observacoes: p.observacoes,
      }))}
    />
  );
}
