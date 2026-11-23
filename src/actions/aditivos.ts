"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrar } from "@/lib/auditoria";
import { criarDocumentoAuthentique } from "@/lib/authentique";
import { gerarHtmlAditivo, tituloAditivo } from "@/lib/aditivo";
import { clausulaReembolsoDoContrato } from "@/lib/clausula-reembolso";
import { gerarClausulaProbono } from "@/lib/clausula-probono";
import { variaveisCliente, fmtCpfCnpj } from "@/lib/variaveis-cliente";
import { logoImgBase64 } from "@/lib/logo-base64";
import { parseLocalDate } from "@/lib/date";

const schemaConteudo = z
  .object({
    contrato_id: z.string().min(1),
    inclui_reembolso: z.boolean(),
    inclui_probono: z.boolean(),
    texto_livre: z.string().optional(),
  })
  .refine((d) => d.inclui_reembolso || d.inclui_probono || !!d.texto_livre?.trim(), {
    message: "Selecione ao menos uma alteração para o aditivo",
  });

type ConteudoInput = z.input<typeof schemaConteudo>;

function fmtTelefone(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

async function montarHtml(empresaId: string, input: z.output<typeof schemaConteudo>, numero: number) {
  const [contrato, empresa] = await Promise.all([
    prisma.contrato.findFirst({ where: { id: input.contrato_id, empresa_id: empresaId }, include: { cliente: true } }),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { nome: true, cnpj: true, logo_url: true, configuracoes: true } }),
  ]);
  if (!contrato) return { error: "Contrato não encontrado" } as const;
  if (!empresa) return { error: "Empresa não encontrada" } as const;
  if (contrato.status !== "ASSINADO") return { error: "Aditivos só podem ser feitos em contratos assinados" } as const;

  const config = (empresa.configuracoes as Record<string, string>) ?? {};
  const hoje = new Date();

  const clausulaReembolso = input.inclui_reembolso
    ? clausulaReembolsoDoContrato({ ...contrato, reembolso_despesas: true }, config)
    : "";
  const clausulaProbono = input.inclui_probono ? gerarClausulaProbono({ ...contrato, data_inicio: hoje }) : "";
  if (input.inclui_probono && !clausulaProbono) {
    return { error: "Configure a versão e o período na aba Pro Bono Arato do contrato" } as const;
  }

  const cli = variaveisCliente(contrato.cliente, { nome: contrato.cliente_nome, cpf_cnpj: contrato.cliente_cpf_cnpj });

  const html = gerarHtmlAditivo({
    numero,
    data: hoje,
    contrato: { numero: contrato.numero_contrato, titulo: contrato.titulo, assinadoEm: contrato.assinado_em },
    empresa: {
      logoImg: await logoImgBase64(empresa.logo_url),
      razaoSocial: config.razao_social || empresa.nome,
      nomeFantasia: config.nome_fantasia || empresa.nome,
      cnpj: fmtCpfCnpj(empresa.cnpj),
      endereco: config.endereco ?? "",
      cidade: config.cidade ?? "",
      estado: config.estado ?? "",
      representante: config.representante ?? "",
      representanteCargo: config.representante_cargo || "Sócio Administrador",
      representanteCpf: config.representante_cpf ?? "",
      telefone: fmtTelefone(config.telefone),
      email: config.email_contato ?? "",
    },
    cliente: { nome: cli["cliente.nome"], cpfCnpj: cli["cliente.cpf_cnpj"], endereco: cli["cliente.endereco"] },
    clausulaReembolso,
    clausulaProbono,
    textoLivre: input.texto_livre ?? null,
  });

  return { html, contrato } as const;
}

async function proximoNumero(contratoId: string) {
  const ultimo = await prisma.contratoAditivo.aggregate({ where: { contrato_id: contratoId }, _max: { numero: true } });
  return (ultimo._max.numero ?? 0) + 1;
}

export async function listarAditivos(contratoId: string) {
  await verificarPermissao("contratos", "visualizar");
  const empresaId = await obterEmpresaAtiva();
  return prisma.contratoAditivo.findMany({
    where: { contrato_id: contratoId, empresa_id: empresaId },
    select: {
      id: true,
      numero: true,
      inclui_reembolso: true,
      inclui_probono: true,
      texto_livre: true,
      status: true,
      authentique_url: true,
      pdf_assinado_url: true,
      assinado_em: true,
      criado_em: true,
    },
    orderBy: { numero: "asc" },
  });
}

export async function previaAditivo(input: ConteudoInput) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const parsed = schemaConteudo.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const r = await montarHtml(empresaId, parsed.data, await proximoNumero(parsed.data.contrato_id));
  if ("error" in r) return { ok: false as const, error: r.error };
  return { ok: true as const, html: r.html };
}

