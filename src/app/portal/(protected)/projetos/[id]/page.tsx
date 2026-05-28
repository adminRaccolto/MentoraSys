import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, CheckCircle2, Circle, Download, FileText } from "lucide-react";

const STATUS_ETAPA = {
  PENDENTE: { label: "Pendente", variant: "secondary" as const },
  EM_ANDAMENTO: { label: "Em Andamento", variant: "default" as const },
  CONCLUIDA: { label: "Concluída", variant: "outline" as const },
  CANCELADA: { label: "Cancelada", variant: "destructive" as const },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PortalProjetoPage({ params }: Props) {
  const { id } = await params;

  const cookieStore = await cookies();
  const clienteId = cookieStore.get("portal_cliente")?.value;
  if (!clienteId) redirect("/portal/acesso");

  const projeto = await prisma.projeto.findUnique({
    where: { id, cliente_id: clienteId },
    include: {
      etapas: {
        orderBy: { ordem: "asc" },
        include: {
          tarefas: {
            orderBy: { criado_em: "asc" },
            select: { id: true, titulo: true, status: true, data_prazo: true },
          },
        },
      },
      documentos: {
        orderBy: { criado_em: "desc" },
        select: {
          id: true,
          titulo: true,
          arquivo_url: true,
          arquivo_nome: true,
          arquivo_tamanho: true,
          criado_em: true,
        },
      },
    },
  });

  if (!projeto) notFound();

  const todasTarefas = projeto.etapas.flatMap((e) => e.tarefas);
  const concluidas = todasTarefas.filter((t) => t.status === "CONCLUIDA").length;
  const total = todasTarefas.length;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="size-4" /> Voltar aos projetos
        </Link>
        <h1 className="text-2xl font-semibold">{projeto.titulo}</h1>
        {projeto.descricao && (
          <p className="text-muted-foreground mt-1">{projeto.descricao}</p>
        )}
      </div>

      {total > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progresso geral</span>
            <span className="text-muted-foreground">
              {concluidas}/{total} tarefas concluídas ({pct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-medium">Etapas</h2>
        {projeto.etapas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
        ) : (
          projeto.etapas.map((etapa) => {
            const cfg = STATUS_ETAPA[etapa.status as keyof typeof STATUS_ETAPA];
            const etapaConcluidas = etapa.tarefas.filter((t) => t.status === "CONCLUIDA").length;

            return (
              <div key={etapa.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{etapa.titulo}</span>
                    {etapa.tarefas.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {etapaConcluidas}/{etapa.tarefas.length}
                      </span>
                    )}
                  </div>
                  <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                </div>

                {etapa.tarefas.length > 0 && (
                  <div className="divide-y divide-border">
                    {etapa.tarefas.map((tarefa) => (
                      <div key={tarefa.id} className="flex items-center gap-3 px-4 py-2.5">
                        {tarefa.status === "CONCLUIDA" ? (
                          <CheckCircle2 className="size-4 text-primary shrink-0" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <span
                          className={`text-sm flex-1 ${tarefa.status === "CONCLUIDA" ? "line-through text-muted-foreground" : ""}`}
                        >
                          {tarefa.titulo}
                        </span>
                        {tarefa.data_prazo && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {projeto.documentos.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Documentos</h2>
          <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
            {projeto.documentos.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.arquivo_tamanho)} ·{" "}
                    {new Date(doc.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <a
                  href={doc.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
                >
                  <Download className="size-3.5" /> Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
