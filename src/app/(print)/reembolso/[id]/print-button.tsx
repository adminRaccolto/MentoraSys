"use client";

import { useState } from "react";
import { FileDown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { DadosPdfReembolso } from "@/lib/pdf-reembolso";

export default function PrintButton({ dados }: { dados: DadosPdfReembolso }) {
  const [gerando, setGerando] = useState(false);

  async function baixarPdf() {
    setGerando(true);
    try {
      const { gerarPdfReembolso } = await import("@/lib/pdf-reembolso");
      await gerarPdfReembolso(dados);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <button
        onClick={() => window.history.back()}
        className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </button>
      <button
        onClick={baixarPdf}
        disabled={gerando}
        className="flex items-center gap-2 bg-[#1B4F72] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#154060] transition-colors disabled:opacity-60"
      >
        <FileDown className="size-4" /> {gerando ? "Gerando..." : "Baixar PDF"}
      </button>
    </div>
  );
}
