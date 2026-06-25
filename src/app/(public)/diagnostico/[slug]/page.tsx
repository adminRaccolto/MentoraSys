import { notFound } from "next/navigation";
import { carregarCampanha } from "@/actions/diagnostico-publico";
import DiagnosticoWizard from "./diagnostico-wizard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DiagnosticoPage({ params }: Props) {
  const { slug } = await params;
  const campanha = await carregarCampanha(slug);

  if (!campanha) notFound();

  return <DiagnosticoWizard campanha={campanha} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const campanha = await carregarCampanha(slug);
  return {
    title: campanha?.titulo ?? "Diagnóstico Empresarial",
    description: campanha?.subtitulo ?? "Descubra o nível de gestão do seu negócio",
  };
}
