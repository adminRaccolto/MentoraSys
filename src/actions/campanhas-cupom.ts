"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes"

const schemaCupom = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  codigo: z.string().min(2, "Código obrigatório").transform((v) => v.toUpperCase().trim()),
  tipo_desconto: z.enum(["PERCENTUAL", "FIXO"]),
  valor_desconto: z.string().min(1, "Valor obrigatório"),
  servico_id: z.string().optional().nullable(),
  ativo: z.boolean().optional().default(true),
  validade_ate: z.string().optional().nullable(),
  usos_maximos: z.string().optional().nullable(),
})

type CupomInput = z.infer<typeof schemaCupom>

export async function criarCupom(input: CupomInput) {
  await verificarPermissao("servicos", "criar")
  const empresaId = await obterEmpresaAtiva()
  const data = schemaCupom.parse(input)

  const cupom = await prisma.campanhaCupom.create({
    data: {
      empresa_id: empresaId,
      nome: data.nome,
      codigo: data.codigo,
      tipo_desconto: data.tipo_desconto,
      valor_desconto: parseFloat(data.valor_desconto),
      servico_id: data.servico_id ?? null,
      ativo: data.ativo ?? true,
      validade_ate: data.validade_ate ? new Date(data.validade_ate) : null,
      usos_maximos: data.usos_maximos ? parseInt(data.usos_maximos) : null,
    },
  })

  revalidatePath("/campanhas-cupom")
  return { data: cupom }
}

export async function editarCupom(id: string, input: CupomInput) {
  await verificarPermissao("servicos", "editar")
  const empresaId = await obterEmpresaAtiva()
  const data = schemaCupom.parse(input)

  const existente = await prisma.campanhaCupom.findFirst({ where: { id, empresa_id: empresaId } })
  if (!existente) throw new Error("Cupom não encontrado.")

  const cupom = await prisma.campanhaCupom.update({
    where: { id },
    data: {
      nome: data.nome,
      codigo: data.codigo,
      tipo_desconto: data.tipo_desconto,
      valor_desconto: parseFloat(data.valor_desconto),
      servico_id: data.servico_id ?? null,
      ativo: data.ativo ?? true,
      validade_ate: data.validade_ate ? new Date(data.validade_ate) : null,
      usos_maximos: data.usos_maximos ? parseInt(data.usos_maximos) : null,
    },
  })

  revalidatePath("/campanhas-cupom")
  return { data: cupom }
}

export async function excluirCupom(id: string) {
  await verificarPermissao("servicos", "excluir")
  const empresaId = await obterEmpresaAtiva()

  const existente = await prisma.campanhaCupom.findFirst({ where: { id, empresa_id: empresaId } })
  if (!existente) throw new Error("Cupom não encontrado.")

  await prisma.campanhaCupom.delete({ where: { id } })
  revalidatePath("/campanhas-cupom")
}

export async function alternarAtivoCupom(id: string, ativo: boolean) {
  await verificarPermissao("servicos", "editar")
  const empresaId = await obterEmpresaAtiva()

  const existente = await prisma.campanhaCupom.findFirst({ where: { id, empresa_id: empresaId } })
  if (!existente) throw new Error("Cupom não encontrado.")

  await prisma.campanhaCupom.update({ where: { id }, data: { ativo } })
  revalidatePath("/campanhas-cupom")
}
