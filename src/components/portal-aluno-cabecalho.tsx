import Image from "next/image";
import type { ReactNode } from "react";

export function PortalAlunoCabecalho({ titulo, descricao, children }: {
  titulo: string; descricao?: string; children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f6ef] p-4">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="titulo-acesso">
        <span className="inline-block rounded-md bg-[#172e29] px-3 py-2">
          <Image src="/logo-conselho-agro.png" width={1533} height={420} alt="O Conselho Agro" sizes="144px" className="h-auto w-36" />
        </span>
        <div className="space-y-2 border-t pt-5">
          <h1 id="titulo-acesso" className="font-serif text-3xl tracking-tight">{titulo}</h1>
          {descricao && <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>}
        </div>
        {children}
      </section>
    </main>
  );
}
