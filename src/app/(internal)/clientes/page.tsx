import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import ClientesClient from "./clientes-client";

export default async function ClientesPage() {
  const empresaId = await obterEmpresaAtiva();

  const clientes = await prisma.cliente.findMany({
    where: { empresa_id: empresaId },
    select: {
      id: true,
      nome: true,
      tipo: true,
      status: true,
      nome_fantasia: true,
      cpf_cnpj: true,
      inscricao_estadual: true,
      contato_principal: true,
      email: true,
      telefone: true,
      whatsapp: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      estado: true,
      nome_fazenda: true,
      distancia_km: true,
      preco_km: true,
    },
    orderBy: { nome: "asc" },
  });

  return (
    <ClientesClient
      clientes={clientes.map((c) => ({
        ...c,
        distancia_km: c.distancia_km ? Number(c.distancia_km) : null,
        preco_km: c.preco_km ? Number(c.preco_km) : null,
      }))}
    />
  );
}
