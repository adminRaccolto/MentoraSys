import { prisma } from "@/lib/prisma";
import { obterClientePortal } from "@/lib/portal-sessao";
import { empresaMentorias } from "@/lib/mentorias";
import { baixarArquivoMentoria, salvarArquivoMentoria } from "@/lib/mentorias-arquivos";

type Contexto = { params: Promise<{ id: string }> };

async function autorizar(aluno: { ativo: boolean; cliente_id: string; mentoria_id: string; mentoria: { empresa_id: string } }) {
  const cliente = await obterClientePortal();
  if (cliente?.tipo === "ALUNO" && aluno.ativo && aluno.cliente_id === cliente.id &&
      aluno.mentoria.empresa_id === cliente.empresa_id) return true;
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

  return baixarArquivoMentoria(arquivo);
}

export async function POST(request: Request, { params }: Contexto) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const { id } = await params;
  const aluno = await prisma.mentoriaAluno.findUnique({
    where: { id, mentoria: { tipo: "INDIVIDUAL" } },
    include: { mentoria: true },
  });
  if (!aluno || !await autorizar(aluno)) return new Response(null, { status: 404 });

  return salvarArquivoMentoria(request, `${aluno.mentoria.empresa_id}/${aluno.id}`, (arquivo) => (
    prisma.mentoriaArquivo.create({ data: { ...arquivo, aluno_id: aluno.id } })
  ));
}
