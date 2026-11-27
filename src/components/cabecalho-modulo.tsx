import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function CabecalhoModulo({ titulo, icone, quantidade, children }: {
  titulo: string;
  icone: ReactNode;
  quantidade?: number;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-4 sm:pb-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-card shadow-sm ring-1 ring-border text-primary [&_svg]:size-5">
          {icone}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="font-semibold">{titulo}</h1>
          {quantidade !== undefined && <Badge variant="secondary" className="ml-1 tabular-nums">{quantidade}</Badge>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
