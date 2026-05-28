import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import EditorClient from "./editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditorModeloPage({ params }: Props) {
  const { id } = await params;
  const empresaId = await obterEmpresaAtiva();

  const modelo = await prisma.modeloDocumento.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!modelo) notFound();

  return <EditorClient modelo={modelo} />;
}
