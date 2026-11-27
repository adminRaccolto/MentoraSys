import { notFound } from "next/navigation";
import { Play, Video } from "lucide-react";
import { comentarMentoria, concluirTarefa } from "@/actions/mentorias";
import { AnexarArquivo, CheckinMentoria, Formulario } from "@/components/mentorias/formulario";
import { TarefaMentoria } from "@/components/mentorias/gestao";
import { CapaMentorias, campo, DataEncontro, ListaArquivos, ListaPosts, NavegacaoMentoria, paginaMentorias, rotulo, Secao, StatusEncontro, Vazio, VoltarMentorias } from "@/components/mentorias/painel";
import { Badge } from "@/components/ui/badge";
import { alunoMentoria, horarioMentoria } from "@/lib/mentorias";
import { prisma } from "@/lib/prisma";

export default async function MentoriaDoAluno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const secoes: [string, string][] = [["encontros", "Encontros"], ["mural", "Mural"], ["publicacoes", "Publicações"]];
  if (!grupo) secoes.push(["tarefas", "Tarefas"], ["documentos", "Documentos"]);

  return (
    <div className={`space-y-5 ${paginaMentorias}`}>
      <VoltarMentorias href="/portal/mentorias">Minhas mentorias</VoltarMentorias>
      <CapaMentorias titulo={aluno.mentoria.nome} contexto={grupo ? "Mentoria em grupo" : "Mentoria individual"}
        detalhe={aluno.mentoria.turma} descricao={aluno.mentoria.descricao} compacta />
      <NavegacaoMentoria secoes={secoes} />

      <Secao id="encontros" titulo="Encontros e gravações">
        {!emOrdem.length && <Vazio>Nenhum encontro cadastrado.</Vazio>}
        {!!emOrdem.length && <Vazio>Horários de Cuiabá</Vazio>}
        {emOrdem.map((encontro) => {
          const presenca = encontro.presencas[0];
          const inicio = encontro.inicio.getTime();
          return (
            <article key={encontro.id} className="space-y-3 rounded-xl border border-[#e4ebed] bg-[#f8fafb] p-3 sm:p-4">
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

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Secao id="mural" titulo="Mural">
          <Formulario acao={comentarMentoria.bind(null, id)} botao="Enviar mensagem">
            <label className={rotulo}>Mensagem<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
          </Formulario>
          <ListaPosts posts={posts.filter((post) => post.tipo === "MURAL")} />
        </Secao>
        <Secao id="publicacoes" titulo="Publicações da Raccolto">
          <ListaPosts posts={posts.filter((post) => post.tipo === "PUBLICACAO")} publicacoes />
        </Secao>
      </div>

      {!grupo && (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
          <Secao id="documentos" titulo="Meus documentos">
            <AnexarArquivo alunoId={aluno.id} />
            <ListaArquivos arquivos={arquivos} />
          </Secao>
        </div>
      )}
    </div>
  );
}
