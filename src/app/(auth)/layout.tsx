import Image from "next/image";
import { MarcaRaccolto } from "@/components/marca-raccolto";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-auth grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative hidden min-h-dvh overflow-hidden bg-[#162e4c] lg:block" aria-hidden>
        <Image src="/login-raccolto-agro.webp" alt="" fill sizes="50vw" className="object-cover object-[center_45%]" loading="eager" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-[#142a47]/45" />
      </div>
      <div className="grid min-h-dvh place-items-center p-4 sm:p-10">
        <div className="w-full max-w-[30rem]">
          <MarcaRaccolto className="mb-7 text-3xl" />
          <div className="rounded-2xl border border-[#dce4ed] bg-white p-5 shadow-[0_12px_42px_#17273b10] sm:p-9">{children}</div>
        </div>
      </div>
    </main>
  );
}
