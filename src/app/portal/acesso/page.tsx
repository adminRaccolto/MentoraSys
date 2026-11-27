import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAlunoFormulario } from "@/components/portal-aluno-formulario";
import { PortalAlunoCabecalho } from "@/components/portal-aluno-cabecalho";
import { obterSessaoAluno } from "@/lib/portal-aluno-sessao";
import { alunoMentoria } from "@/lib/mentorias";
import { obterClientePortal } from "@/lib/portal-sessao";

type Props = { searchParams: Promise<{ erro?: string; mentoria?: string }> };

export default async function PortalAcessoPage({ searchParams }: Props) {
  const [{ erro, mentoria }, aluno, cliente] = await Promise.all([searchParams, obterSessaoAluno(), obterClientePortal()]);
  const destino = typeof mentoria === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(mentoria) ? mentoria : undefined;
  if (aluno) {
    if (aluno.trocarSenha) redirect("/portal/definir-senha");
    if (destino && await alunoMentoria(destino)) redirect(`/portal/mentorias/${destino}`);
    redirect("/portal/mentorias");
  }

  return (
    <PortalAlunoCabecalho titulo="Entrar na Área do Aluno" descricao="Use o e-mail cadastrado na mentoria e a sua senha.">
      {(erro === "invalido" || erro === "expirado") && (
        <p role="alert" className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">O link do portal de projetos é inválido ou expirou.</p>
      )}
      <PortalAlunoFormulario mentoria={destino} />
      <p className="text-sm text-muted-foreground">Se for seu primeiro acesso ou se esqueceu a senha, peça o convite de primeiro acesso ou uma senha provisória à equipe da mentoria.</p>
      {cliente?.tipo === "CLIENTE" && <Link href="/portal" className="text-sm font-medium text-primary underline">Voltar aos projetos</Link>}
    </PortalAlunoCabecalho>
  );
}
