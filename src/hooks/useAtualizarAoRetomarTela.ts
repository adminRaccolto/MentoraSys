"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAtualizarAoRetomarTela() {
  const router = useRouter();

  useEffect(() => {
    const atualizar = () => router.refresh();
    atualizar();
    window.addEventListener("focus", atualizar);
    return () => window.removeEventListener("focus", atualizar);
  }, [router]);
}
