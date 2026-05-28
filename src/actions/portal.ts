"use server";

import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

function gerarToken(tamanho = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < tamanho; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function gerarLinkPortal(clienteId: string) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId, empresa_id: empresaId },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  const token = gerarToken(32);
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  await prisma.tokenPortal.create({
    data: {
      cliente_id: clienteId,
      token,
      email: cliente.email ?? "",
      expira_em: expiraEm,
    },
  });

  return { token };
}
