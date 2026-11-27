import Image from "next/image";

export function MarcaRaccolto({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] font-semibold tracking-[-0.06em] text-[#1d3961] ${className}`}>
      <Image src="/favicon.png" width={44} height={41} alt="" className="h-[1.36em] w-auto" loading="eager" />
      <span>Raccolto</span>
    </span>
  );
}
