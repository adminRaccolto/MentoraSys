import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, PencilLine } from "lucide-react";
import { alterarAcessoAluno, editarMentoria, emitirAcessoAluno, matricularAluno, publicarMentoria, salvarEncontro } from "@/actions/mentorias";
import { AnexarArquivo, Formulario } from "@/components/mentorias/formulario";
import { CamposEncontro, GerenciarEncontro, GerenciarTarefas } from "@/components/mentorias/gestao";
import { BlocoAcao, CabecalhoMentorias, campo, ListaArquivos, ListaPosts, NavegacaoMentoria, paginaMentorias, rotulo, Secao, Vazio, VoltarMentorias } from "@/components/mentorias/painel";
import { prisma } from "@/lib/prisma";
import { carregarEspacoMentoria, empresaMentorias } from "@/lib/mentorias";
import { zoomDisponivel } from "@/lib/mentorias-zoom";
import { BibliotecaEspaco, BuscaEspaco, CalendarioEspaco, indexarEspaco, InicioEspaco, ListaAcompanhamento, PaginasEspaco, secaoSelecionada, secoesComuns } from "@/components/mentorias/espaco";
import { EditorItemMentoria, EditorNoticiaMentoria, EditorPaginaMentoria } from "@/components/mentorias/editor-espaco";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function MentoriaInterna({ params, searchParams }: Props) {
  const [{ id }, empresaId, filtros] = await Promise.all([params, empresaMentorias().catch(() => null), searchParams]);
  if (!empresaId) notFound();

  const mentoria = await prisma.mentoria.findUnique({
    where: { id, empresa_id: empresaId },
    include: {
      alunos: {
        where: { cliente: { empresa_id: empresaId } },
        include: { cliente: { select: { nome: true } } },
        orderBy: { cliente: { nome: "asc" } },
      },
      encontros: { include: { presencas: true }, orderBy: { inicio: "desc" } },
      posts: { orderBy: { criado_em: "desc" } },
    },
  });
  if (!mentoria) notFound();

  const grupo = mentoria.tipo === "GRUPO";
  const alunoIndividual = grupo ? undefined : mentoria.alunos[0];
  const [clientes, tarefas, arquivos] = await Promise.all([
    grupo ? prisma.cliente.findMany({
      where: { empresa_id: empresaId, status: "ATIVO", mentorias: { none: { mentoria_id: id } } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }) : [],
    alunoIndividual ? prisma.mentoriaTarefa.findMany({ where: { aluno_id: alunoIndividual.id }, orderBy: { criado_em: "desc" } }) : [],
    alunoIndividual ? prisma.mentoriaArquivo.findMany({ where: { aluno_id: alunoIndividual.id }, orderBy: { criado_em: "desc" } }) : [],
  ]);
  const secoes: [string, string][] = [...secoesComuns, ["alunos", grupo ? "Alunos" : "Aluno"]];
  if (grupo) secoes.push(["acompanhamento", "Acompanhamento"]);
  if (alunoIndividual) secoes.push(["tarefas", "Tarefas"], ["documentos", "Documentos individuais"]);
  secoes.push(["cadastro", "Cadastro"]);
  const ativa = secaoSelecionada(filtros.secao, secoes);
  const consulta = typeof filtros.q === "string" ? filtros.q.trim().slice(0, 100) : "";
  const projeto = await carregarEspacoMentoria(id, grupo, ativa, Boolean(consulta));
  const noticias = mentoria.posts.filter((post) => post.tipo === "PUBLICACAO");
  // eslint-disable-next-line react-hooks/purity -- relógio da requisição no servidor
  const agora = Date.now();

  return (
    <div className={paginaMentorias}>
      <div className="mx-auto max-w-[83rem] space-y-5 p-3.5 sm:p-7 xl:p-9">
        <VoltarMentorias href="/mentorias">Mentorias</VoltarMentorias>
        <CabecalhoMentorias titulo={mentoria.nome} contexto={grupo ? "Mentoria em grupo" : "Mentoria individual"}
          detalhe={mentoria.turma} descricao={mentoria.descricao} />
        <NavegacaoMentoria secoes={secoes} ativa={consulta ? "" : ativa} />
        <BuscaEspaco url={`/mentorias/${id}`} consulta={consulta}
          itens={consulta ? indexarEspaco({ encontros: mentoria.encontros, posts: mentoria.posts, tarefas, arquivos, ...projeto }) : []} />
        {!consulta && ativa === "inicio" && <InicioEspaco secoes={secoes} encontros={mentoria.encontros} noticias={noticias} agora={agora} />}
        {!consulta && ativa === "cadastro" && (
          <BlocoAcao titulo="Editar cadastro" icone={PencilLine}>
            <Formulario className="mt-3 space-y-3 pb-2" acao={editarMentoria.bind(null, id)} botao="Salvar cadastro">
              <label className={rotulo}>Nome<input name="nome" required maxLength={140} className={campo} defaultValue={mentoria.nome} /></label>
              {grupo && <label className={rotulo}>Nome da turma<input name="turma" required maxLength={100} className={campo} defaultValue={mentoria.turma ?? ""} /></label>}
              <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} rows={2} className={campo} defaultValue={mentoria.descricao ?? ""} /></label>
            </Formulario>
          </BlocoAcao>
        )}
        {!consulta && ativa === "encontros" && (
          <Secao id="encontros" titulo="Calendário de encontros">
            <CalendarioEspaco encontros={mentoria.encontros} mes={filtros.mes} agora={agora} />
            <BlocoAcao titulo="Agendar encontro" icone={CalendarPlus} aberto={mentoria.encontros.length === 0}>
              <Formulario className="mt-3 space-y-3 pb-2" acao={salvarEncontro.bind(null, id, null)} botao="Agendar encontro" variant="default">
                <CamposEncontro />
              </Formulario>
            </BlocoAcao>
            {!mentoria.encontros.length && <Vazio>Nenhum encontro agendado.</Vazio>}
            {mentoria.encontros.map((encontro) => <GerenciarEncontro key={encontro.id} encontro={encontro} grupo={grupo} alunos={mentoria.alunos} zoom={zoomDisponivel(empresaId)} />)}
          </Secao>
        )}
        {!consulta && ativa === "alunos" && (
          <Secao id="alunos" titulo={grupo ? "Alunos da turma" : "Aluno da mentoria"}>
            {grupo && clientes.length > 0 && (
              <Formulario acao={matricularAluno.bind(null, id)} botao="Matricular aluno">
                <label className={rotulo}>Cliente<select name="cliente" required defaultValue="" className={campo}>
                  <option value="" disabled>Selecione o cliente</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </select></label>
              </Formulario>
            )}
            {grupo && !clientes.length && <Vazio>Sem clientes disponíveis para matrícula. <Link className="text-primary underline" href="/clientes">Abrir cadastro de clientes</Link></Vazio>}
            {!mentoria.alunos.length && <Vazio>Nenhum aluno matriculado.</Vazio>}
            <ul className="divide-y">
              {mentoria.alunos.map((aluno) => (
                <li key={aluno.id} className="space-y-2 py-3">
                  <div><p className="font-medium">{aluno.cliente.nome}</p><Vazio>{aluno.ativo ? "Acesso ativo" : "Acesso suspenso"}</Vazio></div>
                  <div className="flex flex-wrap gap-2">
                    {aluno.ativo && <Formulario acao={emitirAcessoAluno.bind(null, id, aluno.id)} botao="Gerar link do portal" />}
                    <Formulario acao={alterarAcessoAluno.bind(null, id, aluno.id, !aluno.ativo)} botao={aluno.ativo ? "Suspender acesso" : "Ativar acesso"} />
                  </div>
                </li>
              ))}
            </ul>
          </Secao>
        )}
        {!consulta && ativa === "mural" && (
          <Secao id="mural" titulo="Mural">
            <Formulario acao={publicarMentoria.bind(null, id, "MURAL")} botao="Enviar mensagem">
              <label className={rotulo}>Mensagem<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
            </Formulario>
            <ListaPosts posts={mentoria.posts.filter((post) => post.tipo === "MURAL")} />
          </Secao>
        )}
        {!consulta && ativa === "publicacoes" && (
          <Secao id="publicacoes" titulo="Notícias da Raccolto">
            <EditorNoticiaMentoria mentoriaId={id} />
            <ListaPosts posts={noticias} publicacoes acoes={(noticia) => <EditorNoticiaMentoria mentoriaId={id} noticia={noticia} />} />
          </Secao>
        )}
        {!consulta && ativa === "paginas" && (
          <PaginasEspaco paginas={projeto.paginas} paginaId={filtros.pagina}
            editor={(pagina) => <EditorPaginaMentoria mentoriaId={id} pagina={pagina} />} />
        )}
        {!consulta && ativa === "biblioteca" && (
          <Secao id="biblioteca" titulo="Biblioteca de materiais">
            <AnexarArquivo alunoId={id} biblioteca />
            <BibliotecaEspaco materiais={projeto.materiais} />
          </Secao>
        )}
        {!consulta && ativa === "acompanhamento" && grupo && (
          <Secao id="acompanhamento" titulo="Acompanhamento da turma">
            <EditorItemMentoria mentoriaId={id} />
            <ListaAcompanhamento itens={projeto.itens} acoes={(item) => <EditorItemMentoria mentoriaId={id} item={item} />} />
          </Secao>
        )}
        {!consulta && ativa === "tarefas" && alunoIndividual && (
          <Secao id="tarefas" titulo="Tarefas do aluno"><GerenciarTarefas id={id} alunoId={alunoIndividual.id} tarefas={tarefas} /></Secao>
        )}
        {!consulta && ativa === "documentos" && alunoIndividual && (
          <Secao id="documentos" titulo="Documentos individuais"><AnexarArquivo alunoId={alunoIndividual.id} /><ListaArquivos arquivos={arquivos} /></Secao>
        )}
      </div>
    </div>
  );
}
