import Link from "next/link";
import { GraduationCap, ChevronRight } from "lucide-react";
import { cadastrarMentoria } from "@/actions/mentorias";
import { Formulario } from "@/components/mentorias/formulario";
import { caixa, campo, rotulo, Vazio } from "@/components/mentorias/painel";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { empresaMentorias, NOME_MESA } from "@/lib/mentorias";

export default async function MentoriasPage() {
  const acesso = await empresaMentorias().catch(() => null);
  if (!acesso) return <div className="p-6"><Vazio>Seu perfil não tem acesso à gestão de mentorias.</Vazio></div>;
  const podeCriar = Boolean(await empresaMentorias("criar").catch(() => null));
  const [mentorias, clientes] = await Promise.all([
    prisma.mentoria.findMany({
      where: { empresa_id: acesso },
      include: { _count: { select: { alunos: { where: { ativo: true } }, encontros: true } } },
      orderBy: { criado_em: "desc" },
    }),
    podeCriar ? prisma.cliente.findMany({
      where: { empresa_id: acesso, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }) : [],
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <GraduationCap aria-hidden className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold">Mentorias</h1>
      </header>

      {podeCriar && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={caixa}>
            <h2 className="text-lg font-semibold">{NOME_MESA}</h2>
            <Formulario acao={cadastrarMentoria} botao="Criar turma" variant="default">
              <input type="hidden" name="tipo" value="GRUPO" />
              <label className={rotulo}>Nome da turma<input required name="turma" maxLength={100} className={campo} placeholder="Ex. Turma de janeiro" /></label>
              <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} className={campo} rows={2} /></label>
            </Formulario>
          </section>
          <section className={caixa}>
            <h2 className="text-lg font-semibold">Mentoria individual</h2>
            {clientes.length ? (
              <Formulario acao={cadastrarMentoria} botao="Criar mentoria individual" variant="default">
                <input type="hidden" name="tipo" value="INDIVIDUAL" />
                <label className={rotulo}>Cliente<select name="cliente" className={campo} required defaultValue="">
                  <option value="" disabled>Selecione o cliente</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </select></label>
                <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} className={campo} rows={2} /></label>
              </Formulario>
            ) : <Link href="/clientes" className="text-sm text-primary underline">Cadastrar cliente para vincular à mentoria</Link>}
          </section>
        </div>
      )}

      <section className={caixa}>
        <h2 className="text-lg font-semibold">Mentorias cadastradas</h2>
        {!mentorias.length && <Vazio>Nenhuma mentoria cadastrada.</Vazio>}
        <ul className="divide-y">
          {mentorias.map((mentoria) => (
            <li key={mentoria.id}>
              <Link href={`/mentorias/${mentoria.id}`} className="flex items-center justify-between gap-3 py-4 hover:text-primary">
                <div className="space-y-1">
                  <p className="font-medium">{mentoria.nome}{mentoria.turma && ` · ${mentoria.turma}`}</p>
                  <p className="text-sm text-muted-foreground">{mentoria._count.alunos} {mentoria._count.alunos === 1 ? "aluno" : "alunos"} · {mentoria._count.encontros} {mentoria._count.encontros === 1 ? "encontro" : "encontros"}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">{mentoria.tipo === "GRUPO" ? "Em grupo" : "Individual"}</Badge>
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
