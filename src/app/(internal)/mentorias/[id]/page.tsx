import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { alterarAcessoAluno, editarMentoria, emitirAcessoAluno, matricularAluno, publicarMentoria, salvarEncontro } from "@/actions/mentorias";
import { AnexarArquivo, Formulario } from "@/components/mentorias/formulario";
import { CamposEncontro, GerenciarEncontro, GerenciarTarefas } from "@/components/mentorias/gestao";
import { campo, ListaArquivos, ListaPosts, NavegacaoMentoria, rotulo, Secao, Vazio } from "@/components/mentorias/painel";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { empresaMentorias } from "@/lib/mentorias";
import { zoomDisponivel } from "@/lib/mentorias-zoom";

export default async function MentoriaInterna({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, empresaId] = await Promise.all([params, empresaMentorias().catch(() => null)]);
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
  const secoes: [string, string][] = [["alunos", grupo ? "Alunos" : "Aluno"], ["encontros", "Encontros"], ["mural", "Mural"], ["publicacoes", "Publicações"]];
  if (alunoIndividual) secoes.push(["tarefas", "Tarefas"], ["documentos", "Documentos"]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <Link href="/mentorias" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden /> Mentorias</Link>
      <header className="space-y-2">
        <Badge variant="secondary">{grupo ? "Em grupo" : "Individual"}</Badge>
        <h1 className="text-2xl font-semibold">{mentoria.nome}</h1>
        {mentoria.turma && <p className="font-medium">{mentoria.turma}</p>}
        {mentoria.descricao && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{mentoria.descricao}</p>}
      </header>
      <NavegacaoMentoria secoes={secoes} />
      <details className="rounded-lg border bg-card px-4 py-2">
        <summary className="cursor-pointer text-sm font-medium">Editar cadastro</summary>
        <Formulario className="mt-3 space-y-3 pb-2" acao={editarMentoria.bind(null, id)} botao="Salvar cadastro">
          <label className={rotulo}>Nome<input name="nome" required maxLength={140} className={campo} defaultValue={mentoria.nome} /></label>
          {grupo && <label className={rotulo}>Nome da turma<input name="turma" required maxLength={100} className={campo} defaultValue={mentoria.turma ?? ""} /></label>}
          <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} rows={2} className={campo} defaultValue={mentoria.descricao ?? ""} /></label>
        </Formulario>
      </details>

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
            <li key={aluno.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div><p className="font-medium">{aluno.cliente.nome}</p><Vazio>{aluno.ativo ? "Acesso ativo" : "Acesso suspenso"}</Vazio></div>
              <div className="flex flex-wrap gap-2">
                {aluno.ativo && <Formulario acao={emitirAcessoAluno.bind(null, id, aluno.id)} botao="Gerar link do portal" />}
                <Formulario acao={alterarAcessoAluno.bind(null, id, aluno.id, !aluno.ativo)} botao={aluno.ativo ? "Suspender acesso" : "Ativar acesso"} />
              </div>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao id="encontros" titulo="Encontros e gravações">
        <details className="rounded-md border px-3 py-2" open={mentoria.encontros.length === 0}>
          <summary className="cursor-pointer text-sm font-medium">Agendar encontro</summary>
          <Formulario className="mt-3 space-y-3 pb-2" acao={salvarEncontro.bind(null, id, null)} botao="Agendar encontro" variant="default">
            <CamposEncontro />
          </Formulario>
        </details>
        {!mentoria.encontros.length && <Vazio>Nenhum encontro agendado.</Vazio>}
        {mentoria.encontros.map((encontro) => <GerenciarEncontro key={encontro.id} encontro={encontro} grupo={grupo} alunos={mentoria.alunos} zoom={zoomDisponivel(empresaId)} />)}
      </Secao>

      <div className="grid gap-5 lg:grid-cols-2">
        <Secao id="mural" titulo="Mural">
          <Formulario acao={publicarMentoria.bind(null, id, "MURAL")} botao="Enviar mensagem">
            <label className={rotulo}>Mensagem<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
          </Formulario>
          <ListaPosts posts={mentoria.posts.filter((post) => post.tipo === "MURAL")} />
        </Secao>
        <Secao id="publicacoes" titulo="Publicações da Raccolto">
          <Formulario acao={publicarMentoria.bind(null, id, "PUBLICACAO")} botao="Publicar">
            <label className={rotulo}>Título<input name="titulo" required maxLength={140} className={campo} /></label>
            <label className={rotulo}>Conteúdo<textarea name="texto" required maxLength={5000} rows={3} className={campo} /></label>
            <label className={rotulo}>Link do material<input name="url" type="url" className={campo} /></label>
          </Formulario>
          <ListaPosts posts={mentoria.posts.filter((post) => post.tipo === "PUBLICACAO")} publicacoes />
        </Secao>
      </div>

      {alunoIndividual && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Secao id="tarefas" titulo="Tarefas do aluno"><GerenciarTarefas id={id} alunoId={alunoIndividual.id} tarefas={tarefas} /></Secao>
          <Secao id="documentos" titulo="Documentos do aluno"><AnexarArquivo alunoId={alunoIndividual.id} /><ListaArquivos arquivos={arquivos} /></Secao>
        </div>
      )}
    </div>
  );
}
