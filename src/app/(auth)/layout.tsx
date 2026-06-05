export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Painel esquerdo — imagem de fundo ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          backgroundImage: "url('/login-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#1B4F72", // fallback enquanto não há imagem
        }}
      >
        {/* overlay azul petróleo */}
        <div className="absolute inset-0 bg-[#1B4F72]/80" />

        {/* conteúdo sobre a imagem */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#D4AC0D] flex items-center justify-center">
              <span className="text-[#1B4F72] font-black text-lg">M</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">MentoraSys</span>
          </div>

          <div className="space-y-4">
            <blockquote className="text-white/90 text-2xl font-light leading-relaxed">
              &ldquo;Gestão inteligente para o agronegócio e empresas que buscam resultados reais.&rdquo;
            </blockquote>
            <p className="text-white/50 text-sm">
              Consultoria em gestão financeira, administrativa, estratégica e agroempresarial.
            </p>
          </div>

          <div className="flex gap-1.5">
            <div className="h-1 w-8 rounded-full bg-[#D4AC0D]" />
            <div className="h-1 w-3 rounded-full bg-white/30" />
            <div className="h-1 w-3 rounded-full bg-white/30" />
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          {/* logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="size-8 rounded-lg bg-[#1B4F72] flex items-center justify-center">
              <span className="text-[#D4AC0D] font-black text-sm">M</span>
            </div>
            <span className="text-[#1B4F72] font-bold text-lg">MentoraSys</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
