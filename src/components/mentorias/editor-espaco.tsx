import { FilePlus2, ListPlus, Newspaper } from "lucide-react";
import { alterarItemMentoria, editarNoticiaMentoria, publicarMentoria, salvarItemMentoria, salvarPaginaMentoria } from "@/actions/mentorias";
import type { MentoriaItem, MentoriaPagina, MentoriaPost } from "@/lib/generated/prisma";
import { Formulario } from "./formulario";
import { BlocoAcao, campo, rotulo } from "./painel";

export function EditorPaginaMentoria({ mentoriaId, pagina }: { mentoriaId: string; pagina: MentoriaPagina | null }) {
  return (
    <BlocoAcao titulo={pagina ? "Editar página" : "Nova página"} icone={FilePlus2}>
      <Formulario acao={salvarPaginaMentoria.bind(null, mentoriaId, pagina?.id ?? null)} botao="Publicar página">
        <label className={rotulo}>Título<input name="titulo" required maxLength={140} className={campo} defaultValue={pagina?.titulo} /></label>
        <label className={rotulo}>Conteúdo<textarea name="conteudo" required maxLength={16000} className={campo} rows={7} defaultValue={pagina?.conteudo} /></label>
      </Formulario>
    </BlocoAcao>
  );
}

export function EditorItemMentoria({ mentoriaId, item }: { mentoriaId: string; item?: MentoriaItem }) {
  return (
    <div className="space-y-3">
      <BlocoAcao titulo={item ? "Editar item" : "Adicionar item"} icone={ListPlus}>
        <Formulario acao={salvarItemMentoria.bind(null, mentoriaId, item?.id ?? null)} botao="Salvar item">
          <label className={rotulo}>Título<input name="titulo" required maxLength={160} className={campo} defaultValue={item?.titulo} /></label>
          <label className={rotulo}>Descrição<textarea name="descricao" maxLength={3000} rows={2} className={campo} defaultValue={item?.descricao ?? ""} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={rotulo}>Responsável<input name="responsavel" maxLength={120} className={campo} defaultValue={item?.responsavel ?? ""} /></label>
            <label className={rotulo}>Prazo<input name="prazo" type="date" className={campo} defaultValue={item?.prazo?.toISOString().slice(0, 10)} /></label>
          </div>
        </Formulario>
      </BlocoAcao>
      {item && <Formulario acao={alterarItemMentoria.bind(null, mentoriaId, item.id, !item.concluida_em)} botao={item.concluida_em ? "Reabrir item" : "Concluir item"} />}
    </div>
  );
}

export function EditorNoticiaMentoria({ mentoriaId, noticia }: { mentoriaId: string; noticia?: MentoriaPost }) {
  const acao = noticia ? editarNoticiaMentoria.bind(null, mentoriaId, noticia.id) : publicarMentoria.bind(null, mentoriaId, "PUBLICACAO");
  return (
    <BlocoAcao titulo={noticia ? "Editar notícia" : "Nova notícia"} icone={Newspaper}>
      <Formulario acao={acao} botao={noticia ? "Salvar notícia" : "Publicar notícia"}>
        <label className={rotulo}>Título<input name="titulo" required maxLength={140} className={campo} defaultValue={noticia?.titulo ?? ""} /></label>
        <label className={rotulo}>Conteúdo<textarea name="texto" required maxLength={5000} rows={3} className={campo} defaultValue={noticia?.texto} /></label>
        <label className={rotulo}>Link do material<input name="url" type="url" className={campo} defaultValue={noticia?.url ?? ""} /></label>
      </Formulario>
    </BlocoAcao>
  );
}
