import { Video } from "lucide-react";
import { notFound } from "next/navigation";
import { salvarIntegracaoZoom, testarIntegracaoZoom } from "@/actions/mentorias-zoom";
import { CabecalhoModulo } from "@/components/cabecalho-modulo";
import { Formulario } from "@/components/mentorias/formulario";
import { caixa, campo, LinkExterno, rotulo, VoltarMentorias } from "@/components/mentorias/painel";
import { obterConfiguracaoZoom, podeSalvarConfiguracaoZoom } from "@/lib/mentorias-zoom-config";
import { obterEmpresaAtiva, verificarPermissao } from "@/lib/permissoes";

export default async function IntegracaoZoomPage() {
  const permitido = await verificarPermissao("configuracoes", "editar").then(() => true, () => false);
  if (!permitido) notFound();

  const empresaId = await obterEmpresaAtiva();
  const podeSalvar = podeSalvarConfiguracaoZoom();
  const result = await obterConfiguracaoZoom(empresaId).then((config) => ({ config, erro: false }), () => ({ config: null, erro: true }));
  const config = result.config;
  const callback = `https://app.raccolto.com.br/api/webhooks/zoom/${encodeURIComponent(empresaId)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-7">
      <VoltarMentorias href="/mentorias">Mentorias</VoltarMentorias>
      <CabecalhoModulo titulo="Integração Zoom" icone={<Video />} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className={caixa} aria-labelledby="titulo-credenciais">
          <h2 id="titulo-credenciais" className="text-lg font-semibold">Credenciais da empresa</h2>
          {result.erro
            ? <p role="alert" className="text-sm text-destructive">Não foi possível ler a configuração. Confira a chave de armazenamento da integração.</p>
            : <p className="text-sm text-muted-foreground">{config ? "Credenciais cadastradas." : "Zoom ainda não configurado para esta empresa."}</p>}
          {!podeSalvar && <p role="status" className="text-sm text-muted-foreground">O armazenamento seguro da integração precisa estar habilitado para salvar as credenciais.</p>}
          {podeSalvar && !result.erro && (
            <Formulario acao={salvarIntegracaoZoom} botao="Salvar configuração" variant="default">
              <label className={rotulo}>Account ID<input name="conta" defaultValue={config?.conta} autoComplete="off" maxLength={128} required className={campo} /></label>
              <label className={rotulo}>Client ID<input name="cliente" defaultValue={config?.cliente} autoComplete="off" maxLength={128} required className={campo} /></label>
              <label className={rotulo}>Client Secret<input type="password" name="segredo" autoComplete="new-password" maxLength={256} required={!config}
                placeholder={config ? "Deixe em branco para manter o atual" : undefined} className={campo} /></label>
              <label className={rotulo}>E-mail ou ID do anfitrião<input name="anfitriao" defaultValue={config?.anfitriao} maxLength={254} required className={campo} /></label>
              <label className={rotulo}>Secret Token do webhook<input type="password" name="webhook" autoComplete="new-password" maxLength={256}
                placeholder={config?.webhook ? "Deixe em branco para manter o atual" : "Opcional para criar salas"} className={campo} /></label>
            </Formulario>
          )}
          {config && <Formulario acao={testarIntegracaoZoom} botao="Testar autenticação" />}
        </section>
        <section className={caixa} aria-labelledby="titulo-webhook">
          <h2 id="titulo-webhook" className="text-lg font-semibold">Configuração no Zoom Marketplace</h2>
          <p className="text-sm text-muted-foreground">Use um aplicativo Server-to-Server OAuth com permissões para criar, editar e excluir reuniões do anfitrião.</p>
          <LinkExterno href="https://developers.zoom.us/docs/internal-apps/s2s-oauth/">Guia de configuração do Zoom</LinkExterno>
          <label className={rotulo}>URL de notificações
            <input className={campo} readOnly defaultValue={callback} />
          </label>
          <p className="text-sm text-muted-foreground">Cadastre esta URL e valide o webhook no Zoom para os eventos de entrada de participante e de gravação concluída.</p>
          <ul className="list-inside list-disc space-y-1 break-all text-sm">
            <li><code>meeting.participant_joined</code></li>
            <li><code>recording.completed</code></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
