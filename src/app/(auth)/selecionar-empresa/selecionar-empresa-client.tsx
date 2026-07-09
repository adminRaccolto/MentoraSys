"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, X, Loader2, ChevronRight } from "lucide-react";
import { criarEmpresa } from "@/actions/empresas";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
});

interface Membro {
  empresa: { id: string; nome: string; logo_url: string | null; plano: string };
  perfil: { nome: string };
}

const PLANO_LABEL: Record<string, string> = {
  BASICO: "Básico",
  PROFISSIONAL: "Profissional",
  ENTERPRISE: "Enterprise",
};

export default function SelecionarEmpresaClient({ membros }: { membros: Membro[] }) {
  const router = useRouter();
  const [selecionando, setSelecionando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onCriar = async (data: z.input<typeof schema>) => {
    setErro(null);
    const res = await criarEmpresa(data);
    if (res.ok) {
      await fetch("/api/auth/empresa", {
        method: "POST",
        body: JSON.stringify({ empresaId: res.empresaId }),
        headers: { "Content-Type": "application/json" },
      });
      router.push("/dashboard");
      router.refresh();
    }
  };

  const selecionar = async (empresaId: string) => {
    setSelecionando(empresaId);
    await fetch("/api/auth/empresa", {
      method: "POST",
      body: JSON.stringify({ empresaId }),
      headers: { "Content-Type": "application/json" },
    });
    router.push("/dashboard");
    router.refresh();
  };

  if (criando) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Nova Empresa</h2>
            <p className="text-sm text-white/60 mt-0.5">Preencha os dados para criar</p>
          </div>
          <button
            onClick={() => { setCriando(false); reset(); setErro(null); }}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onCriar)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80 block">Razão Social / Nome *</label>
            <input
              {...register("nome")}
              placeholder="Ex: Raccolto Agronegócios Ltda"
              className="w-full h-11 rounded-lg px-3 text-sm text-white placeholder:text-white/35 outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(212,172,13,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212,172,13,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {errors.nome && <p className="text-red-300 text-xs">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80 block">CNPJ</label>
            <input
              {...register("cnpj")}
              placeholder="00.000.000/0001-00"
              className="w-full h-11 rounded-lg px-3 text-sm text-white placeholder:text-white/35 outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(212,172,13,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212,172,13,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          {erro && (
            <p className="text-red-300 text-sm">{erro}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background: "#D4AC0D", color: "#1B4F72" }}
          >
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Criando...</> : "Criar empresa"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Selecione a empresa</h2>
        <p className="text-sm text-white/60 mt-1">Escolha com qual empresa deseja trabalhar</p>
      </div>

      <div className="space-y-3">
        {membros.length === 0 && (
          <p className="text-sm text-white/50 text-center py-4">
            Nenhuma empresa vinculada ainda.
          </p>
        )}
        {membros.map(({ empresa, perfil }) => (
          <button
            key={empresa.id}
            disabled={!!selecionando}
            onClick={() => selecionar(empresa.id)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all group disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            onMouseEnter={(e) => {
              if (!selecionando) {
                e.currentTarget.style.background = "rgba(212,172,13,0.12)";
                e.currentTarget.style.border = "1px solid rgba(212,172,13,0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)";
            }}
          >
            <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(212,172,13,0.15)" }}>
              {selecionando === empresa.id
                ? <Loader2 className="size-5 text-[#D4AC0D] animate-spin" />
                : <Building2 className="size-5 text-[#D4AC0D]" />
              }
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-white text-base leading-tight">{empresa.nome}</p>
              <p className="text-xs text-white/50 mt-0.5">{perfil.nome}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                {PLANO_LABEL[empresa.plano] ?? empresa.plano}
              </span>
              <ChevronRight className="size-4 text-white/30 group-hover:text-[#D4AC0D] transition-colors" />
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={() => setCriando(true)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#D4AC0D"; e.currentTarget.style.background = "rgba(212,172,13,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "transparent"; }}
        >
          <Plus className="size-4" />
          Criar nova empresa
        </button>
      </div>
    </div>
  );
}
