import type { MentoriaAluno, MentoriaEncontro, MentoriaPresenca, MentoriaTarefa } from "@/lib/generated/prisma";
import {
  ajustarPresenca, alterarStatusEncontro, conectarZoom, publicarGravacaoZoom, salvarEncontro, salvarTarefa, alterarTarefaPelaEquipe,
} from "@/actions/mentorias";
import { horarioMentoria, localEncontro } from "@/lib/mentorias";
import { Formulario } from "./formulario";
import { campo, LinkExterno, rotulo, StatusEncontro, Vazio } from "./painel";
import { Badge } from "@/components/ui/badge";

type Aluno = MentoriaAluno & { cliente: { nome: string } };
type Encontro = MentoriaEncontro & { presencas: MentoriaPresenca[] };

export function CamposEncontro({ encontro }: { encontro?: MentoriaEncontro }) {
  return (
    <>
      <label className={rotulo}>Título<input name="titulo" className={campo} required maxLength={160} defaultValue={encontro?.titulo} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={rotulo}>Início (horário de Cuiabá)<input name="inicio" type="datetime-local" className={campo} required defaultValue={encontro ? localEncontro(encontro.inicio) : undefined} /></label>
        <label className={rotulo}>Duração em minutos<input name="duracao" type="number" className={campo} required min={5} max={480} defaultValue={encontro?.duracao ?? 60} /></label>
      </div>
      <label className={rotulo}>Pauta<textarea name="pauta" className={campo} rows={2} maxLength={1500} defaultValue={encontro?.pauta ?? ""} /></label>
      {!encontro?.zoom_id && <label className={rotulo}>Link da videoconferência<input name="sala_url" type="url" className={campo} placeholder="https://…" defaultValue={encontro?.sala_url ?? ""} /></label>}
      {encontro && <label className={rotulo}>Link da gravação publicada<input name="gravacao_url" type="url" className={campo} placeholder="https://…" defaultValue={encontro.gravacao_url ?? ""} /></label>}
    </>
  );
}

