import { listarEtapas } from "@/actions/crm";
import ConfiguracoesClient from "./configuracoes-client";

export default async function CrmConfiguracoesPage() {
  const etapas = await listarEtapas();
  return <ConfiguracoesClient etapasIniciais={etapas} />;
}
