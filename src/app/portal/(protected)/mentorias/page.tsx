import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { caixa, Vazio } from "@/components/mentorias/painel";
import { obterClientePortal } from "@/lib/portal-sessao";
import { prisma } from "@/lib/prisma";

export default async function MentoriasDoAluno() {
  const cliente = await obterClientePortal();
  if (!cliente) redirect("/portal/acesso");
  const alunos = await prisma.mentoriaAluno.findMany({
    where: { cliente_id: cliente.id, ativo: true, mentoria_id: cliente.mentoria_id ?? undefined, mentoria: { empresa_id: cliente.empresa_id } },
    include: { mentoria: true },
    orderBy: { criado_em: "desc" },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <GraduationCap aria-hidden className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold">Minhas mentorias</h1>
      </header>
      {!alunos.length && <Vazio>Nenhuma mentoria disponível para seu acesso.</Vazio>}
      {alunos.map(({ mentoria }) => (
        <Link href={`/portal/mentorias/${mentoria.id}`} key={mentoria.id} className={`block ${caixa} hover:border-primary`}>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="secondary">{mentoria.tipo === "GRUPO" ? "Em grupo" : "Individual"}</Badge>
              <h2 className="font-semibold">{mentoria.nome}{mentoria.turma && ` · ${mentoria.turma}`}</h2>
            </div>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-primary" />
          </div>
          {mentoria.descricao && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{mentoria.descricao}</p>}
        </Link>
      ))}
    </div>
  );
}
