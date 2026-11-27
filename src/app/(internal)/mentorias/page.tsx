import Link from "next/link";
import { CalendarDays, Layers3, UserRound, UsersRound, Video } from "lucide-react";
import { cadastrarMentoria } from "@/actions/mentorias";
import { Formulario } from "@/components/mentorias/formulario";
import { AtalhoCapa, BlocoAcao, CabecalhoMentorias, caixa, campo, LinhaMentoria, paginaMentorias, rotulo, superficieMentorias, Vazio } from "@/components/mentorias/painel";
import { prisma } from "@/lib/prisma";
import { verificarPermissao } from "@/lib/permissoes";
import { empresaMentorias, NOME_MESA } from "@/lib/mentorias";

export default async function MentoriasPage() {
  const acesso = await empresaMentorias().catch(() => null);
  if (!acesso) return <div className="p-6"><Vazio>Seu perfil não tem acesso à gestão de mentorias.</Vazio></div>;
  const [podeCriar, podeConfigurarZoom] = await Promise.all([
    empresaMentorias("criar").then(() => true, () => false),
    verificarPermissao("configuracoes", "editar").then(() => true, () => false),
  ]);
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

  const totais = [
    { rotulo: "Mentorias cadastradas", valor: mentorias.length, icone: Layers3 },
    { rotulo: "Matrículas ativas", valor: mentorias.reduce((total, mentoria) => total + mentoria._count.alunos, 0), icone: UsersRound },
    { rotulo: "Encontros cadastrados", valor: mentorias.reduce((total, mentoria) => total + mentoria._count.encontros, 0), icone: CalendarDays },
  ];

  return (
    <div className={paginaMentorias}>
      <div className="mx-auto max-w-[83rem] space-y-5 p-3.5 sm:space-y-6 sm:p-7 xl:p-9">
        <CabecalhoMentorias titulo="Mentorias" contexto="Raccolto">
          {(podeCriar || podeConfigurarZoom) && (
            <div className="flex flex-wrap gap-2">
              {podeConfigurarZoom && (
                <Link href="/mentorias/integracao-zoom" className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">
                  <Video className="size-4" aria-hidden /> Configurar Zoom
                </Link>
              )}
              {podeCriar && <AtalhoCapa href="#nova-mentoria">Nova mentoria</AtalhoCapa>}
            </div>
          )}
        </CabecalhoMentorias>

        <dl className="grid grid-cols-3 gap-2 sm:gap-4">
          {totais.map(({ rotulo, valor, icone: Icon }) => (
            <div key={rotulo} className={`${superficieMentorias} flex flex-wrap items-center gap-2 px-2.5 py-3 sm:gap-3 sm:px-4`}>
              <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2f5] text-[#19445d] sm:grid" aria-hidden><Icon className="size-[18px]" /></span>
              <div className="flex min-w-0 flex-col">
                <dt className="mt-1 text-xs leading-tight text-[#526875]">{rotulo}</dt>
                <dd className="order-first text-2xl font-semibold leading-none tracking-tight tabular-nums">{valor}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className={`grid items-start gap-5 ${podeCriar ? "xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" : ""}`}>
          <section className={caixa} aria-labelledby="mentorias-cadastradas">
            <h2 id="mentorias-cadastradas" className="text-xl font-semibold tracking-tight">Mentorias cadastradas</h2>
            {!mentorias.length && <Vazio>Nenhuma mentoria cadastrada.</Vazio>}
            <ul className="divide-y divide-[#e8edef]">
              {mentorias.map((mentoria) => (
                <li key={mentoria.id}>
                  <LinhaMentoria href={`/mentorias/${mentoria.id}`} nome={mentoria.nome} grupo={mentoria.tipo === "GRUPO"} turma={mentoria.turma}
                    descricao={mentoria.descricao} detalhes={`${mentoria._count.alunos} ${mentoria._count.alunos === 1 ? "aluno" : "alunos"} · ${mentoria._count.encontros} ${mentoria._count.encontros === 1 ? "encontro" : "encontros"}`} />
                </li>
              ))}
            </ul>
          </section>

          {podeCriar && (
            <section className={caixa} id="nova-mentoria" aria-labelledby="nova-mentoria-titulo">
              <h2 id="nova-mentoria-titulo" className="text-xl font-semibold tracking-tight">Nova mentoria</h2>
              <BlocoAcao titulo={NOME_MESA} icone={UsersRound} aberto={mentorias.length === 0}>
                <Formulario acao={cadastrarMentoria} botao="Criar turma" variant="default">
                  <input type="hidden" name="tipo" value="GRUPO" />
                  <label className={rotulo}>Nome da turma<input required name="turma" maxLength={100} className={campo} /></label>
                  <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} className={campo} rows={2} /></label>
                </Formulario>
              </BlocoAcao>
              <BlocoAcao titulo="Mentoria individual" icone={UserRound}>
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
              </BlocoAcao>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