export function GerenciarEncontro({ encontro, grupo, alunos, zoom }: {
  encontro: Encontro; grupo: boolean; alunos: Aluno[]; zoom: boolean;
}) {
  const id = encontro.mentoria_id;
  const presencas = new Map(encontro.presencas.map((presenca) => [presenca.aluno_id, presenca]));
  const participantes = alunos.filter((aluno) => aluno.ativo || presencas.has(aluno.id));

  return (
    <article className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{encontro.titulo}</h3>
          <p className="text-sm text-muted-foreground">{horarioMentoria(encontro.inicio)} · {encontro.duracao} min</p>
        </div>
        <StatusEncontro status={encontro.status} />
      </div>
      {encontro.pauta && <p className="whitespace-pre-wrap text-sm">{encontro.pauta}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {encontro.status === "AGENDADO" && encontro.sala_url && <LinkExterno href={encontro.sala_url}>Abrir videoconferência</LinkExterno>}
        {encontro.zoom_id && <LinkExterno href={`https://zoom.us/meeting/${encodeURIComponent(encontro.zoom_id)}`}>Gerenciar no Zoom</LinkExterno>}
        {encontro.gravacao_url && <LinkExterno href={encontro.gravacao_url}>Ver gravação publicada</LinkExterno>}
      </div>
      {encontro.zoom_gravacao && encontro.zoom_gravacao !== encontro.gravacao_url && encontro.status !== "CANCELADO" && (
        <div className="space-y-2 rounded-md bg-muted/60 p-3 text-sm">
          <p>O Zoom disponibilizou a gravação.</p>
          <LinkExterno href={encontro.zoom_gravacao}>Conferir gravação</LinkExterno>
          <Formulario acao={publicarGravacaoZoom.bind(null, id, encontro.id)} botao="Publicar no portal" />
        </div>
      )}
      {encontro.status === "AGENDADO" && (
        <div className="flex flex-wrap gap-2">
          <Formulario acao={alterarStatusEncontro.bind(null, id, encontro.id, "REALIZADO")} botao="Marcar como realizado" />
          <details className="rounded-md border px-3 py-1 text-sm">
            <summary className="cursor-pointer">Cancelar encontro</summary>
            <Formulario className="my-2 space-y-2" acao={alterarStatusEncontro.bind(null, id, encontro.id, "CANCELADO")} botao="Confirmar cancelamento" variant="destructive" />
          </details>
        </div>
      )}
      {zoom && !encontro.sala_url && encontro.status === "AGENDADO" && (
        <Formulario acao={conectarZoom.bind(null, id, encontro.id)} botao="Criar sala no Zoom">
          <label className="flex items-center gap-2 text-sm"><input name="gravar" type="checkbox" /> Gravar automaticamente na nuvem do Zoom</label>
        </Formulario>
      )}
      {encontro.status !== "CANCELADO" && (
        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium">Editar encontro e gravação</summary>
          <Formulario acao={salvarEncontro.bind(null, id, encontro.id)} botao="Salvar encontro" className="mt-3 space-y-3">
            <CamposEncontro encontro={encontro} />
          </Formulario>
        </details>
      )}
      {grupo && encontro.status !== "CANCELADO" && (
        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium">Presença da turma</summary>
          {participantes.length === 0 && <Vazio>Nenhum aluno matriculado.</Vazio>}
          <ul className="mt-2 divide-y">
            {participantes.map((aluno) => {
              const presenca = presencas.get(aluno.id);
              const fontes = [
                presenca?.checkin_em && `Check-in no portal ${horarioMentoria(presenca.checkin_em)}`,
                presenca?.entrada_zoom_em && `Entrada no Zoom ${horarioMentoria(presenca.entrada_zoom_em)}`,
              ].filter(Boolean).join(" · ");
              const estado = presenca?.presente_manual ?? (presenca?.checkin_em || presenca?.entrada_zoom_em ? true : null);
              return (
                <li key={aluno.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">{aluno.cliente.nome}</p>
                    <p>{estado === true ? "Presente" : estado === false ? "Ausente" : "Sem registro"}{presenca?.presente_manual != null && " · Ajuste manual"}</p>
                    {fontes && <p className="text-xs text-muted-foreground">{fontes}</p>}
                  </div>
                  <Formulario acao={ajustarPresenca.bind(null, id, encontro.id, aluno.id)} botao="Salvar presença" className="flex flex-wrap items-end gap-2">
                    <label className="sr-only" htmlFor={`presenca-${encontro.id}-${aluno.id}`}>Presença de {aluno.cliente.nome}</label>
                    <select name="presenca" id={`presenca-${encontro.id}-${aluno.id}`} className="rounded border bg-background p-1.5 text-sm"
                      defaultValue={presenca?.presente_manual == null ? "AUTOMATICA" : presenca.presente_manual ? "PRESENTE" : "AUSENTE"}>
                      <option value="AUTOMATICA">Pelo registro</option>
                      <option value="PRESENTE">Presente</option>
                      <option value="AUSENTE">Ausente</option>
                    </select>
                  </Formulario>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </article>
  );
}

export function CamposTarefa({ tarefa }: { tarefa?: MentoriaTarefa }) {
  return (
    <>
      <label className={rotulo}>Título<input name="titulo" className={campo} required maxLength={160} defaultValue={tarefa?.titulo} /></label>
      <label className={rotulo}>Descrição<textarea name="descricao" className={campo} rows={2} maxLength={3000} defaultValue={tarefa?.descricao ?? ""} /></label>
      <label className={rotulo}>Prazo<input name="prazo" type="date" className={campo} defaultValue={tarefa?.prazo?.toISOString().slice(0, 10)} /></label>
    </>
  );
}

export function TarefaMentoria({ tarefa, children }: { tarefa: MentoriaTarefa; children?: React.ReactNode }) {
  return (
    <li className="space-y-2 p-3 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{tarefa.titulo}</h3>
        <Badge variant={tarefa.concluida_em ? "secondary" : "outline"}>{tarefa.concluida_em ? "Concluída" : "Pendente"}</Badge>
      </div>
      {tarefa.prazo && <p className="text-sm text-muted-foreground">Prazo em {tarefa.prazo.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>}
      {tarefa.descricao && <p className="whitespace-pre-wrap text-sm">{tarefa.descricao}</p>}
      {children}
    </li>
  );
}

export function GerenciarTarefas({ id, alunoId, tarefas }: { id: string; alunoId: string; tarefas: MentoriaTarefa[] }) {
  return (
    <>
      <details className="rounded-md border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Adicionar tarefa</summary>
        <Formulario className="mt-3 space-y-3" acao={salvarTarefa.bind(null, id, alunoId, null)} botao="Criar tarefa">
          <CamposTarefa />
        </Formulario>
      </details>
      {!tarefas.length && <Vazio>Nenhuma tarefa cadastrada.</Vazio>}
      <ul className="divide-y">
        {tarefas.map((tarefa) => (
          <TarefaMentoria key={tarefa.id} tarefa={tarefa}>
            <Formulario acao={alterarTarefaPelaEquipe.bind(null, id, alunoId, tarefa.id, !tarefa.concluida_em)} botao={tarefa.concluida_em ? "Reabrir tarefa" : "Marcar como concluída"} />
            <details>
              <summary className="cursor-pointer text-sm font-medium">Editar tarefa</summary>
              <Formulario className="mt-3 space-y-3" acao={salvarTarefa.bind(null, id, alunoId, tarefa.id)} botao="Salvar tarefa">
                <CamposTarefa tarefa={tarefa} />
              </Formulario>
            </details>
          </TarefaMentoria>
        ))}
      </ul>
    </>
  );
}
