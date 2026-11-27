import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import type { MentoriaEncontro, MentoriaItem, MentoriaMaterial, MentoriaPagina, MentoriaPost } from "@/lib/generated/prisma";
import { horarioMentoria } from "@/lib/mentorias";
import { caixa, campo, DataEncontro, hrefSecao, iconesSecao, LinkExterno, ListaPosts, Secao, Vazio } from "./painel";

type Busca = { id: string; titulo: string; secao: string; texto?: string | null; href?: string };
type NomeArquivo = Pick<MentoriaMaterial, "id" | "nome" | "categoria" | "tamanho">;
type Evento = Pick<MentoriaEncontro, "id" | "titulo" | "inicio" | "duracao" | "status" | "sala_url">;

export const secoesComuns: [string, string][] = [
  ["inicio", "Início"], ["encontros", "Reuniões"], ["publicacoes", "Notícias"],
  ["paginas", "Páginas"], ["mural", "Mural"], ["biblioteca", "Biblioteca"],
];

export function secaoSelecionada(secao: string | undefined, secoes: [string, string][]) {
  return secao && secoes.some(([id]) => id === secao) ? secao : "inicio";
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

export function BuscaEspaco({ url, consulta, itens }: { url: string; consulta: string; itens: Busca[] }) {
  const palavras = normalizar(consulta).split(/\s+/).filter(Boolean);
  const resultados = consulta ? itens.filter((item) => {
    const conteudo = normalizar(`${item.titulo} ${item.texto ?? ""}`);
    return palavras.every((palavra) => conteudo.includes(palavra));
  }) : [];

  return (
    <>
      <form action={url} className="flex max-w-md items-end gap-2" role="search">
        <label className="w-full text-sm font-medium">Buscar neste espaço
          <input type="search" name="q" defaultValue={consulta} maxLength={100} className={campo} placeholder="Páginas, encontros, materiais…" />
        </label>
        <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#15394f] text-white" aria-label="Buscar">
          <Search className="size-4" aria-hidden />
        </button>
      </form>
      {consulta && (
        <section className={caixa} aria-labelledby="titulo-busca">
          <h2 id="titulo-busca" className="font-semibold">Resultados para “{consulta}”</h2>
          {!resultados.length && <Vazio>Nenhum resultado neste espaço.</Vazio>}
          {!!resultados.length && <p className="text-sm text-muted-foreground">{resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}</p>}
          <ul className="divide-y">
            {resultados.slice(0, 50).map(({ id, titulo, secao, href }) => (
              <li key={`${secao}-${id}`} className="py-2 text-sm">
                <Link className="font-medium text-primary underline underline-offset-4" href={href ?? hrefSecao(secao)}>{titulo}</Link>
              </li>
            ))}
          </ul>
          <Link href={url} className="text-sm text-primary underline">Limpar busca</Link>
        </section>
      )}
    </>
  );
}

export function indexarEspaco({ encontros, posts, paginas, materiais, tarefas, arquivos, itens }: {
  encontros: { id: string; titulo: string; pauta: string | null }[];
  posts: MentoriaPost[];
  paginas: MentoriaPagina[];
  materiais: NomeArquivo[];
  tarefas: { id: string; titulo: string; descricao: string | null }[];
  arquivos: { id: string; nome: string }[];
  itens: MentoriaItem[];
}): Busca[] {
  return [
    ...encontros.map(({ id, titulo, pauta }) => ({ id, titulo, secao: "encontros", texto: pauta, href: `?secao=encontros#encontro-${id}` })),
    ...posts.map(({ id, tipo, titulo, texto }) => {
      const secao = tipo === "MURAL" ? "mural" : "publicacoes";
      return { id, titulo: titulo ?? texto.slice(0, 85), secao, texto, href: `?secao=${secao}#post-${id}` };
    }),
    ...paginas.map(({ id, titulo, conteudo }) => ({ id, titulo, secao: "paginas", texto: conteudo, href: `?secao=paginas&pagina=${id}` })),
    ...materiais.map(({ id, nome, categoria }) => ({ id, titulo: nome, secao: "biblioteca", texto: categoria, href: `?secao=biblioteca#material-${id}` })),
    ...tarefas.map(({ id, titulo, descricao }) => ({ id, titulo, secao: "tarefas", texto: descricao, href: `?secao=tarefas#tarefa-${id}` })),
    ...arquivos.map(({ id, nome }) => ({ id, titulo: nome, secao: "documentos", href: `?secao=documentos#arquivo-${id}` })),
    ...itens.map(({ id, titulo, descricao, responsavel }) => ({ id, titulo, secao: "acompanhamento", texto: `${descricao ?? ""} ${responsavel ?? ""}`, href: `?secao=acompanhamento#item-${id}` })),
  ];
}

export function InicioEspaco<E extends Evento>({ secoes, encontros, noticias, agora, acoesEncontro }: {
  secoes: [string, string][]; encontros: E[]; noticias: MentoriaPost[]; agora: number;
  acoesEncontro?: (encontro: E) => React.ReactNode;
}) {
  const proximos = encontros.filter((e) => e.status === "AGENDADO" && e.inicio.getTime() + e.duracao * 60_000 >= agora)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()).slice(0, 3);
  const atalhos = secoes.filter(([id]) => ["encontros", "biblioteca", "tarefas", "documentos", "acompanhamento", "alunos", "paginas"].includes(id));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Secao id="proximos" titulo="Próximos encontros">
          {!proximos.length && <Vazio>Nenhum próximo encontro agendado.</Vazio>}
          <ul className="divide-y">
            {proximos.map((encontro) => (
              <li key={encontro.id} className="flex flex-wrap items-center gap-3 py-3">
                <DataEncontro data={encontro.inicio} />
                <div className="min-w-0 flex-1">
                  <Link className="break-words font-semibold hover:underline" href={`?secao=encontros#encontro-${encontro.id}`}>{encontro.titulo}</Link>
                  <p className="text-sm text-muted-foreground">{horarioMentoria(encontro.inicio)} · Cuiabá</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {encontro.sala_url && <LinkExterno href={encontro.sala_url}>Abrir sala</LinkExterno>}
                  {acoesEncontro?.(encontro)}
                </div>
              </li>
            ))}
          </ul>
          <Link href={hrefSecao("encontros")} className="text-sm font-medium text-primary underline">Ver reuniões e calendário</Link>
        </Secao>
        <Secao id="noticias-recentes" titulo="Notícias recentes">
          <ListaPosts posts={noticias.slice(0, 3)} publicacoes />
          <Link href={hrefSecao("publicacoes")} className="text-sm font-medium text-primary underline">Ver todas as notícias</Link>
        </Secao>
      </div>
      <Secao id="atalhos" titulo="Acesso rápido">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {atalhos.map(([id, nome]) => (
            <li key={id}>
              <Link href={hrefSecao(id)} className="flex items-center gap-2 rounded-md border bg-[#f6f9fa] px-3 py-2.5 text-sm font-medium hover:bg-[#eaf2f5]">
                {iconesSecao[id]}{nome}<ArrowRight aria-hidden className="ml-auto size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </Secao>
    </div>
  );
}

export function PaginasEspaco({ paginas, paginaId, editor }: {
  paginas: MentoriaPagina[]; paginaId?: string; editor?: (pagina: MentoriaPagina | null) => React.ReactNode;
}) {
  const atual = paginas.find((pagina) => pagina.id === paginaId);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
      <Secao id="paginas" titulo="Páginas">
        {!paginas.length && <Vazio>Nenhuma página publicada.</Vazio>}
        <ul className="space-y-2">
          {paginas.map((pagina) => (
            <li key={pagina.id}>
              <Link href={`?secao=paginas&pagina=${pagina.id}`} aria-current={atual?.id === pagina.id ? "page" : undefined}
                className="block break-words rounded-md border px-3 py-2 text-sm font-medium hover:bg-[#eaf2f5] aria-[current=page]:bg-[#eaf2f5]">
                {pagina.titulo}
              </Link>
            </li>
          ))}
        </ul>
        {editor?.(null)}
      </Secao>
      {atual && (
        <article className={caixa} aria-label={atual.titulo}>
          <h2 className="break-words text-xl font-semibold">{atual.titulo}</h2>
          <p className="text-xs text-muted-foreground">Atualizada em {horarioMentoria(atual.alterada_em)}</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{atual.conteudo}</p>
          {editor?.(atual)}
        </article>
      )}
    </div>
  );
}

export function BibliotecaEspaco({ materiais }: { materiais: NomeArquivo[] }) {
  if (!materiais.length) return <Vazio>Nenhum material na biblioteca.</Vazio>;
  return (
    <ul className="divide-y">
      {materiais.map((material) => (
        <li key={material.id} id={`material-${material.id}`} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <div className="min-w-0">
            <p className="break-all font-medium">{material.nome}</p>
            <p className="text-xs text-muted-foreground">{material.categoria ?? "Sem categoria"} · {Math.max(1, Math.ceil(material.tamanho / 1024))} KB</p>
          </div>
          <a className="text-primary underline" href={`/portal/mentorias/biblioteca/${material.id}`}>Baixar</a>
        </li>
      ))}
    </ul>
  );
}

const diaLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" });
const mesCalendario = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarioEspaco({ encontros, mes, agora }: { encontros: Evento[]; mes?: string; agora: number }) {
  const hoje = diaLocal.format(agora);
  const chave = typeof mes === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7);
  const [ano, numero] = chave.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, numero - 1, 1));
  const total = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const ir = (delta: number) => `?secao=encontros&mes=${new Date(Date.UTC(ano, numero - 1 + delta, 1)).toISOString().slice(0, 7)}`;
  const porDia = new Map<string, Evento[]>();
  for (const encontro of encontros) {
    const dia = diaLocal.format(encontro.inicio);
    if (!dia.startsWith(chave) || encontro.status === "CANCELADO") continue;
    const lista = porDia.get(dia) ?? [];
    lista.push(encontro);
    porDia.set(dia, lista);
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f1f6f8] px-3 py-2 text-sm">
        <Link href={ir(-1)} className="font-medium text-primary hover:underline">Mês anterior</Link>
        <p className="font-semibold capitalize">{mesCalendario.format(inicio)}</p>
        <Link href={ir(1)} className="font-medium text-primary hover:underline">Próximo mês</Link>
      </div>
      <div className="grid grid-cols-7 bg-white text-center text-xs">
        {diasSemana.map((dia) => <span key={dia} className="border-b py-2 font-medium text-muted-foreground">{dia}</span>)}
        {Array.from({ length: inicio.getUTCDay() }, (_, i) => <span key={`vazio-${i}`} aria-hidden />)}
        {Array.from({ length: total }, (_, i) => {
          const dia = i + 1;
          const data = `${chave}-${String(dia).padStart(2, "0")}`;
          const eventos = porDia.get(data) ?? [];
          return (
            <div key={data} className={`min-w-0 space-y-1 border-b border-l p-1.5 sm:p-2 ${data === hoje ? "bg-[#f7eddb]" : ""}`}>
              <time dateTime={data} aria-current={data === hoje ? "date" : undefined}>{dia}</time>
              {eventos.slice(0, 2).map((encontro) => (
                <a key={encontro.id} title={encontro.titulo} href={`#encontro-${encontro.id}`} aria-label={encontro.titulo}
                  className="block truncate rounded bg-[#eaf2f5] px-0.5 text-[#15394f] hover:underline sm:px-1">
                  <span aria-hidden className="sm:hidden">●</span><span className="hidden sm:inline">{encontro.titulo}</span>
                </a>
              ))}
              {eventos.length > 2 && <a href={`#encontro-${eventos[2].id}`} className="block text-primary underline">+{eventos.length - 2}</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ListaAcompanhamento({ itens, acoes }: {
  itens: MentoriaItem[]; acoes?: (item: MentoriaItem) => React.ReactNode;
}) {
  if (!itens.length) return <Vazio>Nenhum item de acompanhamento cadastrado.</Vazio>;
  return (
    <ul className="divide-y">
      {itens.map((item) => (
        <li key={item.id} id={`item-${item.id}`} className="scroll-mt-24 space-y-2 py-3">
          <h3 className="break-words font-semibold">{item.titulo}</h3>
          <p className="text-sm text-muted-foreground">
            {item.concluida_em ? "Concluído" : "Pendente"}
            {item.responsavel && ` · ${item.responsavel}`}
            {item.prazo && ` · Prazo ${item.prazo.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
          </p>
          {item.descricao && <p className="whitespace-pre-wrap break-words text-sm">{item.descricao}</p>}
          {acoes?.(item)}
        </li>
      ))}
    </ul>
  );
}
