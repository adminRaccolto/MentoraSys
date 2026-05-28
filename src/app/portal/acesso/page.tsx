import { Mail } from "lucide-react";

interface Props {
  searchParams: Promise<{ erro?: string }>;
}

const ERROS: Record<string, string> = {
  invalido: "Este link de acesso é inválido ou não existe.",
  expirado: "Este link de acesso expirou. Solicite um novo link à sua consultoria.",
};

export default async function PortalAcessoPage({ searchParams }: Props) {
  const { erro } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="size-6 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Acesso ao portal</h1>
          <p className="text-muted-foreground text-sm">
            Para acessar o portal do cliente, solicite um link de acesso à sua consultoria.
          </p>
        </div>

        {erro && ERROS[erro] && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm text-destructive">{ERROS[erro]}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          O link de acesso é enviado por e-mail e é válido por 7 dias.
        </p>
      </div>
    </div>
  );
}
