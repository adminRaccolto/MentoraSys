"use client";

import { useState, useRef } from "react";
import { CheckCircle, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { solicitarOtpAceite, confirmarOtpAceite } from "@/actions/propostas";

type Stage = "inicio" | "otp" | "aceito";

export function AceiteActions({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>("inicio");
  const [emailMasked, setEmailMasked] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSolicitar() {
    setLoading(true);
    setError("");
    const res = await solicitarOtpAceite(token);
    setLoading(false);
    if ("error" in res) {
      setError(res.error ?? "Erro ao enviar código.");
      return;
    }
    setEmailMasked(res.email_masked ?? "");
    setStage("otp");
  }

  async function handleConfirmar() {
    const code = digits.join("");
    if (code.length < 4) { setError("Digite os 4 dígitos do código."); return; }
    setLoading(true);
    setError("");
    const res = await confirmarOtpAceite(token, code);
    setLoading(false);
    if (res && "error" in res) {
      setError(res.error ?? "Código inválido.");
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
      return;
    }
    setStage("aceito");
  }

  function handleDigit(index: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    setError("");
    if (v && index < 3) inputs.current[index + 1]?.focus();
    if (!v && index > 0) inputs.current[index - 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 3) inputs.current[index + 1]?.focus();
    if (e.key === "Enter") handleConfirmar();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (text.length === 4) {
      setDigits(text.split(""));
      inputs.current[3]?.focus();
    }
  }

  if (stage === "aceito") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle className="size-14 text-green-600" />
        <p className="text-xl font-bold text-green-700">Proposta aceita com sucesso!</p>
        <p className="text-sm text-gray-500 text-center">
          Sua confirmação foi registrada. Nossa equipe entrará em contato em breve.
        </p>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="size-4 shrink-0" />
          <span>
            Enviamos um código de 4 dígitos para <strong>{emailMasked}</strong>.
            <br />O código é válido por 10 minutos.
          </span>
        </div>

        <div className="flex gap-3" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-16 text-center text-3xl font-bold border-2 rounded-xl focus:border-[#1B4F72] focus:outline-none transition-colors"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          onClick={handleConfirmar}
          disabled={loading || digits.join("").length < 4}
          size="lg"
          className="w-full max-w-xs bg-[#1B4F72] hover:bg-[#154060] text-white"
        >
          {loading ? "Verificando..." : "Confirmar aceite"}
        </Button>

        <button
          type="button"
          onClick={handleSolicitar}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline"
        >
          <RefreshCw className="size-3" />
          Reenviar código
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <Button
        onClick={handleSolicitar}
        disabled={loading}
        size="lg"
        className="w-full max-w-xs bg-[#1B4F72] hover:bg-[#154060] text-white text-base py-6"
      >
        <CheckCircle className="size-5 mr-2" />
        {loading ? "Aguarde..." : "Aceitar proposta"}
      </Button>
      <p className="text-xs text-gray-500 text-center">
        Você receberá um código de confirmação por e-mail antes de finalizar o aceite.
      </p>
    </div>
  );
}
