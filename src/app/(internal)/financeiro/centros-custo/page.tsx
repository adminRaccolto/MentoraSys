import { listarCentrosCusto } from "@/actions/centros-custo";
import CentrosCustoClient from "./centros-custo-client";

export default async function CentrosCustoPage() {
  const centros = await listarCentrosCusto();
  return <CentrosCustoClient centros={centros} />;
}
