import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ChevronDown, FileText, FolderLock, GraduationCap, MessageCircle, Newspaper, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { MentoriaArquivo, MentoriaPost, StatusEncontroMentoria } from "@/lib/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { horarioMentoria } from "@/lib/mentorias";
import styles from "./mentorias.module.css";

export const campo = `mt-1 w-full border px-3 py-2.5 text-sm ${styles.campo}`;
export const rotulo = "block text-sm font-medium";
export const superficieMentorias = styles.superficie;
export const caixa = `space-y-4 p-4 sm:p-5 ${superficieMentorias}`;
export const paginaMentorias = styles.pagina;

const iconesSecao: Partial<Record<string, ReactNode>> = {
  alunos: <UsersRound aria-hidden className="size-4" />,
  encontros: <CalendarDays aria-hidden className="size-4" />,
  mural: <MessageCircle aria-hidden className="size-4" />,
  publicacoes: <Newspaper aria-hidden className="size-4" />,
  tarefas: <CheckSquare aria-hidden className="size-4" />,
  documentos: <FolderLock aria-hidden className="size-4" />,
};

export function CapaMentorias({ titulo, contexto, detalhe, descricao, compacta, children }: {
  titulo: string;
  contexto?: string;
  detalhe?: string | null;
  descricao?: string | null;
  compacta?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={`${styles.hero} ${compacta ? styles.heroCompacto : ""}`}>
      <div className={styles.foto} aria-hidden>
        <Image src="/mentorias/capa-agro.webp" alt="" fill sizes="(max-width: 640px) 100vw, 72vw" />
      </div>
      <div className={styles.heroCopy}>
        {contexto && <p className={styles.sobreTitulo}><GraduationCap aria-hidden className="size-4" /> {contexto}</p>}
        <h1 className={styles.titulo}>{titulo}</h1>
        {detalhe && <p className="mt-3 text-base font-medium text-[#f3d49e]">{detalhe}</p>}
        {descricao && <p className="mt-2 max-w-lg whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">{descricao}</p>}
        {children}
      </div>
    </header>
  );
}

export function VoltarMentorias({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-[#36546a] hover:underline"><ArrowLeft className="size-4" aria-hidden /> {children}</Link>;
}

export function AtalhoCapa({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#edc785] px-3.5 py-2 text-sm font-semibold text-[#182e3b] hover:bg-[#f5d5a0]">{children}<ArrowDownRight className="size-4" aria-hidden /></a>;
}

export function BlocoAcao({ titulo, children, icone: Icon, aberto }: { titulo: string; children: ReactNode; icone: typeof CalendarDays; aberto?: boolean }) {
  return (
    <details className={`px-3 sm:px-4 ${styles.cadastro}`} open={aberto}>
      <summary className="text-sm"><Icon className="size-4 text-[#26506a]" aria-hidden />{titulo}<ChevronDown className="ml-auto size-4" aria-hidden /></summary>
      <div className="pb-4 pt-2">{children}</div>
    </details>
  );
}

export function LinhaMentoria({ href, nome, grupo, turma, descricao, detalhes }: {
  href: string; nome: string; grupo: boolean; turma?: string | null; descricao?: string | null; detalhes?: ReactNode;
}) {
  const Icon = grupo ? UsersRound : UserRound;
  return (
    <Link href={href} className={`group flex items-start gap-3 px-2 py-3.5 sm:items-center sm:gap-4 sm:px-3 ${styles.linhaLink}`}>
      <span className={styles.icone} data-grupo={grupo}><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-[#526875]">{grupo ? "Em grupo" : "Individual"}</p>
        <h3 className="break-words font-semibold leading-tight sm:text-[1.02rem]">{nome}{turma && <span className="font-medium text-[#526875]"> · {turma}</span>}</h3>
        {descricao && <p className="line-clamp-2 text-sm text-[#526875]">{descricao}</p>}
        {detalhes && <p className="text-xs text-[#526875]">{detalhes}</p>}
      </div>
      <ArrowRight className="mt-2 size-4 shrink-0 text-[#345972] sm:mt-0" aria-hidden />
    </Link>
  );
}

export function DataEncontro({ data }: { data: Date }) {
  const fuso = { timeZone: "America/Cuiaba" };
  const dia = new Intl.DateTimeFormat("pt-BR", { ...fuso, day: "2-digit" }).format(data);
  const mes = new Intl.DateTimeFormat("pt-BR", { ...fuso, month: "short" }).format(data).replace(".", "");
  return <span className={styles.dataEncontro} aria-hidden><span>{dia}</span><span>{mes}</span></span>;
}

const statusLabels = { AGENDADO: "Agendado", REALIZADO: "Realizado", CANCELADO: "Cancelado" };

export function StatusEncontro({ status }: { status: StatusEncontroMentoria }) {
  return <Badge variant={status === "CANCELADO" ? "outline" : "secondary"}>{statusLabels[status]}</Badge>;
}

export function Secao({ titulo, id, children }: { titulo: string; id: string; children: ReactNode }) {
  const icone = iconesSecao[id];
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={`${caixa} ${styles.secao}`}>
      <h2 id={`${id}-titulo`} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight sm:text-xl">
        {icone && <span className={styles.icone}>{icone}</span>}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#526875]">{children}</p>;
}

export function LinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{children}</a>;
}

export function NavegacaoMentoria({ secoes }: { secoes: [string, string][] }) {
  return (
    <nav aria-label="Seções da mentoria" className={styles.nav}>
      {secoes.map(([id, nome]) => <a key={id} href={`#${id}`}>{iconesSecao[id]}{nome}</a>)}
    </nav>
  );
}

export function ListaPosts({ posts, publicacoes = false }: { posts: MentoriaPost[]; publicacoes?: boolean }) {
  if (!posts.length) return <Vazio>{publicacoes ? "Nenhuma publicação disponível." : "Nenhuma mensagem no mural."}</Vazio>;

  return (
    <ul className="divide-y">
      {posts.map((post) => (
        <li key={post.id} className="space-y-1 py-3 first:pt-0">
          <p className="text-xs text-muted-foreground">{post.autor} · {horarioMentoria(post.criado_em)}</p>
          {post.titulo && <h3 className="font-medium">{post.titulo}</h3>}
          <p className="whitespace-pre-wrap break-words text-sm">{post.texto}</p>
          {post.url && <LinkExterno href={post.url}>Abrir material</LinkExterno>}
        </li>
      ))}
    </ul>
  );
}

export function ListaArquivos({ arquivos }: { arquivos: MentoriaArquivo[] }) {
  if (!arquivos.length) return <Vazio>Nenhum documento anexado.</Vazio>;

  return (
    <ul className="divide-y">
      {arquivos.map((arquivo) => (
        <li key={arquivo.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-2 break-all"><FileText className="size-4 shrink-0 text-[#315c73]" aria-hidden />{arquivo.nome}</span>
          <a className="text-primary underline" href={`/portal/mentorias/arquivos/${arquivo.id}`} download>Baixar</a>
        </li>
      ))}
    </ul>
  );
}
