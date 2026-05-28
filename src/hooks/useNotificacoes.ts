"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { marcarLida, marcarTodasLidas } from "@/actions/notificacoes";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  url: string | null;
  lida: boolean;
  criado_em: string;
}

export function useNotificacoes(
  iniciais: Notificacao[],
  empresaId: string,
  usuarioId: string
) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(iniciais);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("notificacoes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          const nova = payload.new as Notificacao & { usuario_id: string | null };
          if (nova.usuario_id === null || nova.usuario_id === usuarioId) {
            setNotificacoes((prev) => [nova, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, usuarioId]);

  const handleMarcarLida = useCallback(async (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    await marcarLida(id);
  }, []);

  const handleMarcarTodasLidas = useCallback(async () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    await marcarTodasLidas();
  }, []);

  return { notificacoes, naoLidas, marcarLida: handleMarcarLida, marcarTodasLidas: handleMarcarTodasLidas };
}
