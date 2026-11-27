import type { Prisma } from "@/lib/generated/prisma";

export async function matricularClienteMentoria(tx: Prisma.TransactionClient, mentoriaId: string, clienteId: string) {
  const chave = { mentoria_id: mentoriaId, cliente_id: clienteId };
  const criada = await tx.mentoriaAluno.createMany({ data: chave, skipDuplicates: true });
  const reativada = criada.count ? null : await tx.mentoriaAluno.updateMany({ where: { ...chave, ativo: false }, data: { ativo: true } });
  const aluno = await tx.mentoriaAluno.findUniqueOrThrow({
    where: { mentoria_id_cliente_id: chave }, select: { id: true },
  });
  return { alunoId: aluno.id, alterada: Boolean(criada.count || reativada?.count) };
}
