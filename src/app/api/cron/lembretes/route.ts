import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarLembrete } from "@/lib/email";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agora = new Date();

  const eventos = await prisma.evento.findMany({
    where: {
      lembrete_em: { lte: agora },
      lembrete_enviado: false,
    },
    include: {
      responsavel: { select: { email: true, nome: true } },
    },
  });

  let enviados = 0;
  for (const ev of eventos) {
    if (ev.responsavel?.email) {
      await enviarLembrete(ev.responsavel.email, ev.titulo, ev.inicio);
    }
    await prisma.evento.update({
      where: { id: ev.id },
      data: { lembrete_enviado: true },
    });
    enviados++;
  }

  return NextResponse.json({ ok: true, enviados });
}
