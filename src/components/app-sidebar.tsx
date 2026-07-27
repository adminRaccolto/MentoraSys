"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
} from "lucide-react";
import NotificacoesBell from "@/components/notificacoes-bell";
import { type Notificacao } from "@/hooks/useNotificacoes";

const NAV_GERAL = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
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
  { label: "Diagnósticos", href: "/diagnosticos", icon: BarChart2 },
  { label: "O Conselho Agro", href: "/diagnosticos/conselho-agro", icon: Sprout },
];

const NAV_SISTEMA = [
  { label: "Relatórios", href: "/relatorios", icon: FileBarChart2 },
  { label: "Auditoria", href: "/auditoria", icon: Activity },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

const NAV_FINANCEIRO = [
  { label: "Visão Geral",    href: "/financeiro",                 icon: DollarSign },
  { label: "Faturamento",    href: "/faturamento",                icon: Receipt },
  { label: "Contas a Receber", href: "/financeiro/recebiveis",     icon: ArrowDownCircle },
  { label: "Contas a Pagar", href: "/financeiro/contas-a-pagar",  icon: ArrowUpCircle },
  { label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa",  icon: BarChart2 },
  { label: "Tesouraria",    href: "/financeiro/tesouraria",       icon: ArrowLeftRight },
  { label: "Contas Bancárias", href: "/financeiro/contas-bancarias", icon: Landmark },
  { label: "Plano de Contas",   href: "/plano-contas",                icon: ListTree },
  { label: "Centros de Custo",  href: "/financeiro/centros-custo",    icon: Tag },
  { label: "Relatório por CC",  href: "/financeiro/relatorio-cc",     icon: BarChart3 },
  { label: "Assinaturas",      href: "/financeiro/assinaturas",      icon: Repeat2 },
];

interface Props {
  nomeUsuario: string;
  nomeEmpresa: string;
  logoUrl: string;
  avatarUrl: string;
  notificacoesIniciais: Notificacao[];
  empresaId: string;
  usuarioId: string;
}

export default function AppSidebar({
  nomeUsuario,
  nomeEmpresa,
  logoUrl,
  avatarUrl,
  notificacoesIniciais,
  empresaId,
  usuarioId,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoError, setLogoError] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const NavLink = ({ href, icon: Icon, label }: (typeof NAV_COMERCIAL)[0]) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
        isActive(href)
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border">
      {/* Logo + bell */}
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between gap-2 bg-white">
        {logoUrl && !logoError ? (
          <div className="relative h-8 flex-1 min-w-0">
            <Image
              src={logoUrl}
              alt={nomeEmpresa}
              fill
              className="object-contain object-left"
              unoptimized
              onError={() => setLogoError(true)}
            />
          </div>
        ) : (
          <span className="font-bold text-base tracking-tight truncate flex-1">{nomeEmpresa}</span>
        )}
        <NotificacoesBell
          iniciais={notificacoesIniciais}
          empresaId={empresaId}
          usuarioId={usuarioId}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        <p className="text-[11px] font-semibold text-sidebar-foreground/40 px-3 pb-1 uppercase tracking-wider">
          Geral
        </p>
        {NAV_GERAL.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        <p className="text-[11px] font-semibold text-sidebar-foreground/40 px-3 pb-1 pt-4 uppercase tracking-wider">
          Comercial
        </p>
        {NAV_COMERCIAL.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        <p className="text-[11px] font-semibold text-sidebar-foreground/40 px-3 pb-1 pt-4 uppercase tracking-wider">
          Operacional
        </p>
        {NAV_OPERACIONAL.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        <p className="text-[11px] font-semibold text-sidebar-foreground/40 px-3 pb-1 pt-4 uppercase tracking-wider">
          Financeiro
        </p>
        {NAV_FINANCEIRO.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        <p className="text-[11px] font-semibold text-sidebar-foreground/40 px-3 pb-1 pt-4 uppercase tracking-wider">
          Sistema
        </p>
        {NAV_SISTEMA.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Rodapé do usuário */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <div className="px-3 py-2 rounded-md flex items-center gap-2.5">
          {avatarUrl ? (
            <div className="relative size-7 rounded-full overflow-hidden shrink-0">
              <Image src={avatarUrl} alt={nomeUsuario} fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="size-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-sidebar-foreground/70">
                {nomeUsuario.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{nomeUsuario}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate flex items-center gap-1 mt-0.5">
              <Building2 className="size-3 shrink-0" />
              {nomeEmpresa}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
