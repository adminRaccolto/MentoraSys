import Link from "next/link";
import { PortalAlunoCabecalho } from "@/components/portal-aluno-cabecalho";
import { PortalAlunoFormulario } from "@/components/portal-aluno-formulario";
import { buscarConviteMentoria } from "@/lib/convite-mentoria";

export const metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function AtivarMentoriaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const convite = await buscarConviteMentoria(token);
  return (
    <PortalAlunoCabecalho titulo={convite ? "Crie sua senha" : "Convite indisponível"}
      descricao={convite ? `Defina sua senha para acessar ${convite.aluno.mentoria.nome}.` : "Se já criou sua senha, entre na Área do Aluno. Se precisar, peça outro convite à equipe."}>
      {convite && <PortalAlunoFormulario troca convite={token} />}
      <Link href="/portal/acesso" className="text-sm font-medium text-primary underline">Ir para o login</Link>
    </PortalAlunoCabecalho>
  );
}
