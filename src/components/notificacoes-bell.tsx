"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificacoes, type Notificacao } from "@/hooks/useNotificacoes";

interface Props {
  iniciais: Notificacao[];
  empresaId: string;
  usuarioId: string;
}

function formatRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  if (h < 24) return `${h}h atrás`;
  return `${d}d atrás`;
}

export default function NotificacoesBell({ iniciais, empresaId, usuarioId }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } =
    useNotificacoes(iniciais, empresaId, usuarioId);

  const handleClick = async (n: Notificacao) => {
    if (!n.lida) await marcarLida(n.id);
    if (n.url) {
      setAberto(false);
      router.push(n.url);
    }
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger>
        <span className="relative p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors inline-flex">
          <Bell className="size-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-80 p-0 shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Notificações</span>
          {naoLidas > 0 && (
            <button
              onClick={marcarTodasLidas}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {notificacoes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma notificação.
            </div>
          ) : (
            notificacoes.slice(0, 30).map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3 ${
                  !n.lida ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.lida ? "font-semibold" : "font-medium"} truncate`}>
                    {n.titulo}
                  </p>
                  {n.mensagem && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.mensagem}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatRelativo(n.criado_em)}
                  </p>
                </div>
                {!n.lida && (
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
