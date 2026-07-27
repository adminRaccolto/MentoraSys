import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import FornecedoresClient from "./fornecedores-client";

export default async function FornecedoresPage() {
  const empresaId = await obterEmpresaAtiva();

  const fornecedores = await prisma.fornecedor.findMany({
    where: { empresa_id: empresaId, ativo: true },
    orderBy: { nome: "asc" },
  });

  return <FornecedoresClient fornecedores={fornecedores} />;
}
