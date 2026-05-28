"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

export async function marcarLida(id: string) {
  const empresaId = await obterEmpresaAtiva();

  await prisma.notificacao.updateMany({
    where: { id, empresa_id: empresaId },
    data: { lida: true, lida_em: new Date() },
  });

  revalidatePath("/");
  return { ok: true };
}

export async function marcarTodasLidas() {
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await prisma.notificacao.updateMany({
    where: {
      empresa_id: empresaId,
      lida: false,
      OR: [{ usuario_id: user?.id }, { usuario_id: null }],
    },
    data: { lida: true, lida_em: new Date() },
  });

  revalidatePath("/");
  return { ok: true };
}
