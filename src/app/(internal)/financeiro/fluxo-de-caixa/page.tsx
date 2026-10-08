import { obterEmpresaAtiva } from "@/lib/permissoes";
import { buscarFluxoCaixa } from "@/lib/fluxo-caixa-query";
import FluxoCaixaClient from "./fluxo-caixa-client";

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

export default async function FluxoCaixaPage({ searchParams }: Props) {
  const { de, ate } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const hoje = new Date();
  const deStr = de ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ateStr = ate ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;
  const inicio = new Date(`${deStr}T00:00:00`);
  const fim = new Date(`${ateStr}T23:59:59`);

  const { lancamentos, saldoAnterior } = await buscarFluxoCaixa(empresaId, inicio, fim);

  return (
    <FluxoCaixaClient
      key={`${deStr}_${ateStr}`}
      lancamentos={lancamentos}
      de={deStr}
      ate={ateStr}
      saldoAnterior={saldoAnterior}
    />
  );
}
