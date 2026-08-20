import { listarReembolsos, listarClientesParaDeslocamento } from "@/actions/reembolsos";
import ReembolsoClient from "./reembolso-client";

export default async function ReembolsoPage() {
  const [reembolsos, clientes] = await Promise.all([
    listarReembolsos(),
    listarClientesParaDeslocamento(),
  ]);

  return <ReembolsoClient reembolsos={reembolsos} clientes={clientes} />;
}
