"use client";

import { useState } from "react";
import { Printer, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { enviarFaturaPorEmail } from "@/actions/fatura-email";

interface Props {
  title: string;
  recebivelId: string;
}

export default function FaturaToolbar({ title, recebivelId }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleEnviarEmail() {
    setEnviando(true);
    try {
      const res = await enviarFaturaPorEmail(recebivelId);
      if (res.ok) {
        setEnviado(true);
        toast.success("Fatura enviada por e-mail!");
      } else {
        toast.error(res.erro ?? "Erro ao enviar e-mail.");
      }
    } catch {
      toast.error("Erro ao enviar e-mail.");
    } finally {
      setEnviando(false);
    }
  }

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
      <div className="flex items-center gap-2">
        <button
          onClick={handleEnviarEmail}
          disabled={enviando || enviado}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviado
            ? <><CheckCircle className="size-4 text-green-600" /> Enviado</>
            : <><Mail className="size-4" /> {enviando ? "Enviando…" : "Enviar por e-mail"}</>
          }
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#1B4F72] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#154060] transition-colors"
        >
          <Printer className="size-4" />
          Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  );
}
