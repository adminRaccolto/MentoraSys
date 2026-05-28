import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FolderKanban } from "lucide-react";

const STATUS_CONFIG = {
  PLANEJAMENTO: { label: "Planejamento", variant: "secondary" as const },
  EM_ANDAMENTO: { label: "Em Andamento", variant: "default" as const },
  CONCLUIDO: { label: "Concluído", variant: "outline" as const },
  CANCELADO: { label: "Cancelado", variant: "destructive" as const },
};

export default async function PortalPage() {
  const cookieStore = await cookies();
  const clienteId = cookieStore.get("portal_cliente")?.value;
  if (!clienteId) redirect("/portal/acesso");

  const [cliente, projetos] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { nome: true },
    }),
    prisma.projeto.findMany({
      where: { cliente_id: clienteId },
      include: {
        etapas: {
          include: {
            tarefas: { select: { id: true, status: true } },
          },
        },
      },
      orderBy: { criado_em: "desc" },
    }),
  ]);

  if (!cliente) redirect("/portal/acesso");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bem-vindo,</p>
        <h1 className="text-2xl font-semibold">{cliente.nome}</h1>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban className="size-4 text-primary" />
          <h2 className="font-medium">Seus projetos</h2>
          <Badge variant="secondary">{projetos.length}</Badge>
        </div>

        {projetos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum projeto encontrado.</p>
        ) : (
          <div className="space-y-3">
            {projetos.map((p) => {
              const todasTarefas = p.etapas.flatMap((e) => e.tarefas);
              const concluidas = todasTarefas.filter((t) => t.status === "CONCLUIDA").length;
              const total = todasTarefas.length;
              const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
              const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];

              return (
                <Link
                  key={p.id}
                  href={`/portal/projetos/${p.id}`}
                  className="block rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.titulo}</p>
                      {p.data_fim && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Previsão: {new Date(p.data_fim).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
                  </div>

                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso</span>
                        <span>{concluidas}/{total} tarefas</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
