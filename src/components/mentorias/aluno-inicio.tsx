import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, FolderOpen, MessageCircle, Video } from "lucide-react";
import type { ReactNode } from "react";
import type { MentoriaPost } from "@/lib/generated/prisma";
import { horarioMentoria } from "@/lib/mentorias";
import { proximosEncontros, type Evento } from "./espaco";
import { DataEncontro, hrefSecao } from "./painel";
import styles from "./aluno-inicio.module.css";

const dataNoticia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Cuiaba", day: "numeric", month: "short",
});

const atalhos = [
  { secao: "biblioteca", titulo: "Biblioteca", icone: FolderOpen },
  { secao: "mural", titulo: "Mural", icone: MessageCircle },
];

function urlEncontro(id: string) {
  return `${hrefSecao("encontros")}#encontro-${id}`;
}

export function InicioMentoriaAluno<E extends Evento>({ nome, turma, descricao, grupo, encontros, noticias, agora, acoesEncontro }: {
  nome: string;
  turma: string | null;
  descricao: string | null;
  grupo: boolean;
  encontros: E[];
  noticias: MentoriaPost[];
  agora: number;
  acoesEncontro: (encontro: E) => ReactNode;
}) {
  const [primeiro, ...restantes] = proximosEncontros(encontros, agora);
  const exibirTurma = turma && turma.trim().toLocaleLowerCase("pt-BR") !== nome.trim().toLocaleLowerCase("pt-BR");

  return (
    <div className={styles.inicio}>
      <div className={styles.destaques}>
        <section className={styles.capa} aria-labelledby="titulo-mentoria">
          <Image src="/mentorias/portal-conselho-agro.webp" alt="" fill
            sizes="(min-width: 1200px) 690px, (min-width: 900px) 62vw, 100vw"
            className={styles.foto} loading="eager" fetchPriority="high" />
          <div className={styles.textoCapa}>
            <p className={styles.tipo}>{grupo ? "Mentoria em grupo" : "Mentoria individual"}</p>
            <h1 id="titulo-mentoria">{nome}</h1>
            {exibirTurma && <p className={styles.turma}>{turma}</p>}
            {descricao && <p className={styles.descricao}>{descricao}</p>}
            <Link href={hrefSecao("encontros")} className={styles.botaoCapa}>
              <CalendarDays className="size-4" aria-hidden /> Calendário da mentoria
            </Link>
          </div>
        </section>

        <div className={styles.lateral}>
          <section className={styles.proxima} aria-labelledby="proxima-reuniao">
            <div>
              <h2 id="proxima-reuniao" className={styles.label}>Próxima reunião</h2>
              {primeiro ? (
                <>
                  <time className={styles.data} dateTime={primeiro.inicio.toISOString()}>{horarioMentoria(primeiro.inicio)} · Cuiabá</time>
                  <h3 className={styles.nomeReuniao}><Link href={urlEncontro(primeiro.id)}>{primeiro.titulo}</Link></h3>
                </>
              ) : <p className={styles.nomeReuniao}>Nenhuma reunião agendada</p>}
            </div>
            {primeiro && (
              <div className="flex flex-wrap items-center gap-2">
                {primeiro.sala_url ? (
                  <a href={primeiro.sala_url} target="_blank" rel="noreferrer" className={styles.botaoSala}>
                    <Video className="size-4" aria-hidden /> Entrar na sala
                  </a>
                ) : (
                  <Link href={urlEncontro(primeiro.id)} className={styles.botaoSala}>Ver detalhes <ArrowRight className="size-4" aria-hidden /></Link>
                )}
                {acoesEncontro(primeiro)}
              </div>
            )}
          </section>
          <nav aria-label="Atalhos da mentoria" className={styles.atalhos}>
            {atalhos.map(({ secao, titulo, icone: Icon }) => (
              <Link key={secao} href={hrefSecao(secao)} className={styles.atalho}>
                <span className="flex items-center justify-between gap-2">
                  <Icon className="size-5" aria-hidden />
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
                <span>{titulo}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section className={styles.noticias} aria-labelledby="noticias-mentoria">
        <div className={styles.linhaTitulo}>
          <h2 id="noticias-mentoria">Notícias da mentoria</h2>
          <Link href={hrefSecao("publicacoes")} className={styles.linkSecao}>Todas as notícias <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
        {noticias.length ? (
          <ul className={styles.listaNoticias}>
            {noticias.slice(0, 4).map((post) => (
              <li key={post.id}>
                <article className={styles.noticia}>
                  <time dateTime={post.criado_em.toISOString()}>{dataNoticia.format(post.criado_em)}</time>
                  <h3><Link href={`${hrefSecao("publicacoes")}#post-${post.id}`}>{post.titulo ?? "Publicação da mentoria"}</Link></h3>
                  <p>{post.texto}</p>
                  <span>{post.autor}</span>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.semNoticias}>As próximas notícias da mentoria aparecerão aqui.</p>
        )}
      </section>

      {restantes.length > 0 && (
        <section className={styles.noticias} aria-labelledby="outros-encontros">
          <div className={styles.linhaTitulo}><h2 id="outros-encontros">Outras reuniões</h2></div>
          <ul className="divide-y">
            {restantes.slice(0, 3).map((encontro) => (
              <li key={encontro.id} className="flex flex-wrap items-center gap-3 py-3">
                <DataEncontro data={encontro.inicio} />
                <div className="min-w-0 flex-1">
                  <Link href={urlEncontro(encontro.id)} className="break-words font-semibold hover:underline">{encontro.titulo}</Link>
                  <p className="text-sm text-muted-foreground">{horarioMentoria(encontro.inicio)} · Cuiabá</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
