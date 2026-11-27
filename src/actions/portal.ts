"use server";

import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

import { criarTokenPortal } from "@/lib/portal-sessao";

export async function gerarLinkPortal(clienteId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId, empresa_id: empresaId },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  return { token: await criarTokenPortal(cliente) };
}
