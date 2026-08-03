"use client";

import { Printer } from "lucide-react";

export default function PublicPrintButton() {
  return (
    <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex justify-end shadow-sm">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-[#1B4F72] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#154060] transition-colors"
      >
        <Printer className="size-4" />
        Imprimir / Salvar PDF
      </button>
    </div>
  );
}
