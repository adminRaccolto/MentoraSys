"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";
import { asaasGetOrCreateCustomer, asaasCreateBoleto, asaasGetPayment, asaasGetBarCode, asaasCancelPayment, obterChaveAsaas } from "@/lib/asaas";

export async function gerarBoleto(recebivelId: string) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();

  const recebivel = await prisma.recebivel.findFirst({
    where: { id: recebivelId, empresa_id: empresaId },
    include: { cliente: true, boleto: true },
  });
  if (!recebivel) throw new Error("Recebível não encontrado");
  if (recebivel.status === "PAGO") throw new Error("Recebível já foi baixado");
  if (recebivel.boleto) throw new Error("Este recebível já possui um boleto gerado");

  const apiKey = await obterChaveAsaas(empresaId);

  const customer = await asaasGetOrCreateCustomer(
    recebivel.cliente?.nome ?? "Cliente",
    recebivel.cliente?.cpf_cnpj ?? undefined,
    recebivel.cliente?.email ?? undefined,
    apiKey,
  );

  const vencimento = recebivel.data_vencimento.toISOString().split("T")[0];

  const payment = await asaasCreateBoleto({
    customerId: customer.id,
    valor: Number(recebivel.valor),
    vencimento,
    descricao: recebivel.descricao,
    externalRef: recebivel.id,
  }, apiKey);

  // Busca linha digitável
  let linhaDigitavel: string | null = null;
  let codigoBarras: string | null = null;
  try {
    const barCode = await asaasGetBarCode(payment.id, apiKey);
    linhaDigitavel = barCode.identificationField ?? null;
    codigoBarras   = barCode.barCode ?? null;
  } catch { /* não crítico */ }

  const boleto = await prisma.boleto.create({
    data: {
      empresa_id:        empresaId,
      recebivel_id:      recebivelId,
      cliente_id:        recebivel.cliente_id ?? undefined,
      asaas_id:          payment.id,
      asaas_customer_id: customer.id,
      status:            payment.status,
      valor:             Number(recebivel.valor),
      vencimento:        recebivel.data_vencimento,
      linha_digitavel:   linhaDigitavel,
      codigo_barras:     codigoBarras,
      url_boleto:        payment.bankSlipUrl ?? null,
      url_fatura:        payment.invoiceUrl ?? null,
      nosso_numero:      payment.nossoNumero ?? null,
    },
  });

  await registrar({ recurso: "boletos", acao: "gerar", registroId: boleto.id, detalhes: { asaas_id: payment.id } });
  revalidatePath("/financeiro/recebiveis");
  return { data: { ...boleto, valor: Number(boleto.valor) } };
}

export async function consultarBoleto(boletoId: string) {
  await verificarPermissao("financeiro", "editar");
  const empresaId = await obterEmpresaAtiva();

  const boleto = await prisma.boleto.findFirst({ where: { id: boletoId, empresa_id: empresaId } });
  if (!boleto) throw new Error("Boleto não encontrado");
  if (!boleto.asaas_id) throw new Error("Boleto sem ID Asaas");

  const apiKey = await obterChaveAsaas(empresaId);
  const payment = await asaasGetPayment(boleto.asaas_id, apiKey);

  const updated = await prisma.boleto.update({
    where: { id: boletoId },
    data: {
      status:      payment.status,
      url_boleto:  payment.bankSlipUrl ?? boleto.url_boleto,
      url_fatura:  payment.invoiceUrl  ?? boleto.url_fatura,
      nosso_numero: payment.nossoNumero ?? boleto.nosso_numero,
    },
  });

  revalidatePath("/financeiro/recebiveis");
  return { data: { ...updated, valor: Number(updated.valor) } };
}

export async function cancelarBoleto(boletoId: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const boleto = await prisma.boleto.findFirst({ where: { id: boletoId, empresa_id: empresaId } });
  if (!boleto) throw new Error("Boleto não encontrado");

  const apiKey = await obterChaveAsaas(empresaId);
  if (boleto.asaas_id) {
    try { await asaasCancelPayment(boleto.asaas_id, apiKey); } catch { /* ignora se já cancelado */ }
  }

  await prisma.boleto.delete({ where: { id: boletoId } });
  await registrar({ recurso: "boletos", acao: "cancelar", registroId: boletoId });
  revalidatePath("/financeiro/recebiveis");
  return { data: null };
}
