import { prisma } from "@/lib/prisma";

interface CriarNotificacaoParams {
  empresa_id: string;
  usuario_id?: string | null;
  tipo: string;
  titulo: string;
  mensagem?: string;
  url?: string;
}

export async function criarNotificacao(params: CriarNotificacaoParams) {
  try {
    await prisma.notificacao.create({
      data: {
        empresa_id: params.empresa_id,
        usuario_id: params.usuario_id ?? null,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        url: params.url,
      },
    });
  } catch {
    // Notificação não deve bloquear a operação principal
  }
}
