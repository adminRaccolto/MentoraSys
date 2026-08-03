"use server";

import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { gerarTokenFatura } from "@/lib/fatura-token";
import { enviarFatura } from "@/lib/email";

export async function enviarFaturaPorEmail(
  recebivelId: string,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const empresaId = await obterEmpresaAtiva();

    const recebivel = await prisma.recebivel.findFirst({
      where: { id: recebivelId, empresa_id: empresaId },
      include: {
        cliente: true,
        contrato: true,
        conta_bancaria: true,
      },
    });

    if (!recebivel) return { ok: false, erro: "Lançamento não encontrado." };
    if (!recebivel.cliente?.email)
      return { ok: false, erro: "Cliente não possui e-mail cadastrado." };

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        contas_bancarias: { where: { ativo: true }, orderBy: { criado_em: "asc" } },
      },
    });
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." };

    const contaRecebimento =
      recebivel.conta_bancaria ??
      empresa.contas_bancarias.find((c) => c.pix_chave) ??
      empresa.contas_bancarias[0] ??
      null;

    const token = gerarTokenFatura(recebivelId, empresaId);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const link = `${baseUrl}/fatura/p/${token}`;

    await enviarFatura({
      para: recebivel.cliente.email,
      clienteNome: recebivel.cliente.nome,
      empresaNome: empresa.nome,
      descricao: recebivel.descricao,
      valor: Number(recebivel.valor),
      dataVencimento: recebivel.data_vencimento,
      numeroParcela: recebivel.numero_parcela,
      totalParcelas: recebivel.total_parcelas,
      formaPagamento: recebivel.forma_pagamento,
      pixChave: contaRecebimento?.pix_chave ?? null,
      link,
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar e-mail.";
    return { ok: false, erro: msg };
  }
}
