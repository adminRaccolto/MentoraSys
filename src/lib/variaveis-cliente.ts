export function fmtCpfCnpj(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return v ?? "";
}

function fmtCep(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v ?? "";
}

function fmtTelefone(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

interface ClienteEndereco {
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

// Snapshot gravado no contrato tem prioridade sobre o cadastro atual do cliente.
export function variaveisCliente(
  cliente: ClienteEndereco,
  snapshot?: { nome?: string | null; cpf_cnpj?: string | null },
): Record<string, string> {
  // Nos modelos, {{cliente.logradouro}} é usado como linha de endereço: inclui número, complemento e bairro.
  const linhaEndereco = [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(", "),
    cliente.complemento,
    cliente.bairro,
  ].filter(Boolean).join(" - ");

  const enderecoCompleto = [
    linhaEndereco,
    [cliente.cidade, cliente.estado].filter(Boolean).join(" - "),
    cliente.cep ? `CEP ${fmtCep(cliente.cep)}` : "",
  ].filter(Boolean).join(", ");

  return {
    "cliente.nome": snapshot?.nome || cliente.nome,
    "cliente.cpf_cnpj": fmtCpfCnpj(snapshot?.cpf_cnpj || cliente.cpf_cnpj),
    "cliente.email": cliente.email ?? "",
    "cliente.telefone": fmtTelefone(cliente.telefone),
    "cliente.logradouro": linhaEndereco,
    "cliente.numero": cliente.numero ?? "",
    "cliente.complemento": cliente.complemento ?? "",
    "cliente.bairro": cliente.bairro ?? "",
    "cliente.cidade": cliente.cidade ?? "",
    "cliente.estado": cliente.estado ?? "",
    "cliente.cep": fmtCep(cliente.cep),
    "cliente.endereco": enderecoCompleto,
  };
}
