import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { urlOpcional } from "@/lib/mentorias";

const textoId = z.union([z.string(), z.number()]).transform(String);

const eventoZoom = z.object({
  event: z.string(),
  payload: z.object({
    plainToken: z.string().max(256).optional(),
    account_id: z.string().optional(),
    object: z.object({
      id: textoId,
      share_url: urlOpcional.nullish(),
      participant: z.object({
        email: z.string().nullish(),
        user_email: z.string().nullish(),
        join_time: z.string().nullish(),
      }).optional(),
    }).optional(),
  }),
});

export async function POST(request: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret || !process.env.ZOOM_EMPRESA_ID || !process.env.ZOOM_ACCOUNT_ID) return new Response(null, { status: 503 });

  const timestamp = request.headers.get("x-zm-request-timestamp") ?? "";
  const assinatura = request.headers.get("x-zm-signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^v0=[a-f0-9]{64}$/.test(assinatura)) {
    return new Response(null, { status: 401 });
  }
  const corpo = await request.text();
  const hash = (mensagem: string) => createHmac("sha256", secret).update(mensagem).digest("hex");
  if (!timingSafeEqual(Buffer.from(assinatura.slice(3), "hex"), Buffer.from(hash(`v0:${timestamp}:${corpo}`), "hex"))) {
    return new Response(null, { status: 401 });
  }

  let dados: unknown;
  try {
    dados = JSON.parse(corpo);
  } catch {
    return new Response(null, { status: 400 });
  }
  const validado = eventoZoom.safeParse(dados);
  if (!validado.success) return new Response(null, { status: 400 });
  const { event, payload } = validado.data;
  if (event === "endpoint.url_validation" && payload.plainToken) {
    return Response.json({ plainToken: payload.plainToken, encryptedToken: hash(payload.plainToken) });
  }

  if (payload.account_id !== process.env.ZOOM_ACCOUNT_ID || !payload.object) return new Response(null, { status: 204 });
  if (event !== "meeting.participant_joined" && event !== "recording.completed") return new Response(null, { status: 204 });
  const encontro = await prisma.mentoriaEncontro.findUnique({
    where: { zoom_id: payload.object.id, status: { not: "CANCELADO" }, mentoria: { empresa_id: process.env.ZOOM_EMPRESA_ID } },
    select: { id: true, mentoria_id: true, mentoria: { select: { tipo: true } } },
  });
  if (!encontro) return new Response(null, { status: 204 });

  if (event === "recording.completed" && payload.object.share_url) {
    await prisma.mentoriaEncontro.updateMany({
      where: { id: encontro.id, status: { not: "CANCELADO" } },
      data: { zoom_gravacao: payload.object.share_url },
    });
  }
  if (event === "meeting.participant_joined" && encontro.mentoria.tipo === "GRUPO") {
    const participante = payload.object.participant;
    const email = (participante?.email || participante?.user_email)?.trim();
    const entrada = new Date(participante?.join_time ?? "");
    if (email && Number.isFinite(entrada.getTime())) {
      const alunos = await prisma.mentoriaAluno.findMany({
        where: { mentoria_id: encontro.mentoria_id, ativo: true, cliente: { email: { equals: email, mode: "insensitive" } } },
        select: { id: true },
        take: 2,
      });
      if (alunos.length === 1) {
        const chave = { encontro_id: encontro.id, aluno_id: alunos[0].id };
        await prisma.$transaction([
          prisma.mentoriaPresenca.createMany({ data: { ...chave, entrada_zoom_em: entrada }, skipDuplicates: true }),
          prisma.mentoriaPresenca.updateMany({
            where: { ...chave, OR: [{ entrada_zoom_em: null }, { entrada_zoom_em: { gt: entrada } }] },
            data: { entrada_zoom_em: entrada },
          }),
        ]);
      }
    }
  }
  return new Response(null, { status: 204 });
}
