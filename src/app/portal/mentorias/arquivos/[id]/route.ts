import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterClientePortal } from "@/lib/portal-sessao";
import { empresaMentorias } from "@/lib/mentorias";
import { arquivosMentoria, LIMITE_ARQUIVO, prepararArquivosMentoria, TIPOS_ARQUIVO } from "@/lib/mentorias-arquivos";

type Contexto = { params: Promise<{ id: string }> };

async function autorizar(aluno: { ativo: boolean; cliente_id: string; mentoria_id: string; mentoria: { empresa_id: string } }) {
  const cliente = await obterClientePortal();
  if (aluno.ativo && aluno.cliente_id === cliente?.id && aluno.mentoria.empresa_id === cliente.empresa_id &&
    (!cliente.mentoria_id || cliente.mentoria_id === aluno.mentoria_id)) return true;
  try {
    return aluno.mentoria.empresa_id === await empresaMentorias();
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  const arquivo = await prisma.mentoriaArquivo.findUnique({
    where: { id, aluno: { mentoria: { tipo: "INDIVIDUAL" } } },
    include: { aluno: { include: { mentoria: true } } },
  });
  if (!arquivo || !await autorizar(arquivo.aluno)) return new Response(null, { status: 404 });

  const { data, error } = await arquivosMentoria.createSignedUrl(arquivo.caminho, 60, { download: arquivo.nome });
  if (error) return Response.json({ erro: "Arquivo temporariamente indisponível." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request, { params }: Contexto) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const { id } = await params;
  const aluno = await prisma.mentoriaAluno.findUnique({
    where: { id, mentoria: { tipo: "INDIVIDUAL" } },
    include: { mentoria: true },
  });
  if (!aluno || !await autorizar(aluno)) return new Response(null, { status: 404 });

  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size < 1 || arquivo.size > LIMITE_ARQUIVO) {
      return Response.json({ erro: "Selecione um arquivo de até 4 MB." }, { status: 400 });
    }
    const nome = arquivo.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(-180);
    const extensao = nome.split(".").pop()?.toLowerCase();
    if (!extensao || !Object.hasOwn(TIPOS_ARQUIVO, extensao)) {
      return Response.json({ erro: "Formato de arquivo não aceito." }, { status: 400 });
    }
    const caminho = `${aluno.mentoria.empresa_id}/${aluno.id}/${randomUUID()}.${extensao}`;
    await prepararArquivosMentoria();
    const { error } = await arquivosMentoria.upload(caminho, arquivo, {
      contentType: TIPOS_ARQUIVO[extensao as keyof typeof TIPOS_ARQUIVO],
      upsert: false,
    });
    if (error) throw error;

    try {
      await prisma.mentoriaArquivo.create({ data: { aluno_id: aluno.id, nome, caminho, tamanho: arquivo.size } });
    } catch (erro) {
      await arquivosMentoria.remove([caminho]);
      throw erro;
    }
    return Response.json({ sucesso: "Documento anexado." }, { status: 201 });
  } catch (erro) {
    console.error("Falha ao anexar documento da mentoria", erro instanceof Error ? erro.name : typeof erro);
    return Response.json({ erro: "Não foi possível anexar o documento." }, { status: 500 });
  }
}
