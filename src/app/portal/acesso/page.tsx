import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAlunoFormulario } from "@/components/portal-aluno-formulario";
import { PortalAlunoCabecalho } from "@/components/portal-aluno-cabecalho";
import { obterSessaoAluno } from "@/lib/portal-aluno-sessao";
import { obterClientePortal } from "@/lib/portal-sessao";

type Props = { searchParams: Promise<{ erro?: string }> };

export default async function PortalAcessoPage({ searchParams }: Props) {
  const [{ erro }, aluno, cliente] = await Promise.all([searchParams, obterSessaoAluno(), obterClientePortal()]);
  if (aluno) redirect(aluno.trocarSenha ? "/portal/definir-senha" : "/portal/mentorias");

  return (
    <PortalAlunoCabecalho titulo="Entrar na Área do Aluno" descricao="Use o e-mail cadastrado na mentoria e a sua senha.">
      {(erro === "invalido" || erro === "expirado") && (
        <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">O link do portal de projetos é inválido ou expirou.</p>
      )}
      <PortalAlunoFormulario />
      <p className="text-sm text-muted-foreground">Se for seu primeiro acesso ou se esqueceu a senha, peça uma senha provisória à equipe da mentoria.</p>
      {cliente?.tipo === "CLIENTE" && <Link href="/portal" className="text-sm font-medium text-primary underline">Voltar aos projetos</Link>}
    </PortalAlunoCabecalho>
  );
}
