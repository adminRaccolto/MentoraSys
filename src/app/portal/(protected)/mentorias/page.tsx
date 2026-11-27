import { redirect } from "next/navigation";
import { CabecalhoMentorias, caixa, LinhaMentoria, paginaMentorias, Vazio } from "@/components/mentorias/painel";
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
    <div className={`space-y-5 ${paginaMentorias}`}>
      <CabecalhoMentorias titulo="Minhas mentorias" contexto="Portal do aluno" />
      <section className={caixa} aria-labelledby="mentorias-disponiveis">
        <h2 id="mentorias-disponiveis" className="text-xl font-semibold tracking-tight">Mentorias disponíveis</h2>
        {!alunos.length && <Vazio>Nenhuma mentoria disponível para seu acesso.</Vazio>}
        <ul className="divide-y divide-[#e8edef]">
          {alunos.map(({ mentoria }) => (
            <li key={mentoria.id}>
              <LinhaMentoria href={`/portal/mentorias/${mentoria.id}`} nome={mentoria.nome} grupo={mentoria.tipo === "GRUPO"}
                turma={mentoria.turma} descricao={mentoria.descricao} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
