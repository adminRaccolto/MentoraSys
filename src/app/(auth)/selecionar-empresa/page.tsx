import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SelecionarEmpresaClient from "./selecionar-empresa-client";

export default async function SelecionarEmpresaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const membros = await prisma.membroEmpresa.findMany({
    where: { usuario_id: user.id, ativo: true },
    include: {
      empresa: { select: { id: true, nome: true, logo_url: true, plano: true } },
      perfil: { select: { nome: true } },
    },
    orderBy: { empresa: { nome: "asc" } },
  });

  return <SelecionarEmpresaClient membros={membros} />;
}
