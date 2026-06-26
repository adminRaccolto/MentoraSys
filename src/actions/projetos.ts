"use server";
import { parseLocalDate } from "@/lib/date";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { sincronizarCcDoProjeto } from "@/actions/centros-custo";

const schema = z.object({
  cliente_id:     z.string().optional(),
  contrato_id:    z.string().optional(),
  interno:        z.boolean().default(false),
  titulo:         z.string().min(2, "Título obrigatório"),
  descricao:      z.string().optional(),
  data_inicio:    z.string().optional(),
  data_fim:       z.string().optional(),
  e_centro_custo: z.boolean().default(false),
}).refine(
  (d) => d.interno || !!d.cliente_id,
  { message: "Selecione um cliente ou marque como projeto interno", path: ["cliente_id"] }
);

type Input = z.input<typeof schema>;

export async function criarProjeto(input: Input) {
  await verificarPermissao("projetos", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const data = schema.parse(input);

  const ETAPAS_PADRAO = [
    { titulo: "A Iniciar",    ordem: 1 },
    { titulo: "Em Execução",  ordem: 2 },
    { titulo: "Aprovação",    ordem: 3 },
    { titulo: "Finalizado",   ordem: 4 },
  ];

  const projeto = await prisma.$transaction(async (tx) => {
    const p = await tx.projeto.create({
      data: {
        empresa_id: empresaId,
        cliente_id: data.cliente_id || null,
        contrato_id: data.contrato_id || null,
        interno: data.interno ?? false,
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_inicio: data.data_inicio ? parseLocalDate(data.data_inicio) : null,
        data_fim: data.data_fim ? parseLocalDate(data.data_fim) : null,
        e_centro_custo: data.e_centro_custo ?? false,
        criado_por: user?.id,
      },
    });

    await tx.etapa.createMany({
      data: ETAPAS_PADRAO.map((e) => ({
        projeto_id: p.id,
        titulo: e.titulo,
        ordem: e.ordem,
      })),
    });

    return p;
  });

  if (data.e_centro_custo) {
    await sincronizarCcDoProjeto(projeto.id, data.titulo, true, empresaId);
  }

  revalidatePath("/projetos");
  return { data: projeto };
}

export async function editarProjeto(id: string, input: Input & { status?: string }) {
  await verificarPermissao("projetos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.projeto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Projeto não encontrado");

  const data = schema.parse(input);

  const projeto = await prisma.projeto.update({
    where: { id },
    data: {
      cliente_id: data.cliente_id,
      contrato_id: data.contrato_id || null,
      titulo: data.titulo,
      descricao: data.descricao || null,
      data_inicio: data.data_inicio ? parseLocalDate(data.data_inicio) : null,
      data_fim: data.data_fim ? parseLocalDate(data.data_fim) : null,
      e_centro_custo: data.e_centro_custo ?? false,
      ...(input.status && { status: input.status as any }),
    },
  });

  await sincronizarCcDoProjeto(id, data.titulo, data.e_centro_custo ?? false, empresaId);

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/financeiro/centros-custo");
  return { data: projeto };
}

export async function excluirProjeto(id: string) {
  await verificarPermissao("projetos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.projeto.findFirst({ where: { id, empresa_id: empresaId } });
  if (!existente) throw new Error("Projeto não encontrado");

  await prisma.projeto.delete({ where: { id } });

  revalidatePath("/projetos");
  return { data: null };
}
