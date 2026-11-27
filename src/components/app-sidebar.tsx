"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  FileText,
  FileSignature,
  FolderKanban,
  GraduationCap,
  FolderOpen,
  FileEdit,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart2,
  Building2,
  LogOut,
  Calendar,
  Activity,
  Receipt,
  FileBarChart2,
  ListTree,
  ArrowLeftRight,
  Settings,
  Landmark,
  Tag,
  BarChart3,
  Sprout,
  Repeat2,
  Ticket,
  Car,
  Percent,
  ArrowRight,
  ChevronRight,
  Menu,
  Search,
  X,
} from "lucide-react";
import NotificacoesBell from "@/components/notificacoes-bell";
import { type Notificacao } from "@/hooks/useNotificacoes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const NAV_GERAL = [
  { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
];

const NAV_COMERCIAL = [
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Fornecedores", href: "/fornecedores", icon: Building2 },
  { label: "Serviços", href: "/servicos", icon: Briefcase },
  { label: "Cupons", href: "/campanhas-cupom", icon: Ticket },
  { label: "CRM", href: "/crm", icon: TrendingUp },
  { label: "Propostas", href: "/propostas", icon: FileText },
  { label: "Contratos", href: "/contratos", icon: FileSignature },
];

const NAV_OPERACIONAL = [
  { label: "Projetos", href: "/projetos", icon: FolderKanban },
  { label: "Documentos", href: "/documentos", icon: FolderOpen },
  { label: "Modelos", href: "/modelos", icon: FileEdit },
  { label: "Agenda", href: "/agenda", icon: Calendar },
  { label: "Mentorias", href: "/mentorias", icon: GraduationCap },
  { label: "Diagnósticos", href: "/diagnosticos", icon: BarChart2 },
  { label: "O Conselho Agro", href: "/diagnosticos/conselho-agro", icon: Sprout },
];

