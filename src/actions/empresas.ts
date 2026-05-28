"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
});

export async function criarEmpresa(input: z.input<typeof schema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const data = schema.parse(input);

  const slug = data.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const slugUnico = `${slug}-${Date.now()}`;

  const empresa = await prisma.$transaction(async (tx) => {
    const novaEmpresa = await tx.empresa.create({
      data: { nome: data.nome, slug: slugUnico, cnpj: data.cnpj || null },
    });

    // Busca todas as permissões para criar perfil Administrador com acesso total
    const permissoes = await tx.permissao.findMany();

    const perfil = await tx.perfil.create({
      data: {
        empresa_id: novaEmpresa.id,
        nome: "Administrador",
        descricao: "Acesso total ao sistema",
      },
    });

    if (permissoes.length > 0) {
      await tx.perfilPermissao.createMany({
        data: permissoes.map((p) => ({
          perfil_id: perfil.id,
          permissao_id: p.id,
        })),
      });
    }

    // Garante que o usuário existe na tabela usuarios
    await tx.usuario.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, nome: user.email ?? "Usuário", email: user.email ?? "" },
    });

    await tx.membroEmpresa.create({
      data: { usuario_id: user.id, empresa_id: novaEmpresa.id, perfil_id: perfil.id },
    });

    return novaEmpresa;
  });

  return { ok: true, empresaId: empresa.id } as const;
}
