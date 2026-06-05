import Image from "next/image";

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
          backgroundColor: "#1B4F72",
        }}
      >
        {/* overlay */}
        <div className="absolute inset-0 bg-[#1B4F72]/70" />

        {/* logo centralizada */}
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          <Image
            src="/logo-raccolto.png"
            alt="Raccolto"
            width={260}
            height={120}
            className="object-contain drop-shadow-lg"
            priority
          />
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          {/* logo mobile */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/logo-raccolto.png"
              alt="Raccolto"
              width={160}
              height={70}
              className="object-contain"
              priority
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