const NAV_SISTEMA = [
  { label: "Relatórios", href: "/relatorios", icon: FileBarChart2 },
  { label: "Reembolso", href: "/relatorios/reembolso", icon: Car },
  { label: "Auditoria", href: "/auditoria", icon: Activity },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

const NAV_FINANCEIRO = [
  { label: "Visão Geral",    href: "/financeiro",                 icon: DollarSign },
  { label: "Faturamento",    href: "/faturamento",                icon: Receipt },
  { label: "Contas a Receber", href: "/financeiro/recebiveis",     icon: ArrowDownCircle },
  { label: "Contas a Pagar", href: "/financeiro/contas-a-pagar",  icon: ArrowUpCircle },
  { label: "Impostos",      href: "/financeiro/impostos",         icon: Percent },
  { label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa",  icon: BarChart2 },
  { label: "Tesouraria",    href: "/financeiro/tesouraria",       icon: ArrowLeftRight },
  { label: "Contas Bancárias", href: "/financeiro/contas-bancarias", icon: Landmark },
  { label: "Plano de Contas",   href: "/plano-contas",                icon: ListTree },
  { label: "Centros de Custo",  href: "/financeiro/centros-custo",    icon: Tag },
  { label: "Relatório por CC",  href: "/financeiro/relatorio-cc",     icon: BarChart3 },
  { label: "Assinaturas",      href: "/financeiro/assinaturas",      icon: Repeat2 },
];

const grupos = [
  { nome: "Início", itens: NAV_GERAL },
  { nome: "Comercial", itens: NAV_COMERCIAL },
  { nome: "Operacional", itens: NAV_OPERACIONAL },
  { nome: "Financeiro", itens: NAV_FINANCEIRO },
  { nome: "Sistema", itens: NAV_SISTEMA },
];

interface Props {
  nomeUsuario: string;
  nomeEmpresa: string;
  logoUrl: string;
  avatarUrl: string;
  notificacoesIniciais: Notificacao[];
  empresaId: string;
  usuarioId: string;
  acessoMentorias: boolean;
  children: ReactNode;
}

function MarcaEmpresa({ logoUrl, nomeEmpresa, aoNavegar }: Pick<Props, "logoUrl" | "nomeEmpresa"> & { aoNavegar?: () => void }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <Link href="/dashboard" onClick={aoNavegar} className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/8">
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[0.65rem] bg-[#f1e4c6] text-[13px] font-bold text-[#263c34]">
        {logoUrl && !falhou ? (
          <Image src={logoUrl} alt="" width={36} height={36} unoptimized onError={() => setFalhou(true)} className="size-full bg-white object-contain p-1" />
        ) : nomeEmpresa.trim().slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] leading-tight font-semibold tracking-tight text-white">MentoraSys</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#bbc9bc]">{nomeEmpresa}</span>
      </span>
    </Link>
  );
}

function AvatarUsuario({ nomeUsuario, avatarUrl }: Pick<Props, "nomeUsuario" | "avatarUrl">) {
  const [falhou, setFalhou] = useState(false);
  const iniciais = nomeUsuario.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "U";
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e3ebe3] text-xs font-semibold text-[#254b40]">
      {avatarUrl && !falhou
        ? <Image src={avatarUrl} width={32} height={32} alt="" unoptimized onError={() => setFalhou(true)} className="size-full object-cover" />
        : iniciais}
    </span>
  );
}

export default function AppShell({
  nomeUsuario, nomeEmpresa, logoUrl, avatarUrl, notificacoesIniciais, empresaId, usuarioId, acessoMentorias, children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const menu = grupos.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => item.href !== "/mentorias" || acessoMentorias),
  }));
  const atual = menu.flatMap(({ nome, itens }) => itens.map((item) => ({ ...item, grupo: nome })))
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  useEffect(() => {
    function abrirBusca(evento: KeyboardEvent) {
      if (!(evento.metaKey || evento.ctrlKey) || evento.key.toLowerCase() !== "k") return;
      if (evento.target instanceof HTMLElement && (evento.target.isContentEditable || evento.target.closest("input, textarea, select"))) return;
      evento.preventDefault();
      setMenuAberto(false);
      setBuscaAberta(true);
    }
    const telaAmpla = window.matchMedia("(min-width: 64rem)");
    const fecharMenuDesktop = (evento: MediaQueryListEvent) => {
      if (evento.matches) setMenuAberto(false);
    };
    window.addEventListener("keydown", abrirBusca);
    telaAmpla.addEventListener("change", fecharMenuDesktop);
    return () => {
      window.removeEventListener("keydown", abrirBusca);
      telaAmpla.removeEventListener("change", fecharMenuDesktop);
    };
  }, []);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function mudarBusca(aberta: boolean) {
    setBuscaAberta(aberta);
    if (!aberta) setTermo("");
  }

  const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const consulta = normalizar(termo.trim());

  function renderMenu(aoNavegar?: () => void) {
    return (
      <>
        <div className="px-3 pb-4 pt-5 pr-12 lg:px-4 lg:pt-6">
          <MarcaEmpresa key={logoUrl} nomeEmpresa={nomeEmpresa} logoUrl={logoUrl} aoNavegar={aoNavegar} />
        </div>
        <nav aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:#52736a_transparent] [scrollbar-width:thin]">
          {menu.map(({ nome, itens }) => (
            <div key={nome} className="mb-4 space-y-0.5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#acbfb4]">{nome}</p>
              {itens.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} onClick={aoNavegar} aria-current={href === atual?.href ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#e3c27b]",
                    href === atual?.href
                      ? "bg-[#e9d4a5] font-semibold text-[#22382f]"
                      : "text-[#e3eae2] hover:bg-white/10 hover:text-white",
                  )}>
                  <Icon aria-hidden className="size-[16px] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {href === atual?.href && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/12 p-3">
          <Link href="/selecionar-empresa" onClick={aoNavegar}
            className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-[#e3eae2] hover:bg-white/10">
            <ArrowLeftRight className="size-4" aria-hidden /> Trocar empresa
          </Link>
          <button type="button" onClick={sair} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-[13px] text-[#e3eae2] hover:bg-white/10">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Ir para o conteúdo</a>
      <aside className="hidden w-[15rem] shrink-0 flex-col bg-[#172e29] lg:flex xl:w-[15.75rem]">
        {renderMenu()}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar flex min-h-16 shrink-0 items-center justify-between gap-2.5 px-3 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
              <SheetTrigger render={<Button variant="outline" size="icon" className="shrink-0 lg:hidden" />} aria-label="Abrir menu">
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" showCloseButton={false} className="w-[min(85vw,20rem)] gap-0 border-none bg-[#172e29] text-white lg:hidden">
                <SheetTitle className="sr-only">Menu principal</SheetTitle>
                <SheetClose render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-4 text-white hover:bg-white/10 hover:text-white" />} aria-label="Fechar menu">
                  <X aria-hidden className="size-4" />
                </SheetClose>
                {renderMenu(() => setMenuAberto(false))}
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{atual?.grupo ?? nomeEmpresa}</p>
              <p className="truncate text-sm font-semibold tracking-tight">{atual?.label ?? "MentoraSys"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Dialog open={buscaAberta} onOpenChange={mudarBusca}>
              <DialogTrigger render={<Button variant="outline" className="h-9 gap-2 px-2.5 sm:min-w-40 sm:justify-start" />} aria-label="Buscar no menu">
                <Search className="size-4 text-primary" aria-hidden />
                <span className="hidden text-muted-foreground sm:inline">Buscar no menu</span>
                <kbd className="ml-2 hidden rounded border bg-muted/75 px-1.5 text-[10px] leading-5 text-muted-foreground xl:inline">⌘ / Ctrl K</kbd>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-0">
                <DialogHeader className="px-4 pt-4">
                  <DialogTitle>Buscar no menu</DialogTitle>
                  <DialogDescription>Encontre e abra uma área do MentoraSys.</DialogDescription>
                </DialogHeader>
                <Command shouldFilter={false} className="px-3 pb-3">
                  <CommandInput placeholder="Ex. Clientes, Projetos, Agenda" value={termo} onValueChange={setTermo} />
                  <CommandList className="mt-2">
                    <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                    {menu.map(({ nome, itens }) => {
                      const encontrados = itens.filter(({ label, href }) => normalizar(`${nome} ${label} ${href}`).includes(consulta));
                      return encontrados.length > 0 && (
                        <CommandGroup key={nome} heading={nome}>
                          {encontrados.map(({ href, label, icon: Icon }) => (
                            <CommandItem key={href} value={href} onSelect={() => { mudarBusca(false); router.push(href); }}>
                              <Icon className="size-4" aria-hidden /> {label}<ArrowRight className="ml-auto size-4" aria-hidden />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </DialogContent>
            </Dialog>
            <NotificacoesBell iniciais={notificacoesIniciais} empresaId={empresaId} usuarioId={usuarioId} />
            <Link href="/selecionar-empresa" aria-label={`Trocar empresa. Empresa atual: ${nomeEmpresa}`}
              className="flex min-w-0 items-center gap-2 rounded-lg p-0.5 hover:bg-muted lg:pr-2">
              <AvatarUsuario key={avatarUrl} nomeUsuario={nomeUsuario} avatarUrl={avatarUrl} />
              <span className="hidden min-w-0 xl:block">
                <span className="block max-w-32 truncate text-xs font-semibold">{nomeUsuario}</span>
                <span className="block max-w-32 truncate text-[10px] text-muted-foreground">{nomeEmpresa}</span>
              </span>
            </Link>
          </div>
        </header>
        <main id="conteudo-principal" tabIndex={-1} className="app-content min-h-0 min-w-0 flex-1 overflow-auto outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
