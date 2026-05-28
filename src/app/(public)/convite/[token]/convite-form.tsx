"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { submeterCadastroConvite } from "@/actions/convites";

const schema = z.object({
  tipo: z.enum(["PESSOA_FISICA", "PESSOA_JURIDICA"]),
  nome: z.string().min(2, "Nome obrigatório"),
  nome_fantasia: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  contato_principal: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  nome_fazenda: z.string().optional(),
});

type FormData = z.input<typeof schema>;

interface Props {
  token: string;
  empresa: { nome: string; logo_url: string | null; cor_primaria: string };
}

export default function ConviteForm({ token, empresa }: Props) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "PESSOA_JURIDICA" },
  });

  const tipo = watch("tipo");
  const cor = empresa.cor_primaria;

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue("logradouro", data.logradouro ?? "");
        setValue("bairro", data.bairro ?? "");
        setValue("cidade", data.localidade ?? "");
        setValue("estado", data.uf ?? "");
      }
    } catch {
      // ignora erros de CEP
    } finally {
      setBuscandoCep(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setErro(null);
    const res = await submeterCadastroConvite(token, data);
    if (res.ok) {
      setEnviado(true);
    } else {
      setErro(res.error);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-10 max-w-sm w-full text-center space-y-4">
          {empresa.logo_url && (
            <img src={empresa.logo_url} alt={empresa.nome} className="h-12 object-contain mx-auto" />
          )}
          <div className="size-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${cor}18` }}>
            <svg className="size-8" style={{ color: cor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Cadastro realizado!</h1>
          <p className="text-sm text-slate-500">
            Seus dados foram recebidos com sucesso. Em breve entraremos em contato.
          </p>
          <p className="text-xs text-slate-400 pt-2">{empresa.nome}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          {empresa.logo_url && (
            <img src={empresa.logo_url} alt={empresa.nome} className="h-14 object-contain mx-auto" />
          )}
          {!empresa.logo_url && (
            <p className="text-lg font-bold" style={{ color: cor }}>{empresa.nome}</p>
          )}
          <h1 className="text-2xl font-bold text-slate-800">Preencha seus dados</h1>
          <p className="text-sm text-slate-500">
            Para começarmos nosso trabalho juntos, precisamos de algumas informações.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border divide-y divide-slate-100">

          {/* Tipo */}
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>Tipo de pessoa</p>
            <div className="grid grid-cols-2 gap-3">
              {(["PESSOA_JURIDICA", "PESSOA_FISICA"] as const).map((t) => (
                <label key={t} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${tipo === t ? "border-current bg-slate-50" : "border-slate-200"}`}
                  style={tipo === t ? { borderColor: cor, color: cor } : {}}>
                  <input type="radio" {...register("tipo")} value={t} className="sr-only" />
                  <span className="text-sm font-medium">{t === "PESSOA_JURIDICA" ? "Pessoa Jurídica" : "Pessoa Física"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Identificação */}
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>
              {tipo === "PESSOA_JURIDICA" ? "Empresa" : "Identificação"}
            </p>

            <Field label={tipo === "PESSOA_JURIDICA" ? "Razão Social *" : "Nome completo *"} error={errors.nome?.message}>
              <input {...register("nome")} placeholder={tipo === "PESSOA_JURIDICA" ? "Ex: Agropecuária Silva Ltda" : "Seu nome completo"} className={inputCls} />
            </Field>

            {tipo === "PESSOA_JURIDICA" && (
              <Field label="Nome Fantasia">
                <input {...register("nome_fantasia")} placeholder="Como é conhecido no mercado" className={inputCls} />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label={tipo === "PESSOA_JURIDICA" ? "CNPJ" : "CPF"}>
                <input {...register("cpf_cnpj")} placeholder={tipo === "PESSOA_JURIDICA" ? "00.000.000/0001-00" : "000.000.000-00"} className={inputCls} />
              </Field>
              {tipo === "PESSOA_JURIDICA" && (
                <Field label="Insc. Estadual">
                  <input {...register("inscricao_estadual")} className={inputCls} />
                </Field>
              )}
            </div>
          </div>

          {/* Contato */}
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>Contato</p>

            {tipo === "PESSOA_JURIDICA" && (
              <Field label="Nome do responsável / contato principal">
                <input {...register("contato_principal")} placeholder="Quem vamos contatar" className={inputCls} />
              </Field>
            )}

            <Field label="E-mail" error={errors.email?.message}>
              <input {...register("email")} type="email" placeholder="seu@email.com.br" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone">
                <input {...register("telefone")} placeholder="(00) 0000-0000" className={inputCls} />
              </Field>
              <Field label="WhatsApp">
                <input {...register("whatsapp")} placeholder="(00) 00000-0000" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Endereço */}
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>Endereço</p>

            <Field label="CEP">
              <input
                {...register("cep")}
                placeholder="00000-000"
                className={inputCls}
                onBlur={(e) => buscarCep(e.target.value)}
              />
              {buscandoCep && <p className="text-xs text-slate-400 mt-1">Buscando endereço...</p>}
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Logradouro">
                  <input {...register("logradouro")} placeholder="Rua, Av, Rodovia..." className={inputCls} />
                </Field>
              </div>
              <Field label="Número">
                <input {...register("numero")} placeholder="123" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Complemento">
                <input {...register("complemento")} placeholder="Sala, Apto..." className={inputCls} />
              </Field>
              <Field label="Bairro">
                <input {...register("bairro")} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Cidade">
                  <input {...register("cidade")} className={inputCls} />
                </Field>
              </div>
              <Field label="UF">
                <input {...register("estado")} maxLength={2} placeholder="MT" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Dados do negócio */}
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>Dados do negócio <span className="normal-case text-slate-400 font-normal">(opcional)</span></p>
            <Field label="Nome da fazenda / propriedade">
              <input {...register("nome_fazenda")} placeholder="Ex: Fazenda São João" className={inputCls} />
            </Field>
          </div>

          {/* Submit */}
          <div className="p-6">
            {erro && (
              <p className="text-sm text-red-500 mb-4 bg-red-50 rounded-lg px-4 py-3">{erro}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: cor }}
            >
              {isSubmitting ? "Enviando..." : "Enviar cadastro"}
            </button>
          </div>

        </form>

        <p className="text-center text-xs text-slate-400 pb-6">{empresa.nome}</p>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
