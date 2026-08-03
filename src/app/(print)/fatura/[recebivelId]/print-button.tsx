"use client";

import { Printer, ArrowLeft } from "lucide-react";

interface Props {
  title: string;
}

export default function FaturaToolbar({ title }: Props) {
  return (
    <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Voltar
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-medium text-slate-700">{title}</span>
      </div>
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
