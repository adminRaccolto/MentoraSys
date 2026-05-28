import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import ConfiguracoesClient from "./configuracoes-client";

export default async function ConfiguracoesPage() {
  const empresaId = await obterEmpresaAtiva();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [empresa, usuario, membros, perfisComPermissoes, convitesPendentes, minhasEmpresas] = await Promise.all([
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
    prisma.membroEmpresa.findMany({
      where: { empresa_id: empresaId },
      include: {
        usuario: { select: { id: true, nome: true, email: true, avatar_url: true } },
        perfil: { select: { id: true, nome: true } },
      },
      orderBy: { criado_em: "asc" },
    }),
    prisma.perfil.findMany({
      where: { empresa_id: empresaId },
      include: {
        permissoes: {
          include: { permissao: { select: { recurso: true, acao: true } } },
        },
        _count: { select: { membros: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.conviteEmpresa.findMany({
      where: { empresa_id: empresaId, aceito_em: null, expira_em: { gt: new Date() } },
      select: { id: true, email: true, criado_em: true, expira_em: true },
      orderBy: { criado_em: "desc" },
    }),
    user
      ? prisma.membroEmpresa.findMany({
          where: { usuario_id: user.id },
          include: {
            empresa: { select: { id: true, nome: true, logo_url: true, plano: true } },
          },
          orderBy: { criado_em: "asc" },
        })
      : [],
  ]);

  if (!empresa) return null;

  const config = (empresa.configuracoes as Record<string, string>) ?? {};

  const perfis = perfisComPermissoes.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? "",
    membros: p._count.membros,
    permissoes: p.permissoes.map((pp) => ({
      recurso: pp.permissao.recurso,
      acao: pp.permissao.acao,
    })),
  }));

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
      membros={membros.map((m) => ({
        id: m.id,
        ativo: m.ativo,
        usuario: m.usuario,
        perfil: m.perfil,
      }))}
      perfis={perfis}
      convitesPendentes={convitesPendentes.map((c) => ({
        id: c.id,
        email: c.email,
        criado_em: c.criado_em.toISOString(),
        expira_em: c.expira_em.toISOString(),
      }))}
      usuarioAtualId={user?.id ?? null}
      empresaAtualId={empresaId}
      minhasEmpresas={minhasEmpresas.map((m) => ({
        id: m.empresa.id,
        nome: m.empresa.nome,
        logo_url: m.empresa.logo_url ?? null,
        plano: m.empresa.plano,
      }))}
    />
  );
}
