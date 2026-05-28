"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";
import { TipoDiagnostico } from "@/lib/generated/prisma";

const schemaCreate = z.object({
  tipo: z.enum(["SWOT", "CANVAS", "CINCO_W_DOIS_H"]),
  titulo: z.string().min(1, "Título obrigatório"),
  cliente_id: z.string().optional(),
  projeto_id: z.string().optional(),
});

type InputCreate = z.input<typeof schemaCreate>;

export async function criarDiagnostico(input: InputCreate) {
  await verificarPermissao("diagnosticos", "criar");
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = schemaCreate.parse(input);

  const conteudoInicial = conteudoPadrao(data.tipo as TipoDiagnostico);

  const diag = await prisma.diagnostico.create({
    data: {
      empresa_id: empresaId,
      criado_por: user?.id,
      tipo: data.tipo as TipoDiagnostico,
      titulo: data.titulo,
      cliente_id: data.cliente_id || null,
      projeto_id: data.projeto_id || null,
      conteudo: conteudoInicial,
    },
  });

  await registrar({ recurso: "diagnosticos", acao: "criar", registroId: diag.id });
  revalidatePath("/diagnosticos");
  return { ok: true, id: diag.id };
}

export async function salvarConteudo(id: string, conteudo: object) {
  await verificarPermissao("diagnosticos", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.diagnostico.updateMany({
    where: { id, empresa_id: empresaId },
    data: { conteudo },
  });

  return { ok: true };
}

export async function editarDiagnostico(
  id: string,
  input: { titulo: string; cliente_id?: string; projeto_id?: string }
) {
  await verificarPermissao("diagnosticos", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.diagnostico.updateMany({
    where: { id, empresa_id: empresaId },
    data: {
      titulo: input.titulo,
      cliente_id: input.cliente_id || null,
      projeto_id: input.projeto_id || null,
    },
  });

  revalidatePath("/diagnosticos");
  return { ok: true };
}

export async function excluirDiagnostico(id: string) {
  await verificarPermissao("diagnosticos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.diagnostico.deleteMany({ where: { id, empresa_id: empresaId } });

  await registrar({ recurso: "diagnosticos", acao: "excluir", registroId: id });
  revalidatePath("/diagnosticos");
  return { ok: true };
}

function conteudoPadrao(tipo: TipoDiagnostico): object {
  if (tipo === "SWOT") {
    return { forcas: [], fraquezas: [], oportunidades: [], ameacas: [] };
  }
  if (tipo === "CANVAS") {
    return {
      parceiros: "",
      atividades_chave: "",
      recursos_chave: "",
      proposta_valor: "",
      relacionamento: "",
      canais: "",
      segmentos: "",
      estrutura_custos: "",
      fontes_receita: "",
    };
  }
  // CINCO_W_DOIS_H
  return {
    o_que: "",
    por_que: "",
    onde: "",
    quando: "",
    quem: "",
    como: "",
    quanto: "",
  };
}
