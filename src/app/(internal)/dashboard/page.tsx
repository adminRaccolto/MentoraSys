import Image from "next/image";
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
  const fuso = "America/Cuiaba";
  const dataHoje = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: fuso }).format(agora);
  const dataISO = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: fuso }).format(agora);
  const formatoDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: fuso });
  const formatoMes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: fuso });
  const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso });
  const etapasPainel = [
    ["NOVO", "Novos leads", "bg-slate-500"],
    ["CONTATO", "Em contato", "bg-sky-600"],
    ["QUALIFICADO", "Qualificados", "bg-blue-600"],
    ["PROPOSTA", "Com proposta", "bg-amber-500"],
    ["NEGOCIACAO", "Em negociação", "bg-orange-500"],
    ["GANHO", "Ganhos", "bg-emerald-600"],
    ["PERDIDO", "Perdidos", "bg-rose-500"],
  ] as const;
  const statusProjetos = [
    ["PLANEJAMENTO", "Planejamento", "bg-slate-500"],
    ["EM_ANDAMENTO", "Em andamento", "bg-blue-600"],
    ["CONCLUIDO", "Concluídos", "bg-emerald-600"],
    ["CANCELADO", "Cancelados", "bg-rose-500"],
  ] as const;
  const maiorEtapa = Math.max(1, ...etapasPainel.map(([chave]) => leadMap[chave] ?? 0));

  return (
    <div className="mx-auto max-w-[104rem] space-y-5 p-4 sm:p-6 xl:space-y-6 xl:p-8">
      <section className="dashboard-cover relative isolate overflow-hidden rounded-[1.4rem] text-white" aria-labelledby="titulo-dashboard">
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-[52%] overflow-hidden sm:block">
          <Image src="/login-raccolto-agro.webp" alt="" fill sizes="(max-width: 1280px) 42vw, 640px" className="object-cover object-[center_30%]" loading="eager" />
          <div className="absolute inset-0 bg-linear-to-r from-[#1a3552] via-[#1a3552]/34 to-transparent" />
        </div>
        <div className="max-w-[43rem] space-y-5 p-6 sm:p-8 xl:p-10">
          <p className="flex items-center gap-2 text-sm font-medium text-[#f3dba7]">
            <Calendar className="size-4" aria-hidden />
            <time dateTime={dataISO} className="first-letter:uppercase">{dataHoje}</time>
          </p>
          <h1 id="titulo-dashboard">Visão geral</h1>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/agenda" className="inline-flex items-center gap-2 rounded-lg bg-[#f4dfac] px-4 py-2.5 text-sm font-semibold text-[#192c44] hover:bg-[#ffedc5]">
              Abrir agenda <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link href="/financeiro" className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-[#18334f]/65 px-4 py-2.5 text-sm font-medium hover:bg-[#29476a]">
              Ver financeiro <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-panel" aria-labelledby="titulo-indicadores">
        <div className="flex items-center gap-2 px-4 py-4 sm:px-6">
          <Wallet className="size-4 text-primary" aria-hidden />
          <h2 id="titulo-indicadores" className="text-base font-semibold">Resumo financeiro</h2>
        </div>
        <div className="grid grid-cols-2 gap-px border-t bg-border min-[1170px]:grid-cols-4">
          {indicadores.map(({ rotulo, valor, detalhe, icone: Icon, href, cor }) => (
            <div key={rotulo} className="min-w-0 bg-card">
              <Link href={href} className="group grid h-full gap-1.5 p-3.5 hover:bg-secondary/50 sm:p-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-md ${cor}`}><Icon className="size-4" aria-hidden /></span>
                  <span className="flex-1">{rotulo}</span>
                  <ArrowUpRight className="hidden size-4 text-muted-foreground group-hover:text-primary sm:block" aria-hidden />
                </p>
                <p className={`break-words pt-1.5 text-[clamp(1rem,2.1vw,1.95rem)] leading-tight font-semibold tracking-tight tabular-nums ${valor < 0 ? "text-destructive" : ""}`}>{fmtMoney(valor)}</p>
                <p className="text-xs text-muted-foreground">{detalhe}</p>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 min-[1170px]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:gap-6">
        <div className="grid gap-5 min-[1170px]:col-start-2 min-[1170px]:row-start-1 xl:gap-6">
          <section className="dashboard-panel" aria-labelledby="titulo-agenda">
            <div className="flex items-center gap-2 border-b bg-[#eaf0f9] px-4 py-4 sm:px-5">
              <Calendar className="size-4 text-primary" aria-hidden />
              <div className="flex-1">
                <h2 id="titulo-agenda" className="font-semibold">Agenda</h2>
                <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
              </div>
              <Link href="/agenda" aria-label="Ver agenda" className="rounded-md p-1 text-primary hover:bg-white"><ArrowUpRight className="size-4" aria-hidden /></Link>
            </div>
            {eventosProximos.length === 0 ? (
              <p className="px-4 py-7 text-sm text-muted-foreground sm:px-5">Nenhum evento agendado.</p>
            ) : (
              <ul className="divide-y px-4 sm:px-5">
                {eventosProximos.map((evento) => (
                  <li key={evento.id} className="flex items-center gap-3 py-3">
                    <time dateTime={evento.inicio.toISOString()} className="grid w-12 shrink-0 justify-items-center rounded-lg bg-secondary px-1 py-2 font-semibold text-primary">
                      <span className="text-lg leading-none tabular-nums">{formatoDia.format(evento.inicio)}</span>
                      <span className="mt-0.5 text-[10px] uppercase">{formatoMes.format(evento.inicio).replace(".", "")}</span>
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold wrap-break-word">{evento.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{evento.dia_todo ? "Dia todo" : formatoHora.format(evento.inicio)}{evento.cliente && ` · ${evento.cliente.nome}`}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="dashboard-panel" aria-labelledby="titulo-projetos">
            <div className="flex items-center gap-2 border-b px-4 py-4 sm:px-5">
              <FolderKanban className="size-4 text-primary" aria-hidden />
              <h2 id="titulo-projetos" className="flex-1 font-semibold">Projetos</h2>
              <Link href="/projetos" aria-label="Abrir projetos" className="rounded-md p-1 text-primary hover:bg-secondary"><ArrowUpRight className="size-4" aria-hidden /></Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-4 sm:p-5">
              {statusProjetos.map(([status, label, cor]) => (
                <div key={status} className="min-w-0 rounded-lg bg-secondary/55 px-2.5 py-3.5">
                  <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground">
                    <span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${cor}`} />{label}
                  </p>
                  <p className="mt-1.5 text-2xl leading-none font-semibold tabular-nums">{projetoMap[status] ?? 0}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="grid gap-5 min-[1170px]:col-start-1 min-[1170px]:row-start-1 xl:gap-6">
          <section className="dashboard-panel" aria-labelledby="titulo-funil">
            <div className="flex items-center gap-2 border-b px-4 py-4 sm:px-5">
              <Users className="size-4 text-primary" aria-hidden />
              <h2 id="titulo-funil" className="flex-1 font-semibold">Funil comercial</h2>
              <Link href="/crm" aria-label="Abrir CRM" className="rounded-md p-1 text-primary hover:bg-secondary"><ArrowUpRight className="size-4" aria-hidden /></Link>
            </div>
            <div className="grid gap-3 px-4 py-5 sm:px-5">
              {etapasPainel.map(([status, label, cor]) => {
                const qtd = leadMap[status] ?? 0;
                return (
                  <div key={status} className="grid grid-cols-[minmax(0,1fr)_minmax(2rem,1.3fr)_minmax(2ch,auto)] items-center gap-2.5">
                    <span className="text-sm">{label}</span>
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className={`block h-full rounded-full ${cor}`} style={{ width: `${(qtd / maiorEtapa) * 100}%` }} />
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums">{qtd}</span>
                  </div>
                );
              })}
            </div>
            <Link href="/propostas" className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t bg-secondary/45 px-4 py-3 text-xs hover:bg-secondary sm:px-5">
              <span className="font-semibold text-primary">Propostas</span>
              <span className="text-muted-foreground">{propostaMap.ENVIADA ?? 0} enviadas · {propostaMap.ACEITA ?? 0} aceitas</span>
            </Link>
          </section>
          <TarefasEquipeWidget
            usuarios={kpisEquipe}
            totalGeral={totalTarefas}
            concluidasGeral={concluidasTotal}
            atrasadasGeral={atrasadasTotal}
            naoInidiadasGeral={naoInidiadasTotal}
            emAndamentoGeral={emAndamentoTotal}
          />
        </div>
      </div>
    </div>
  );
}
