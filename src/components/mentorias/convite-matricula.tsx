"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type ResultadoConvite = { convite?: string; aviso?: string; envioConfirmado?: boolean };

export function ConviteMatricula({ convite, aviso, envioConfirmado }: ResultadoConvite) {
  const [copiado, setCopiado] = useState<string | null>(null);
  if (!convite && !aviso) return null;

  return (
    <div className="space-y-2 rounded-md bg-secondary p-3 text-sm">
      {envioConfirmado && <p role="status">Convite enviado por e-mail.</p>}
      {aviso && <p role="status">{aviso}</p>}
      {convite && <Button type="button" variant="outline" size="sm" onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(convite, location.origin).href);
          setCopiado(convite);
        } catch {
          setCopiado(null);
        }
      }}>{copiado === convite ? "Copiado" : "Copiar link para o aluno"}</Button>}
      {convite && <a href={convite} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">Abrir endereço</a>}
    </div>
  );
}
