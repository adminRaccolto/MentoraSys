import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  TrendingUp,
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowDownCircle className="size-4 text-blue-500" />
            <span className="text-xs font-medium uppercase tracking-wide">A Receber</span>
          </div>
          <p className="text-2xl font-bold">{fmtMoney(aReceber)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">em aberto</p>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="size-4 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Recebido</span>
          </div>
          <p className="text-2xl font-bold">{fmtMoney(recebido)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">neste mês</p>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowUpCircle className="size-4 text-rose-500" />
            <span className="text-xs font-medium uppercase tracking-wide">A Pagar</span>
          </div>
          <p className="text-2xl font-bold">{fmtMoney(aPagar)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">em aberto</p>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className={`size-4 ${saldo >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
            <span className="text-xs font-medium uppercase tracking-wide">Saldo</span>
          </div>
          <p className={`text-2xl font-bold ${saldo < 0 ? "text-rose-600" : ""}`}>
            {fmtMoney(saldo)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">recebido − a pagar</p>
        </div>
      </div>

      {/* Linha 2 — 3 widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funil CRM */}
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="font-semibold text-sm">Funil CRM</h2>
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
                <div key={status} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cor}`} />
                  <span className="text-sm flex-1">{label}</span>
                  <span className="text-sm font-semibold tabular-nums">{qtd}</span>
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
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" />
            <h2 className="font-semibold text-sm">Projetos</h2>
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
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <h2 className="font-semibold text-sm">Próximos 7 dias</h2>
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