export async function criarAditivo(input: ConteudoInput) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const parsed = schemaConteudo.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const numero = await proximoNumero(data.contrato_id);
  const r = await montarHtml(empresaId, data, numero);
  if ("error" in r) return { ok: false as const, error: r.error };

  const aditivo = await prisma.contratoAditivo.create({
    data: {
      empresa_id: empresaId,
      contrato_id: data.contrato_id,
      criado_por: user?.id,
      numero,
      inclui_reembolso: data.inclui_reembolso,
      inclui_probono: data.inclui_probono,
      texto_livre: data.texto_livre?.trim() || null,
      conteudo: r.html,
    },
  });

  await registrar({ recurso: "contratos", acao: "criar_aditivo", registroId: data.contrato_id, detalhes: { aditivo_id: aditivo.id, numero } });
  revalidatePath("/contratos");
  return { ok: true as const, id: aditivo.id };
}

const schemaEnviar = z.object({
  aditivo_id: z.string().min(1),
  email_empresa: z.string().email("E-mail da empresa inválido"),
  nome_empresa: z.string().min(1, "Nome do representante obrigatório"),
  email_cliente: z.string().email("E-mail do cliente inválido"),
  nome_cliente: z.string().min(1, "Nome do cliente obrigatório"),
});

export async function enviarAditivoParaAssinatura(input: z.input<typeof schemaEnviar>) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const parsed = schemaEnviar.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const aditivo = await prisma.contratoAditivo.findFirst({
    where: { id: data.aditivo_id, empresa_id: empresaId },
    include: { contrato: { select: { numero_contrato: true } } },
  });
  if (!aditivo?.conteudo) return { ok: false as const, error: "Aditivo não encontrado" };
  if (aditivo.status !== "RASCUNHO") return { ok: false as const, error: "Este aditivo já foi enviado" };

  let doc: Awaited<ReturnType<typeof criarDocumentoAuthentique>>;
  try {
    doc = await criarDocumentoAuthentique({
      nome: tituloAditivo(aditivo.numero, aditivo.contrato.numero_contrato),
      htmlContent: aditivo.conteudo,
      signatarios: [
        { email: data.email_empresa, nome: data.nome_empresa },
        { email: data.email_cliente, nome: data.nome_cliente },
      ],
    });
  } catch (e: unknown) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erro ao criar documento no Autentique" };
  }

  await prisma.contratoAditivo.update({
    where: { id: aditivo.id },
    data: { status: "AGUARDANDO_ASSINATURA", authentique_id: doc.id, authentique_url: doc.signatarios[0]?.link ?? null },
  });

  await registrar({
    recurso: "contratos",
    acao: "enviar_aditivo_assinatura",
    registroId: aditivo.contrato_id,
    detalhes: { aditivo_id: aditivo.id, authentique_id: doc.id },
  });
  revalidatePath("/contratos");
  return { ok: true as const };
}

export async function marcarAditivoAssinado(id: string, dataAssinatura: string) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const aditivo = await prisma.contratoAditivo.findFirst({ where: { id, empresa_id: empresaId } });
  if (!aditivo) return { ok: false as const, error: "Aditivo não encontrado" };
  if (aditivo.status === "ASSINADO" || aditivo.status === "CANCELADO") {
    return { ok: false as const, error: "Aditivo já finalizado" };
  }

  await prisma.contratoAditivo.update({
    where: { id },
    data: { status: "ASSINADO", assinado_em: dataAssinatura ? parseLocalDate(dataAssinatura) : new Date() },
  });
  await registrar({ recurso: "contratos", acao: "marcar_aditivo_assinado", registroId: aditivo.contrato_id, detalhes: { aditivo_id: id } });
  revalidatePath("/contratos");
  return { ok: true as const };
}

export async function excluirAditivo(id: string) {
  await verificarPermissao("contratos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const aditivo = await prisma.contratoAditivo.findFirst({ where: { id, empresa_id: empresaId } });
  if (!aditivo) return { ok: false as const, error: "Aditivo não encontrado" };
  if (aditivo.status === "ASSINADO") return { ok: false as const, error: "Aditivo assinado não pode ser excluído" };

  await prisma.contratoAditivo.delete({ where: { id } });
  await registrar({ recurso: "contratos", acao: "excluir_aditivo", registroId: aditivo.contrato_id, detalhes: { aditivo_id: id, numero: aditivo.numero } });
  revalidatePath("/contratos");
  return { ok: true as const };
}

export async function conteudoAditivo(id: string) {
  await verificarPermissao("contratos", "visualizar");
  const empresaId = await obterEmpresaAtiva();
  const aditivo = await prisma.contratoAditivo.findFirst({ where: { id, empresa_id: empresaId }, select: { conteudo: true } });
  return aditivo?.conteudo ?? null;
}
