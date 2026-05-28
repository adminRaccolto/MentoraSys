import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function verificarPermissao(recurso: string, acao: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autenticado");

  const cookieStore = await cookies();
  const empresaId = cookieStore.get("empresa_ativa")?.value;

  if (!empresaId) throw new Error("Nenhuma empresa selecionada");

  const membro = await prisma.membroEmpresa.findUnique({
    where: {
      usuario_id_empresa_id: { usuario_id: user.id, empresa_id: empresaId },
    },
    include: {
      perfil: {
        include: {
          permissoes: {
            include: { permissao: true },
          },
        },
      },
    },
  });

  if (!membro || !membro.ativo) throw new Error("Acesso negado");

  const temPermissao = membro.perfil.permissoes.some(
    (pp) => pp.permissao.recurso === recurso && pp.permissao.acao === acao
  );

  if (!temPermissao) throw new Error(`Sem permissão para ${acao} em ${recurso}`);
}

export async function obterEmpresaAtiva(): Promise<string> {
  const cookieStore = await cookies();
  const empresaId = cookieStore.get("empresa_ativa")?.value;
  if (!empresaId) throw new Error("Nenhuma empresa selecionada");
  return empresaId;
}
