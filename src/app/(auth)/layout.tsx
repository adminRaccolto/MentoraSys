import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#0d2b45",
      }}
    >
      {/* Overlay navy */}
      <div className="absolute inset-0 bg-[#1B4F72]/70" />

      {/* Partícula decorativa — brilho superior */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#D4AC0D]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#1B4F72]/40 blur-3xl pointer-events-none" />

      {/* Conteúdo central */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo-raccolto.svg"
            alt="Raccolto"
            width={260}
            height={110}
            className="object-contain drop-shadow-xl"
            priority
          />
        </div>

        {/* Glass card */}
        <div className="w-full rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="p-8">
            {children}
          </div>
        </div>

        <p className="mt-6 text-white/40 text-xs text-center">
          © {new Date().getFullYear()} Raccolto · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
