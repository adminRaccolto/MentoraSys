import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import CampanhaClient from "./campanha-client";

export default async function CrmDiagnosticoPage() {
  const empresaId = await obterEmpresaAtiva();

  const [campanhas, empresa] = await Promise.all([
    prisma.campanhaDiagnostico.findMany({
      where: { empresa_id: empresaId },
      include: { _count: { select: { participantes: true } } },
      orderBy: { criado_em: "desc" },
    }),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { slug: true } }),
  ]);

  return <CampanhaClient campanhasIniciais={campanhas} empresaSlug={empresa?.slug ?? ""} />;
}
