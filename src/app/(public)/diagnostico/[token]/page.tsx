import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DiagnosticoForm from "./diagnostico-form";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DiagnosticoPublicoPage({ params }: Props) {
  const { token } = await params;

  const aplicacao = await prisma.aplicacaoDiagnostico.findUnique({
    where: { token },
    include: {
      projeto: { select: { titulo: true } },
      cliente: { select: { nome: true } },
      empresa: { select: { nome: true, logo_url: true } },
    },
  });

  if (!aplicacao) notFound();

  return (
    <DiagnosticoForm
      token={token}
      jaRespondido={aplicacao.status === "RESPONDIDO"}
      momento={aplicacao.momento}
      projeto={aplicacao.projeto.titulo}
      cliente={aplicacao.cliente?.nome ?? ""}
      empresa={{ nome: aplicacao.empresa.nome, logoUrl: aplicacao.empresa.logo_url }}
    />
  );
}
