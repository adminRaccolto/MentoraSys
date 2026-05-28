import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";

interface RegistrarParams {
  recurso: string;
  acao: string;
  registroId?: string;
  detalhes?: object;
}

export async function registrar({ recurso, acao, registroId, detalhes }: RegistrarParams) {
  try {
    const empresaId = await obterEmpresaAtiva();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let usuarioNome: string | undefined;
    if (user) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: user.id },
        select: { nome: true },
      });
      usuarioNome = usuario?.nome;
    }

    await prisma.registroAuditoria.create({
      data: {
        empresa_id: empresaId,
        usuario_id: user?.id,
        usuario_nome: usuarioNome,
        recurso,
        acao,
        registro_id: registroId,
        detalhes: detalhes ? (detalhes as object) : undefined,
      },
    });
  } catch {
    // Auditoria não deve bloquear a operação principal
  }
}
