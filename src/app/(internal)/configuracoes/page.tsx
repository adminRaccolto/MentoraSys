import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import ConfiguracoesClient from "./configuracoes-client";

export default async function ConfiguracoesPage() {
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [empresa, usuario] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nome: true, cnpj: true, logo_url: true, plano: true, configuracoes: true },
    }),
    user
      ? prisma.usuario.findUnique({
          where: { id: user.id },
          select: { id: true, nome: true, email: true, avatar_url: true },
        })
      : null,
  ]);

  if (!empresa) return null;

  const config = (empresa.configuracoes as Record<string, string>) ?? {};

  return (
    <ConfiguracoesClient
      empresa={{
        id: empresa.id,
        nome: empresa.nome,
        cnpj: empresa.cnpj ?? "",
        logo_url: empresa.logo_url ?? "",
        plano: empresa.plano,
        telefone: config.telefone ?? "",
        email_contato: config.email_contato ?? "",
        endereco: config.endereco ?? "",
        cidade: config.cidade ?? "",
        estado: config.estado ?? "",
        site: config.site ?? "",
      }}
      usuario={usuario ? {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatar_url: usuario.avatar_url ?? "",
      } : null}
    />
  );
}
