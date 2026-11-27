import { redirect } from "next/navigation";
import { sairPortalAluno } from "@/actions/portal-aluno";
import { PortalAlunoCabecalho } from "@/components/portal-aluno-cabecalho";
import { PortalAlunoFormulario } from "@/components/portal-aluno-formulario";
import { obterSessaoAluno } from "@/lib/portal-aluno-sessao";

export default async function DefinirSenhaAlunoPage() {
  const sessao = await obterSessaoAluno();
  if (!sessao) redirect("/portal/acesso");
  if (!sessao.trocarSenha) redirect("/portal/mentorias");

  return (
    <PortalAlunoCabecalho titulo="Crie sua senha" descricao="Escolha uma senha pessoal com pelo menos 12 caracteres para acessar sua mentoria.">
      <PortalAlunoFormulario troca />
      <form action={sairPortalAluno}>
        <button type="submit" className="text-sm font-medium text-primary underline">Voltar ao login</button>
      </form>
    </PortalAlunoCabecalho>
  );
}
