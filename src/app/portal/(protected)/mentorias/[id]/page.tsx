import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { comentarMentoria, concluirTarefa } from "@/actions/mentorias";
import { AnexarArquivo, CheckinMentoria, Formulario } from "@/components/mentorias/formulario";
import { TarefaMentoria } from "@/components/mentorias/gestao";
import { campo, LinkExterno, ListaArquivos, ListaPosts, NavegacaoMentoria, rotulo, Secao, StatusEncontro, Vazio } from "@/components/mentorias/painel";
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
    <div className="space-y-5">
      <Link href="/portal/mentorias" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden /> Minhas mentorias</Link>
      <header className="space-y-2">
        <Badge variant="secondary">{grupo ? "Em grupo" : "Individual"}</Badge>
        <h1 className="text-2xl font-semibold">{aluno.mentoria.nome}</h1>
        {aluno.mentoria.turma && <p className="font-medium">{aluno.mentoria.turma}</p>}
        {aluno.mentoria.descricao && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{aluno.mentoria.descricao}</p>}
      </header>
      <NavegacaoMentoria secoes={secoes} />

      <Secao id="encontros" titulo="Encontros e gravações">
        {!emOrdem.length && <Vazio>Nenhum encontro cadastrado.</Vazio>}
        {!!emOrdem.length && <Vazio>Horários de Cuiabá</Vazio>}
        {emOrdem.map((encontro) => {
          const presenca = encontro.presencas[0];
          const inicio = encontro.inicio.getTime();
          return (
            <article key={encontro.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{encontro.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{horarioMentoria(encontro.inicio)} · {encontro.duracao} min</p>
                </div>
                <StatusEncontro status={encontro.status} />
              </div>
              {encontro.pauta && <p className="whitespace-pre-wrap text-sm">{encontro.pauta}</p>}
              {encontro.status !== "CANCELADO" && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {encontro.status === "AGENDADO" && encontro.sala_url && <LinkExterno href={encontro.sala_url}>Entrar na videoconferência</LinkExterno>}
                  {encontro.gravacao_url && <LinkExterno href={encontro.gravacao_url}>Assistir à gravação</LinkExterno>}
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

      <Secao id="mural" titulo="Mural">
        <Formulario acao={comentarMentoria.bind(null, id)} botao="Enviar mensagem">
          <label className={rotulo}>Mensagem<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
        </Formulario>
        <ListaPosts posts={posts.filter((post) => post.tipo === "MURAL")} />
      </Secao>
      <Secao id="publicacoes" titulo="Publicações da Raccolto">
        <ListaPosts posts={posts.filter((post) => post.tipo === "PUBLICACAO")} publicacoes />
      </Secao>

      {!grupo && (
        <>
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
        </>
      )}
    </div>
  );
}
