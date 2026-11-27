import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import {
  ArrowDownCircle,
  ArrowUpRight,
  Wallet,
  ArrowUpCircle,
  DollarSign,
  Calendar,
  FolderKanban,
  Users,
} from "lucide-react";
import { TarefasEquipeWidget, type KpiUsuarioDash } from "./tarefas-equipe-widget";

function fmtMoney(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const empresaId = await obterEmpresaAtiva();

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
  const em7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    recebiveisPendente,
    recebiveisRecebido,
    contasPagarPendente,
    leads,
    propostas,
    projetos,
    eventosProximos,
    tarefasRaw,
  ] = await Promise.all([
    prisma.recebivel.aggregate({
      where: { empresa_id: empresaId, status: "PENDENTE" },
      _sum: { valor: true },
    }),
    prisma.recebivel.aggregate({
      where: {
        empresa_id: empresaId,
        status: "PAGO",
        data_pagamento: { gte: inicioMes, lte: fimMes },
      },
      _sum: { valor_pago: true },
    }),
    prisma.contaPagar.aggregate({
      where: { empresa_id: empresaId, status: "PENDENTE" },
      _sum: { valor: true },
    }),
    prisma.lead.groupBy({
      by: ["etapa_chave"],
      where: { empresa_id: empresaId },
      _count: { id: true },
    }),
    prisma.proposta.groupBy({
      by: ["status"],
      where: { empresa_id: empresaId },
      _count: { id: true },
    }),
    prisma.projeto.groupBy({
      by: ["status"],
      where: { empresa_id: empresaId },
      _count: { id: true },
    }),
    prisma.evento.findMany({
      where: {
        empresa_id: empresaId,
        inicio: { gte: agora, lte: em7Dias },
      },
      include: { cliente: { select: { nome: true } } },
      orderBy: { inicio: "asc" },
      take: 8,
    }),
    prisma.tarefa.findMany({
      where: { projeto: { empresa_id: empresaId }, status: { not: "CANCELADA" } },
      select: {
        status: true,
        data_prazo: true,
        projeto: { select: { id: true, titulo: true } },
        responsaveis: { select: { usuario: { select: { id: true, nome: true } } } },
        responsavel: { select: { id: true, nome: true } },
      },
    }),
  ]);

  const aReceber = Number(recebiveisPendente._sum.valor ?? 0);
  const recebido = Number(recebiveisRecebido._sum.valor_pago ?? 0);
  const aPagar = Number(contasPagarPendente._sum.valor ?? 0);
  const saldo = recebido - aPagar;

  const leadMap = Object.fromEntries(leads.map((l) => [l.etapa_chave, l._count.id]));
  const propostaMap = Object.fromEntries(propostas.map((p) => [p.status, p._count.id]));
  const projetoMap = Object.fromEntries(projetos.map((p) => [p.status, p._count.id]));

  // Agrega tarefas por colaborador server-side
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const mapaUsuarios = new Map<string, KpiUsuarioDash>();

  for (const t of tarefasRaw) {
    const atrasada =
      !!t.data_prazo && new Date(t.data_prazo) < hoje && t.status !== "CONCLUIDA";
    const responsaveis =
      t.responsaveis.length > 0
        ? t.responsaveis.map((r) => r.usuario)
        : t.responsavel
        ? [t.responsavel]
        : [{ id: "sem-responsavel", nome: "Sem responsável" }];

    for (const r of responsaveis) {
      if (!mapaUsuarios.has(r.id)) {
        mapaUsuarios.set(r.id, {
          id: r.id, nome: r.nome,
          total: 0, concluidas: 0, atrasadas: 0, naoIniciadas: 0, emAndamento: 0,
          porProjeto: [],
        });
      }
      const u = mapaUsuarios.get(r.id)!;
      u.total++;
      if (t.status === "CONCLUIDA") u.concluidas++;
      if (atrasada) u.atrasadas++;
      if (t.status === "PENDENTE") u.naoIniciadas++;
      if (t.status === "EM_ANDAMENTO") u.emAndamento++;

      let proj = u.porProjeto.find((p) => p.projetoId === t.projeto.id);
      if (!proj) {
        proj = { projetoId: t.projeto.id, titulo: t.projeto.titulo, total: 0, concluidas: 0, atrasadas: 0, naoIniciadas: 0, emAndamento: 0 };
        u.porProjeto.push(proj);
      }
      proj.total++;
      if (t.status === "CONCLUIDA") proj.concluidas++;
      if (atrasada) proj.atrasadas++;
      if (t.status === "PENDENTE") proj.naoIniciadas++;
      if (t.status === "EM_ANDAMENTO") proj.emAndamento++;
    }
  }

  const kpisEquipe = Array.from(mapaUsuarios.values()).sort((a, b) => b.total - a.total);
  const totalTarefas = tarefasRaw.length;
  const concluidasTotal = tarefasRaw.filter((t) => t.status === "CONCLUIDA").length;
  const atrasadasTotal = tarefasRaw.filter(
    (t) => !!t.data_prazo && new Date(t.data_prazo) < hoje && t.status !== "CONCLUIDA"
  ).length;
  const naoInidiadasTotal = tarefasRaw.filter((t) => t.status === "PENDENTE").length;
  const emAndamentoTotal = tarefasRaw.filter((t) => t.status === "EM_ANDAMENTO").length;

  const indicadores = [
    { rotulo: "A receber", valor: aReceber, detalhe: "Em aberto", icone: ArrowDownCircle, href: "/financeiro/recebiveis", cor: "bg-[#e7f0ed] text-[#2d6457]" },
    { rotulo: "Recebido", valor: recebido, detalhe: "Neste mês", icone: DollarSign, href: "/financeiro/recebiveis", cor: "bg-[#eaf0df] text-[#50653b]" },
    { rotulo: "A pagar", valor: aPagar, detalhe: "Em aberto", icone: ArrowUpCircle, href: "/financeiro/contas-a-pagar", cor: "bg-[#f5eae5] text-[#8b4e3a]" },
    { rotulo: "Saldo", valor: saldo, detalhe: "Recebido − a pagar", icone: Wallet, href: "/financeiro", cor: "bg-[#f1e8d2] text-[#76582a]" },
  ];
  const dataHoje = agora.toLocaleDateString("pt-BR", { dateStyle: "full", timeZone: "America/Cuiaba" });
  const maiorEtapa = Math.max(1, ...Object.values(leadMap));

  return (
    <div className="mx-auto max-w-[92rem] space-y-6 p-4 sm:p-6 xl:space-y-7 xl:p-8">
      <section className="dashboard-hero grid gap-5 rounded-[1.3rem] border border-[#355347] p-5 text-white sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end xl:p-9" aria-labelledby="titulo-dashboard">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[#ecdab0] sm:text-sm">
            <Calendar className="size-4" aria-hidden />
            <time dateTime={new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "America/Cuiaba" }).format(agora)} className="block first-letter:uppercase">{dataHoje}</time>
          </p>
          <h1 id="titulo-dashboard">Visão geral</h1>
          <p className="max-w-md text-sm leading-relaxed text-[#e0ebe2]">Acompanhe o financeiro, o funil comercial e as próximas entregas da equipe.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/agenda" className="inline-flex items-center gap-2 rounded-lg border border-[#adbfaf]/55 px-3.5 py-2.5 text-sm font-medium hover:bg-white/10">
            <Calendar className="size-4" aria-hidden /> Abrir agenda
          </Link>
          <Link href="/financeiro" className="inline-flex items-center gap-2 rounded-lg bg-[#ead6aa] px-3.5 py-2.5 text-sm font-semibold text-[#283427] hover:bg-[#f3e3c1]">
            Ver financeiro <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="titulo-indicadores">
        <h2 id="titulo-indicadores" className="text-lg font-semibold">Resumo financeiro</h2>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 sm:gap-4 xl:grid-cols-4">
          {indicadores.map(({ rotulo, valor, detalhe, icone: Icon, href, cor }) => (
            <Link href={href} key={rotulo} className="group min-w-0 space-y-2 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${cor}`}><Icon className="size-4" aria-hidden /></span>
                <ArrowUpRight className="hidden size-4 text-muted-foreground group-hover:text-primary sm:block" aria-hidden />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
              <p className={`break-words text-lg leading-tight font-semibold tracking-tight tabular-nums sm:text-2xl ${valor < 0 ? "text-destructive" : ""}`}>{fmtMoney(valor)}</p>
              <p className="text-xs text-muted-foreground">{detalhe}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Linha 2 — 3 widgets */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Funil CRM */}
        <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden />
            <h2 className="flex-1 font-semibold">Funil comercial</h2>
            <Link href="/crm" aria-label="Abrir CRM" className="text-primary hover:underline"><ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="space-y-2">
            {(
              [
                ["NOVO", "Novos leads", "bg-slate-200"],
                ["QUALIFICADO", "Qualificados", "bg-blue-200"],
                ["PROPOSTA", "Com proposta", "bg-amber-200"],
                ["GANHO", "Ganhos", "bg-emerald-200"],
                ["PERDIDO", "Perdidos", "bg-rose-200"],
              ] as const
            ).map(([status, label, cor]) => {
              const qtd = leadMap[status] ?? 0;
              return (
                <div key={status} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-2">
                  <span className="text-sm">{label}</span>
                  <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={`block h-full rounded-full ${cor}`} style={{ width: `${(qtd / maiorEtapa) * 100}%` }} />
                  </span>
                  <span className="min-w-5 text-right text-sm font-semibold tabular-nums">{qtd}</span>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Propostas:{" "}
              <span className="font-medium">
                {propostaMap["ENVIADA"] ?? 0} enviadas ·{" "}
                {propostaMap["ACEITA"] ?? 0} aceitas
              </span>
            </p>
          </div>
        </div>

        {/* Projetos */}
        <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" aria-hidden />
            <h2 className="flex-1 font-semibold">Projetos</h2>
            <Link href="/projetos" aria-label="Abrir projetos" className="text-primary hover:underline"><ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="space-y-2">
            {(
              [
                ["PLANEJAMENTO", "Planejamento", "bg-slate-200"],
                ["EM_ANDAMENTO", "Em andamento", "bg-blue-200"],
                ["CONCLUIDO", "Concluídos", "bg-emerald-200"],
                ["CANCELADO", "Cancelados", "bg-rose-200"],
              ] as const
            ).map(([status, label, cor]) => {
              const qtd = projetoMap[status] ?? 0;
              const total = projetos.reduce((s, p) => s + p._count.id, 0);
              const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
              return (
                <div key={status} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-1">{label}</span>
                    <span className="text-sm font-semibold tabular-nums">{qtd}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Próximos eventos */}
        <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" aria-hidden />
            <h2 className="flex-1 font-semibold">Próximos 7 dias</h2>
            <Link href="/agenda" aria-label="Ver agenda" className="text-primary hover:underline"><ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          {eventosProximos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum evento agendado.
            </p>
          ) : (
            <div className="space-y-2">
              {eventosProximos.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <div className="mt-0.5 min-w-10 text-center">
                    <p className="text-lg font-bold leading-none">
                      {new Date(ev.inicio).getDate()}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {new Date(ev.inicio).toLocaleDateString("pt-BR", { month: "short" })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.dia_todo
                        ? "Dia todo"
                        : new Date(ev.inicio).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      {ev.cliente && ` · ${ev.cliente.nome}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BI — Tarefas por Colaborador */}
      <TarefasEquipeWidget
        usuarios={kpisEquipe}
        totalGeral={totalTarefas}
        concluidasGeral={concluidasTotal}
        atrasadasGeral={atrasadasTotal}
        naoInidiadasGeral={naoInidiadasTotal}
        emAndamentoGeral={emAndamentoTotal}
      />
    </div>
  );
}
