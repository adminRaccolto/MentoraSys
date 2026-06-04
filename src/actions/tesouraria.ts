"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { registrar } from "@/lib/auditoria";

const schema = z.object({
  conta_origem_id:  z.string().min(1, "Conta origem obrigatória"),
  conta_destino_id: z.string().min(1, "Conta destino obrigatória"),
  valor:            z.coerce.number().positive("Valor deve ser positivo"),
  data:             z.string().min(1, "Data obrigatória"),
  descricao:        z.string().optional(),
});

type Input = z.input<typeof schema>;

export async function criarTransferencia(input: Input) {
  await verificarPermissao("financeiro", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schema.parse(input);

  if (data.conta_origem_id === data.conta_destino_id)
    throw new Error("Conta de origem e destino não podem ser iguais");

  const transferencia = await prisma.transferenciaTesouraria.create({
    data: {
      empresa_id:       empresaId,
      conta_origem_id:  data.conta_origem_id,
      conta_destino_id: data.conta_destino_id,
      valor:            data.valor,
      data:             parseLocalDate(data.data),
      descricao:        data.descricao || null,
    },
    include: {
      conta_origem:  { select: { id: true, nome: true } },
      conta_destino: { select: { id: true, nome: true } },
    },
  });

  await registrar({ recurso: "tesouraria", acao: "transferencia", registroId: transferencia.id, detalhes: { valor: data.valor, origem: data.conta_origem_id, destino: data.conta_destino_id } });
  revalidatePath("/financeiro/tesouraria");
  return {
    data: {
      ...transferencia,
      valor: Number(transferencia.valor),
    },
  };
}

export async function excluirTransferencia(id: string) {
  await verificarPermissao("financeiro", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const t = await prisma.transferenciaTesouraria.findFirst({ where: { id, empresa_id: empresaId } });
  if (!t) throw new Error("Transferência não encontrada");

  await prisma.transferenciaTesouraria.delete({ where: { id } });
  await registrar({ recurso: "tesouraria", acao: "excluir_transferencia", registroId: id });
  revalidatePath("/financeiro/tesouraria");
  return { data: null };
}
