import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);
  const em7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  // Recebíveis vencendo em até 3 dias
  const recebiveisVencendo = await prisma.recebivel.findMany({
    where: {
      status: "PENDENTE",
      data_vencimento: { gte: agora, lte: em3Dias },
    },
    select: { id: true, empresa_id: true, descricao: true, valor: true, data_vencimento: true },
  });

  for (const r of recebiveisVencendo) {
    const chave = `recebivel_vencendo:${r.id}`;
    const jaExiste = await prisma.notificacao.findFirst({
      where: { empresa_id: r.empresa_id, tipo: chave },
    });
    if (!jaExiste) {
      await criarNotificacao({
        empresa_id: r.empresa_id,
        tipo: chave,
        titulo: "Recebível vencendo em breve",
        mensagem: `"${r.descricao}" vence em ${r.data_vencimento.toLocaleDateString("pt-BR")}.`,
        url: "/financeiro/recebiveis",
      });
    }
  }

  // Contratos vencendo em até 7 dias
  const contratosVencendo = await prisma.contrato.findMany({
    where: {
      status: { not: "CANCELADO" },
      data_fim: { gte: agora, lte: em7Dias },
    },
    select: { id: true, empresa_id: true, titulo: true, data_fim: true },
  });

  for (const c of contratosVencendo) {
    const chave = `contrato_vencendo:${c.id}`;
    const jaExiste = await prisma.notificacao.findFirst({
      where: { empresa_id: c.empresa_id, tipo: chave },
    });
    if (!jaExiste) {
      await criarNotificacao({
        empresa_id: c.empresa_id,
        tipo: chave,
        titulo: "Contrato próximo do vencimento",
        mensagem: `"${c.titulo}" vence em ${c.data_fim!.toLocaleDateString("pt-BR")}.`,
        url: "/contratos",
      });
    }
  }

  // Eventos nas próximas 24h
  const eventosProximos = await prisma.evento.findMany({
    where: {
      inicio: { gte: agora, lte: em24h },
    },
    select: { id: true, empresa_id: true, titulo: true, inicio: true, responsavel_id: true },
  });

  for (const ev of eventosProximos) {
    const chave = `evento_proximo:${ev.id}`;
    const jaExiste = await prisma.notificacao.findFirst({
      where: { empresa_id: ev.empresa_id, tipo: chave },
    });
    if (!jaExiste) {
      await criarNotificacao({
        empresa_id: ev.empresa_id,
        usuario_id: ev.responsavel_id,
        tipo: chave,
        titulo: "Evento em breve",
        mensagem: `"${ev.titulo}" começa às ${ev.inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
        url: "/agenda",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    recebiveisVencendo: recebiveisVencendo.length,
    contratosVencendo: contratosVencendo.length,
    eventosProximos: eventosProximos.length,
  });
}
