import { notFound } from "next/navigation";
import { Play, Video } from "lucide-react";
import { comentarMentoria, concluirTarefa } from "@/actions/mentorias";
import { AnexarArquivo, CheckinMentoria, Formulario } from "@/components/mentorias/formulario";
import { TarefaMentoria } from "@/components/mentorias/gestao";
import { CabecalhoMentorias, campo, DataEncontro, ListaArquivos, ListaPosts, NavegacaoMentoria, paginaMentorias, rotulo, Secao, StatusEncontro, Vazio, VoltarMentorias } from "@/components/mentorias/painel";
import { Badge } from "@/components/ui/badge";
import { alunoMentoria, carregarEspacoMentoria, horarioMentoria } from "@/lib/mentorias";
import { prisma } from "@/lib/prisma";
import { BibliotecaEspaco, BuscaEspaco, CalendarioEspaco, indexarEspaco, InicioEspaco, ListaAcompanhamento, PaginasEspaco, secaoSelecionada, secoesComuns } from "@/components/mentorias/espaco";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function MentoriaDoAluno({ params, searchParams }: Props) {
  const [{ id }, filtros] = await Promise.all([params, searchParams]);
  const aluno = await alunoMentoria(id);
  if (!aluno) notFound();

  const grupo = aluno.mentoria.tipo === "GRUPO";
  const [encontros, posts, tarefas, arquivos] = await Promise.all([
    prisma.mentoriaEncontro.findMany({
      where: { mentoria_id: id },
      include: { presencas: { where: { aluno_id: aluno.id }, select: { checkin_em: true, entrada_zoom_em: true, presente_manual: true } } },
      orderBy: { inicio: "desc" },
    }),
    prisma.mentoriaPost.findMany({ where: { mentoria_id: id }, orderBy: { criado_em: "desc" } }),
    grupo ? [] : prisma.mentoriaTarefa.findMany({ where: { aluno_id: aluno.id }, orderBy: { criado_em: "desc" } }),
    grupo ? [] : prisma.mentoriaArquivo.findMany({ where: { aluno_id: aluno.id }, orderBy: { criado_em: "desc" } }),
  ]);
  // eslint-disable-next-line react-hooks/purity -- registra o horário desta requisição no servidor
  const agora = Date.now();
  const emOrdem = [
    ...encontros.filter((e) => e.status === "AGENDADO" && e.inicio.getTime() + e.duracao * 60_000 >= agora).reverse(),
    ...encontros.filter((e) => e.status !== "AGENDADO" || e.inicio.getTime() + e.duracao * 60_000 < agora),
  ];
  const secoes: [string, string][] = [...secoesComuns];
  if (grupo) secoes.push(["acompanhamento", "Acompanhamento"]);
  else secoes.push(["tarefas", "Tarefas"], ["documentos", "Meus documentos"]);
  const ativa = secaoSelecionada(filtros.secao, secoes);
  const consulta = typeof filtros.q === "string" ? filtros.q.trim().slice(0, 100) : "";
  const projeto = await carregarEspacoMentoria(id, grupo, ativa, Boolean(consulta));
  const noticias = posts.filter((post) => post.tipo === "PUBLICACAO");

  return (
    <div className={`space-y-5 ${paginaMentorias}`}>
      <VoltarMentorias href="/portal/mentorias">Minhas mentorias</VoltarMentorias>
      <CabecalhoMentorias titulo={aluno.mentoria.nome} contexto={grupo ? "Mentoria em grupo" : "Mentoria individual"}
        detalhe={aluno.mentoria.turma} descricao={aluno.mentoria.descricao} />
      <NavegacaoMentoria secoes={secoes} ativa={consulta ? "" : ativa} />
      <BuscaEspaco url={`/portal/mentorias/${id}`} consulta={consulta}
        itens={consulta ? indexarEspaco({ encontros, posts, tarefas, arquivos, ...projeto }) : []} />
      {!consulta && ativa === "inicio" && (
        <InicioEspaco secoes={secoes} encontros={encontros} noticias={noticias} agora={agora}
          acoesEncontro={(encontro) => grupo && !encontro.presencas[0]?.checkin_em && (
            <CheckinMentoria mentoriaId={id} encontroId={encontro.id} agora={agora}
              abre={encontro.inicio.getTime() - 30 * 60_000} fecha={encontro.inicio.getTime() + encontro.duracao * 60_000} />
          )} />
      )}
        {!consulta && ativa === "encontros" && (
          <Secao id="encontros" titulo="Calendário de encontros">
        <CalendarioEspaco encontros={encontros} mes={filtros.mes} agora={agora} />
        {!emOrdem.length && <Vazio>Nenhum encontro cadastrado.</Vazio>}
        {!!emOrdem.length && <Vazio>Horários de Cuiabá</Vazio>}
        {emOrdem.map((encontro) => {
          const presenca = encontro.presencas[0];
          const inicio = encontro.inicio.getTime();
          return (
            <article key={encontro.id} id={`encontro-${encontro.id}`} className="scroll-mt-24 space-y-3 rounded-xl border border-[#e4ebed] bg-[#f8fafb] p-3 sm:p-4">
              <div className="flex flex-wrap items-start gap-3">
                <DataEncontro data={encontro.inicio} />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1 lg:flex-row lg:justify-between lg:gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{encontro.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{horarioMentoria(encontro.inicio)} · {encontro.duracao} min</p>
                  </div>
                  <StatusEncontro status={encontro.status} />
                </div>
              </div>
              {encontro.pauta && <p className="whitespace-pre-wrap text-sm">{encontro.pauta}</p>}
              {encontro.status !== "CANCELADO" && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {encontro.status === "AGENDADO" && encontro.sala_url && <a href={encontro.sala_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#18435d] px-3 py-2 font-medium text-white hover:bg-[#102d42]"><Video className="size-4" aria-hidden />Entrar na videoconferência</a>}
                  {encontro.gravacao_url && <a href={encontro.gravacao_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#dbe4e8] bg-white px-3 py-2 font-medium hover:bg-[#edf3f5]"><Play className="size-4" aria-hidden />Assistir à gravação</a>}
                  {grupo && encontro.status === "AGENDADO" && !presenca?.checkin_em && (
                    <CheckinMentoria mentoriaId={id} encontroId={encontro.id}
                      abre={inicio - 30 * 60_000} fecha={inicio + encontro.duracao * 60_000} agora={agora} />
                  )}
                  {grupo && presenca?.checkin_em && <Badge variant="outline">Check-in registrado</Badge>}
                  {grupo && presenca?.entrada_zoom_em && <Badge variant="outline">Entrada no Zoom registrada</Badge>}
                  {grupo && presenca?.presente_manual != null && <Badge variant="outline">{presenca.presente_manual ? "Presença confirmada pela equipe" : "Ausência registrada pela equipe"}</Badge>}
                </div>
              )}
            </article>
          );
        })}
      </Secao>
        )}
        {!consulta && ativa === "mural" && (
          <Secao id="mural" titulo="Mural">
          <Formulario acao={comentarMentoria.bind(null, id)} botao="Enviar mensagem">
            <label className={rotulo}>Mensagem<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
          </Formulario>
          <ListaPosts posts={posts.filter((post) => post.tipo === "MURAL")} />
        </Secao>
        )}
        {!consulta && ativa === "publicacoes" && (
          <Secao id="publicacoes" titulo="Notícias da Raccolto">
          <ListaPosts posts={noticias} publicacoes />
        </Secao>
        )}
        {!consulta && ativa === "tarefas" && (
          <Secao id="tarefas" titulo="Minhas tarefas">
            {!tarefas.length && <Vazio>Nenhuma tarefa cadastrada.</Vazio>}
            <ul className="divide-y">
              {tarefas.map((tarefa) => (
                <TarefaMentoria key={tarefa.id} tarefa={tarefa}>
                  <Formulario acao={concluirTarefa.bind(null, id, tarefa.id, !tarefa.concluida_em)} botao={tarefa.concluida_em ? "Reabrir tarefa" : "Marcar como concluída"} />
                </TarefaMentoria>
              ))}
            </ul>
          </Secao>
        )}
        {!consulta && ativa === "documentos" && (
          <Secao id="documentos" titulo="Meus documentos">
            <AnexarArquivo alunoId={aluno.id} />
            <ListaArquivos arquivos={arquivos} />
          </Secao>
        )}
      {!consulta && ativa === "paginas" && <PaginasEspaco paginas={projeto.paginas} paginaId={filtros.pagina} />}
      {!consulta && ativa === "biblioteca" && (
        <Secao id="biblioteca" titulo="Biblioteca de materiais"><BibliotecaEspaco materiais={projeto.materiais} /></Secao>
      )}
      {!consulta && ativa === "acompanhamento" && grupo && (
        <Secao id="acompanhamento" titulo="Acompanhamento da turma"><ListaAcompanhamento itens={projeto.itens} /></Secao>
      )}
    </div>
  );
}
