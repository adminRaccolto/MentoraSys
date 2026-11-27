import type { ReactNode } from "react";
import type { MentoriaArquivo, MentoriaPost, StatusEncontroMentoria } from "@/lib/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { horarioMentoria } from "@/lib/mentorias";

export const campo = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
export const rotulo = "block text-sm font-medium";
export const caixa = "space-y-4 rounded-xl border bg-card p-4 sm:p-5";

const statusLabels = { AGENDADO: "Agendado", REALIZADO: "Realizado", CANCELADO: "Cancelado" };

export function StatusEncontro({ status }: { status: StatusEncontroMentoria }) {
  return <Badge variant={status === "CANCELADO" ? "outline" : "secondary"}>{statusLabels[status]}</Badge>;
}

export function Secao({ titulo, id, children }: { titulo: string; id: string; children: ReactNode }) {
  return <section id={id} className={`${caixa} scroll-mt-6`}><h2 className="text-lg font-semibold">{titulo}</h2>{children}</section>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function LinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{children}</a>;
}

export function NavegacaoMentoria({ secoes }: { secoes: [string, string][] }) {
  return (
    <nav aria-label="Seções da mentoria" className="flex flex-wrap gap-2">
      {secoes.map(([id, nome]) => <a key={id} href={`#${id}`} className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">{nome}</a>)}
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
          <span className="break-all">{arquivo.nome}</span>
          <a className="text-primary underline" href={`/portal/mentorias/arquivos/${arquivo.id}`} download>Baixar</a>
        </li>
      ))}
    </ul>
  );
}
