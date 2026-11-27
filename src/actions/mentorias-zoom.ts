"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva, verificarPermissao } from "@/lib/permissoes";
import { ErroZoom, obterTokenZoom } from "@/lib/mentorias-zoom";
import { esquemaConfiguracaoZoom, obterConfiguracaoZoom, podeSalvarConfiguracaoZoom, persistirConfiguracaoZoom } from "@/lib/mentorias-zoom-config";

type Resultado = { erro?: string; sucesso?: string };

async function empresaAutorizada() {
  await verificarPermissao("configuracoes", "editar");
  return obterEmpresaAtiva();
}

function erroZoom(erro: unknown): Resultado {
  if (erro instanceof ErroZoom) return { erro: erro.message };
  if (erro instanceof Error && /^(Acesso negado|Sem permissão|Não autenticado|Nenhuma empresa)/.test(erro.message)) {
    return { erro: "Você não tem permissão para configurar o Zoom." };
  }
  return { erro: "Não foi possível concluir a operação do Zoom. Tente novamente." };
}

export async function salvarIntegracaoZoom(_: Resultado, form: FormData): Promise<Resultado> {
  try {
    const empresaId = await empresaAutorizada();
    if (!podeSalvarConfiguracaoZoom()) return { erro: "O armazenamento seguro do Zoom está indisponível." };
    const anterior = await obterConfiguracaoZoom(empresaId);
    const segredo = String(form.get("segredo") ?? "").trim();
    const webhook = String(form.get("webhook") ?? "").trim();
    const conta = String(form.get("conta") ?? "").trim();
    const cliente = String(form.get("cliente") ?? "").trim();
    const mesmoAplicativo = anterior?.conta === conta && anterior?.cliente === cliente;
    if (anterior && !mesmoAplicativo && !segredo) return { erro: "Informe o Client Secret do novo aplicativo." };
    const dados = esquemaConfiguracaoZoom.safeParse({
      conta, cliente, anfitriao: form.get("anfitriao"),
      segredo: segredo || anterior?.segredo,
      webhook: webhook || (mesmoAplicativo ? anterior?.webhook : undefined),
    });
    if (!dados.success) return { erro: "Confira o Account ID, o Client ID, o Client Secret e o anfitrião." };
    if (anterior?.conta && anterior.conta !== dados.data.conta) {
      const sala = await prisma.mentoriaEncontro.findFirst({
        where: {
          status: "AGENDADO", mentoria: { empresa_id: empresaId },
          OR: [{ zoom_id: { not: null } }, { zoom_pendente: { not: null } }],
        },
        select: { id: true },
      });
      if (sala) return { erro: "Encerre as reuniões Zoom agendadas antes de trocar a conta." };
    }
    await persistirConfiguracaoZoom(empresaId, dados.data);
    revalidatePath("/mentorias/integracao-zoom");
    revalidatePath("/mentorias/[id]", "page");
    return { sucesso: "Configuração Zoom salva." };
  } catch (erro) {
    return erroZoom(erro);
  }
}

export async function testarIntegracaoZoom(): Promise<Resultado> {
  try {
    const empresaId = await empresaAutorizada();
    const configuracao = await obterConfiguracaoZoom(empresaId);
    if (!configuracao) return { erro: "Salve a configuração do Zoom primeiro." };
    await obterTokenZoom(configuracao);
    return { sucesso: "O Zoom aceitou as credenciais do aplicativo." };
  } catch (erro) {
    return erroZoom(erro);
  }
}
