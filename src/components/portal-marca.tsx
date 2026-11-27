"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalMarca({ conviteMentoria }: { conviteMentoria: boolean }) {
  const caminho = usePathname();
  const areaAluno = conviteMentoria || caminho === "/portal/mentorias" || caminho.startsWith("/portal/mentorias/");

  return (
    <Link href={areaAluno ? "/portal/mentorias" : "/portal"} className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      {areaAluno ? (
        <span className="shrink-0 rounded-md bg-[#172e29] px-2 py-1.5 sm:px-2.5">
          <Image src="/logo-conselho-agro.png" width={1533} height={420} alt="O Conselho Agro"
            sizes="(min-width: 640px) 144px, 112px" className="h-auto w-28 sm:w-36" />
        </span>
      ) : (
        <Image src="/logo-raccolto.svg" width={108} height={36} alt="Raccolto" className="h-8 w-auto shrink-0" />
      )}
      <span className={`border-l pl-2 text-xs font-medium text-muted-foreground sm:pl-3 sm:text-sm ${areaAluno ? "" : "hidden sm:inline"}`}>
        {areaAluno ? "Área do aluno" : "Área do cliente"}
      </span>
    </Link>
  );
}
