import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh grid-rows-[9rem_1fr] bg-[#f3f5ed] lg:grid-rows-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div className="relative overflow-hidden bg-[#172e29]" aria-hidden>
        <Image src="/login-raccolto-agro.webp" alt="" fill sizes="(max-width: 1023px) 100vw, 50vw" className="object-cover object-[center_43%] lg:object-center" loading="eager" />
        <div className="absolute inset-0 bg-linear-to-b from-[#172e29]/20 via-transparent to-[#0d211c]/80" />
        <div className="absolute bottom-11 left-11 right-11 hidden border-t border-white/40 pt-6 text-white lg:block">
          <p className="font-serif text-5xl tracking-tight">MentoraSys</p>
          <p className="mt-2 text-sm text-[#e7dfc6]">Gestão Raccolto</p>
        </div>
      </div>

      <div className="grid place-items-center px-4 py-8 sm:p-10">
        <div className="w-full max-w-[30rem]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Image src="/logo-raccolto.svg" alt="Raccolto" width={145} height={48} className="h-10 w-auto" />
            <span className="text-sm font-medium text-[#40584a] lg:hidden">MentoraSys</span>
          </div>
          <div className="rounded-[1.35rem] border bg-white p-5 shadow-[0_10px_32px_#334a3110] sm:p-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
