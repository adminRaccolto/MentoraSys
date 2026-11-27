import { prisma } from "@/lib/prisma";
import { alunoMentoria, empresaMentorias } from "@/lib/mentorias";
import { baixarArquivoMentoria, salvarArquivoMentoria } from "@/lib/mentorias-arquivos";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  const material = await prisma.mentoriaMaterial.findUnique({
    where: { id }, include: { mentoria: { select: { empresa_id: true } } },
  });
  if (!material) return new Response(null, { status: 404 });
  if (!await alunoMentoria(material.mentoria_id)) {
    const empresaId = await empresaMentorias().catch(() => null);
    if (empresaId !== material.mentoria.empresa_id) return new Response(null, { status: 404 });
  }
  return baixarArquivoMentoria(material);
}

export async function POST(request: Request, { params }: Contexto) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const [{ id }, empresaId] = await Promise.all([params, empresaMentorias().catch(() => null)]);
  if (!empresaId) return new Response(null, { status: 404 });
  const mentoria = await prisma.mentoria.findUnique({ where: { id, empresa_id: empresaId }, select: { id: true } });
  if (!mentoria) return new Response(null, { status: 404 });
  return salvarArquivoMentoria(request, `${empresaId}/biblioteca/${mentoria.id}`, (arquivo, form) => {
    const categoria = String(form.get("categoria") ?? "").trim().slice(0, 80) || null;
    return prisma.mentoriaMaterial.create({ data: { ...arquivo, categoria, mentoria_id: mentoria.id } });
  });
}
