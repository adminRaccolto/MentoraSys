import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva, verificarPermissao } from "@/lib/permissoes";
import { obterClientePortal } from "@/lib/portal-sessao";

export const NOME_MESA = "A Mesa das Decisões";

export async function empresaMentorias(acao = "editar") {
  await verificarPermissao("mentorias", acao);
  return obterEmpresaAtiva();
}

export async function alunoMentoria(mentoriaId: string) {
  const cliente = await obterClientePortal();
  if (!cliente || (cliente.mentoria_id && cliente.mentoria_id !== mentoriaId)) return null;
  return prisma.mentoriaAluno.findFirst({
    where: { mentoria_id: mentoriaId, cliente_id: cliente.id, ativo: true, mentoria: { empresa_id: cliente.empresa_id } },
    include: { mentoria: true, cliente: { select: { nome: true } } },
  });
}

export const textoObrigatorio = (max: number) => z.string().trim().min(1, "Preencha os campos obrigatórios.").max(max);
export const textoOpcional = (max: number) => z.string().trim().max(max).transform((s) => s || null);

export const urlOpcional = z.string().trim().max(2048).refine((s) => {
  if (!s) return true;
  try {
    const url = new URL(s);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use um link HTTPS válido.").transform((s) => s || null);

export function localEncontro(data: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Cuiaba", dateStyle: "short", timeStyle: "short",
  }).format(data).replace(" ", "T");
}

export function horarioMentoria(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Cuiaba" }).format(data);
}

export function checkinAberto(encontro: { status: string; inicio: Date; duracao: number }, agora = Date.now()) {
  const inicio = encontro.inicio.getTime();
  return encontro.status === "AGENDADO" && agora >= inicio - 30 * 60_000 && agora <= inicio + encontro.duracao * 60_000;
}

export async function carregarEspacoMentoria(id: string, grupo: boolean, secao: string, buscando: boolean) {
  const [paginas, materiais, itens] = await Promise.all([
    secao === "paginas" || buscando ? prisma.mentoriaPagina.findMany({ where: { mentoria_id: id }, orderBy: { alterada_em: "desc" } }) : [],
    secao === "biblioteca" || buscando ? prisma.mentoriaMaterial.findMany({ where: { mentoria_id: id }, orderBy: [{ categoria: "asc" }, { criado_em: "desc" }] }) : [],
    grupo && (secao === "acompanhamento" || buscando)
      ? prisma.mentoriaItem.findMany({ where: { mentoria_id: id }, orderBy: [{ concluida_em: { sort: "asc", nulls: "first" } }, { prazo: { sort: "asc", nulls: "last" } }, { criado_em: "desc" }] })
      : [],
  ]);

  return { paginas, materiais, itens };
}
