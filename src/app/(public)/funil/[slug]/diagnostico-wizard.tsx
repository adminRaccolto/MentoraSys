"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PERGUNTAS } from "@/lib/diagnostico-perguntas";
import {
  iniciarDiagnostico,
  verificarOtp,
  finalizarDiagnostico,
  reenviarOtp,
} from "@/actions/diagnostico-publico";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campanha {
  id: string;
  titulo: string;
  subtitulo: string | null;
  video_youtube: string | null;
  url_checkout: string | null;
  empresa_id: string;
}

interface Props { campanha: Campanha }

type Step = "cadastro" | "otp" | "questionario" | "video";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const schemaCadastro = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido"),
  celular: z.string().min(10, "Celular inválido"),
  email: z.string().email("E-mail inválido"),
});

type CadastroData = z.infer<typeof schemaCadastro>;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DiagnosticoWizard({ campanha }: Props) {
  const [step, setStep] = useState<Step>("cadastro");
  const [participanteId, setParticipanteId] = useState("");
  const [otpCodigo, setOtpCodigo] = useState("");
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<{ pontuacao: number; maximo: number; videoId: string | null; urlCheckout: string | null } | null>(null);
  const [erro, setErro] = useState("");
  const [moduloAtual, setModuloAtual] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [reenvioContagem, setReenvioContagem] = useState(0);
  const videoRef = useRef<HTMLIFrameElement>(null);

  const totalPerguntas = PERGUNTAS.reduce((s, m) => s + m.perguntas.length, 0);
  const respondidas = Object.keys(respostas).length;
  const progresso = Math.round((respondidas / totalPerguntas) * 100);

  const form = useForm<CadastroData>({ resolver: zodResolver(schemaCadastro) });

  // Contagem regressiva para reenvio
  useEffect(() => {
    if (reenvioContagem <= 0) return;
    const t = setTimeout(() => setReenvioContagem((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioContagem]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCadastro = form.handleSubmit((data) => {
    setErro("");
    startTransition(async () => {
      try {
        const { participanteId: pid } = await iniciarDiagnostico(campanha.id, campanha.empresa_id, data);
        setParticipanteId(pid);
        setReenvioContagem(60);
        setStep("otp");
      } catch (e) {
        setErro((e as Error).message ?? "Erro ao iniciar diagnóstico");
      }
    });
  });

  function handleOtp() {
    if (otpCodigo.length !== 6) return;
    setErro("");
    startTransition(async () => {
      try {
        await verificarOtp({ participanteId, codigo: otpCodigo });
        setStep("questionario");
      } catch (e) {
        setErro((e as Error).message ?? "Código inválido");
      }
    });
  }

  function handleReenviarOtp() {
    startTransition(async () => {
      try {
        await reenviarOtp(participanteId);
        setReenvioContagem(60);
        setErro("");
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  function handleResposta(perguntaId: string, valor: number) {
    setRespostas((prev) => ({ ...prev, [perguntaId]: valor }));
  }

  function moduloCompleto(idx: number) {
    return PERGUNTAS[idx].perguntas.every((p) => respostas[p.id] !== undefined);
  }

  function handleProximoModulo() {
    if (moduloAtual < PERGUNTAS.length - 1) {
      setModuloAtual((m) => m + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleFinalizar();
    }
  }

  function handleFinalizar() {
    setErro("");
    startTransition(async () => {
      try {
        const res = await finalizarDiagnostico(participanteId, campanha.empresa_id, respostas);
        setResultado({
          pontuacao: res.pontuacao.total,
          maximo: res.pontuacao.maximo,
          videoId: res.videoYoutube,
          urlCheckout: res.urlCheckout,
        });
        setStep("video");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d2d45] via-[#1B4F72] to-[#163d5a]">

      {/* Header fixo */}
      <header className="sticky top-0 z-50 bg-[#0d2d45]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg leading-tight">{campanha.titulo}</p>
            {campanha.subtitulo && <p className="text-blue-200 text-sm">{campanha.subtitulo}</p>}
          </div>
          {step === "questionario" && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-blue-200">{respondidas}/{totalPerguntas} perguntas</p>
                <p className="text-white font-semibold text-sm">{progresso}%</p>
              </div>
              <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AC0D] rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">

        {/* ── STEP 1: Cadastro ── */}
        {step === "cadastro" && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 bg-[#D4AC0D]/20 text-[#D4AC0D] text-sm font-medium px-4 py-1.5 rounded-full border border-[#D4AC0D]/30">
                Diagnóstico Gratuito
              </div>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Descubra o nível de gestão<br />do seu agronegócio
              </h1>
              <p className="text-blue-200 text-lg">
                Responda em menos de 5 minutos e receba um diagnóstico personalizado no seu e-mail.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 space-y-5">
              <h2 className="text-white font-semibold text-lg">Seus dados</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1.5">Nome completo *</label>
                  <input
                    {...form.register("nome")}
                    placeholder="Seu nome completo"
                    className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AC0D]/50 focus:border-[#D4AC0D]/50"
                  />
                  {form.formState.errors.nome && <p className="text-red-300 text-xs mt-1">{form.formState.errors.nome.message}</p>}
                </div>

                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1.5">CPF ou CNPJ *</label>
                  <input
                    {...form.register("cpf_cnpj")}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AC0D]/50 focus:border-[#D4AC0D]/50"
                  />
                  {form.formState.errors.cpf_cnpj && <p className="text-red-300 text-xs mt-1">{form.formState.errors.cpf_cnpj.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-blue-100 text-sm font-medium mb-1.5">Celular *</label>
                    <input
                      {...form.register("celular")}
                      placeholder="(00) 00000-0000"
                      className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AC0D]/50 focus:border-[#D4AC0D]/50"
                    />
                    {form.formState.errors.celular && <p className="text-red-300 text-xs mt-1">{form.formState.errors.celular.message}</p>}
                  </div>
                  <div>
                    <label className="block text-blue-100 text-sm font-medium mb-1.5">E-mail *</label>
                    <input
                      {...form.register("email")}
                      type="email"
                      placeholder="seu@email.com"
                      className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AC0D]/50 focus:border-[#D4AC0D]/50"
                    />
                    {form.formState.errors.email && <p className="text-red-300 text-xs mt-1">{form.formState.errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {erro && <p className="text-red-300 text-sm bg-red-900/30 px-4 py-2 rounded-lg">{erro}</p>}

              <button
                onClick={handleCadastro}
                disabled={isPending}
                className="w-full h-14 bg-[#D4AC0D] hover:bg-[#b8960b] disabled:opacity-60 text-white font-bold text-lg rounded-xl transition-all"
              >
                {isPending ? "Enviando..." : "Receber código de verificação →"}
              </button>

              <p className="text-xs text-blue-200/70 text-center">
                Seus dados são protegidos e não serão compartilhados com terceiros.
              </p>
            </div>

            {/* Benefícios */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { emoji: "⚡", texto: "5 minutos para responder" },
                { emoji: "📊", texto: "Diagnóstico personalizado" },
                { emoji: "📧", texto: "Resultado no seu e-mail" },
              ].map((b) => (
                <div key={b.texto} className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="text-2xl mb-2">{b.emoji}</div>
                  <p className="text-blue-100 text-xs leading-tight">{b.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === "otp" && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <div className="text-5xl">📱</div>
              <h2 className="text-2xl font-bold text-white">Verifique seu celular</h2>
              <p className="text-blue-200">
                Enviamos um código de 6 dígitos para o número informado. Digite abaixo para continuar.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 space-y-6">
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-3 text-center">Código de verificação</label>
                <input
                  value={otpCodigo}
                  onChange={(e) => setOtpCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-16 px-4 bg-white/10 border border-white/20 rounded-xl text-white text-3xl font-mono text-center tracking-widest placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D4AC0D]/50"
                  onKeyDown={(e) => { if (e.key === "Enter") handleOtp(); }}
                />
              </div>

              {erro && <p className="text-red-300 text-sm bg-red-900/30 px-4 py-2 rounded-lg text-center">{erro}</p>}

              <button
                onClick={handleOtp}
                disabled={isPending || otpCodigo.length !== 6}
                className="w-full h-14 bg-[#D4AC0D] hover:bg-[#b8960b] disabled:opacity-60 text-white font-bold text-lg rounded-xl transition-all"
              >
                {isPending ? "Verificando..." : "Verificar e continuar →"}
              </button>

              <div className="text-center">
                {reenvioContagem > 0 ? (
                  <p className="text-blue-200/70 text-sm">Reenviar código em {reenvioContagem}s</p>
                ) : (
                  <button onClick={handleReenviarOtp} disabled={isPending} className="text-[#D4AC0D] text-sm hover:underline">
                    Não recebi o código — reenviar
                  </button>
                )}
              </div>

              <button onClick={() => setStep("cadastro")} className="w-full text-blue-300/70 text-sm hover:text-blue-200">
                ← Voltar e corrigir os dados
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Questionário ── */}
        {step === "questionario" && (
          <div className="space-y-8">
            {/* Tabs dos módulos */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PERGUNTAS.map((m, idx) => (
                <button
                  key={m.chave}
                  onClick={() => setModuloAtual(idx)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    idx === moduloAtual
                      ? "bg-[#D4AC0D] text-white"
                      : moduloCompleto(idx)
                      ? "bg-green-600/30 text-green-300 border border-green-500/30"
                      : "bg-white/10 text-blue-200 border border-white/20"
                  }`}
                >
                  <span>{m.icone}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                  {moduloCompleto(idx) && idx !== moduloAtual && <span className="text-green-400">✓</span>}
                </button>
              ))}
            </div>

            {/* Módulo atual */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">{PERGUNTAS[moduloAtual].icone} {PERGUNTAS[moduloAtual].label}</h2>
                <p className="text-blue-200 text-sm mt-1">{PERGUNTAS[moduloAtual].descricao}</p>
              </div>

              {PERGUNTAS[moduloAtual].perguntas.map((pergunta, pIdx) => (
                <div key={pergunta.id} className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 space-y-4">
                  <p className="text-white font-medium leading-relaxed">
                    <span className="text-[#D4AC0D] font-bold mr-2">{pIdx + 1}.</span>
                    {pergunta.texto}
                  </p>
                  <div className="space-y-2">
                    {pergunta.opcoes.map((opcao) => (
                      <button
                        key={opcao.valor}
                        onClick={() => handleResposta(pergunta.id, opcao.valor)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                          respostas[pergunta.id] === opcao.valor
                            ? "bg-[#D4AC0D] border-[#D4AC0D] text-white font-medium"
                            : "bg-white/5 border-white/20 text-blue-100 hover:bg-white/15 hover:border-white/40"
                        }`}
                      >
                        <span className="inline-block w-5 h-5 rounded-full border-2 mr-3 align-middle shrink-0
                          ${respostas[pergunta.id] === opcao.valor ? 'border-white bg-white/30' : 'border-white/40'}">
                        </span>
                        {opcao.texto}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {erro && <p className="text-red-300 text-sm bg-red-900/30 px-4 py-2 rounded-lg">{erro}</p>}

            <div className="flex gap-3">
              {moduloAtual > 0 && (
                <button
                  onClick={() => setModuloAtual((m) => m - 1)}
                  className="flex-1 h-14 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-xl transition-all"
                >
                  ← Anterior
                </button>
              )}
              <button
                onClick={handleProximoModulo}
                disabled={!moduloCompleto(moduloAtual) || isPending}
                className="flex-1 h-14 bg-[#D4AC0D] hover:bg-[#b8960b] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all"
              >
                {isPending
                  ? "Processando..."
                  : moduloAtual < PERGUNTAS.length - 1
                  ? "Próximo módulo →"
                  : "Ver meu diagnóstico →"}
              </button>
            </div>

            {!moduloCompleto(moduloAtual) && (
              <p className="text-center text-blue-200/70 text-sm">
                Responda todas as perguntas deste módulo para continuar.
              </p>
            )}
          </div>
        )}

        {/* ── STEP 4: Vídeo + Resultado ── */}
        {step === "video" && resultado && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 text-sm font-medium px-4 py-1.5 rounded-full border border-green-500/30">
                ✓ Diagnóstico concluído
              </div>
              <h2 className="text-2xl font-bold text-white">
                Seu diagnóstico foi enviado para o seu e-mail!
              </h2>
              <p className="text-blue-200">
                Pontuação geral: <span className="text-[#D4AC0D] font-bold text-xl">{Math.round((resultado.pontuacao / resultado.maximo) * 100)}%</span>
              </p>
            </div>

            {resultado.videoId && (
              <div className="space-y-4">
                <p className="text-white font-medium text-center">Assista ao vídeo especial que preparamos para você:</p>
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/20">
                  <iframe
                    ref={videoRef}
                    src={`https://www.youtube.com/embed/${resultado.videoId}?autoplay=1&rel=0&enablejsapi=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                {resultado.urlCheckout && (
                  <p className="text-blue-200/70 text-sm text-center">
                    Ao finalizar o vídeo, você será redirecionado automaticamente.
                  </p>
                )}
              </div>
            )}

            {resultado.urlCheckout && (
              <a
                href={resultado.urlCheckout}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-16 bg-[#D4AC0D] hover:bg-[#b8960b] text-white font-bold text-lg rounded-xl transition-all text-center leading-[64px]"
              >
                Quero fazer parte do O Conselho Agro →
              </a>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
