import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ModelosClient from "./modelos-client";

export default async function ModelosPage() {
  const empresaId = await obterEmpresaAtiva();

  const modelos = await prisma.modeloDocumento.findMany({
    where: { empresa_id: empresaId, ativo: true },
    orderBy: { atualizado_em: "desc" },
  });

  return <ModelosClient modelos={modelos} />;
}
