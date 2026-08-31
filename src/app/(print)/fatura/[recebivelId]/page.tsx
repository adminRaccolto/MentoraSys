import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import FaturaToolbar from "./print-button";
import Image from "next/image";

type Props = { params: Promise<{ recebivelId: string }> };

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function enderecoCliente(c: {
  logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; estado: string | null; cep: string | null;
}) {
  const linha1 = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", ");
  const linha2 = [c.bairro, c.cidade, c.estado].filter(Boolean).join(" — ");
  const cep = c.cep ? `CEP ${c.cep}` : "";
  return [linha1, linha2, cep].filter(Boolean);
}

export default async function FaturaPage({ params }: Props) {
  const { recebivelId } = await params;
  const empresaId = await obterEmpresaAtiva();

  const [recebivel, empresa] = await Promise.all([
    prisma.recebivel.findFirst({
      where: { id: recebivelId, empresa_id: empresaId },
      include: {
        cliente: true,
        contrato: true,
        conta_bancaria: true,
      },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        contas_bancarias: {
          where: { ativo: true },
          orderBy: { criado_em: "asc" },
        },
      },
    }),
  ]);

  if (!recebivel || !empresa) notFound();

  // Outras parcelas em aberto do mesmo cliente (vencidas ou pendentes com data passada)
  const parcelasEmAberto = recebivel.cliente_id
    ? await prisma.recebivel.findMany({
        where: {
          empresa_id: empresaId,
          cliente_id: recebivel.cliente_id,
          id: { not: recebivelId },
          OR: [
            { status: "VENCIDO" },
            { status: "PENDENTE", data_vencimento: { lt: new Date() } },
          ],
        },
        orderBy: { data_vencimento: "asc" },
        select: {
          descricao: true, valor: true, data_vencimento: true,
          numero_parcela: true, total_parcelas: true,
        },
      })
    : [];

  const cfg = (empresa.configuracoes as Record<string, unknown>) ?? {};
  const nomeFantasia = (cfg.nome_fantasia as string) ?? "";
  const enderecoEmpresa = (cfg.endereco as string) ?? "";
  const telefoneEmpresa = (cfg.telefone as string) ?? "";
  const emailEmpresa = (cfg.email as string) ?? "";

  // Conta bancária preferida para recebimento (a do recebível, ou primeira com PIX, ou primeira ativa)
  const contaRecebimento = recebivel.conta_bancaria
    ?? empresa.contas_bancarias.find((c) => c.pix_chave)
    ?? empresa.contas_bancarias[0]
    ?? null;

  const cliente = recebivel.cliente;
  const contrato = recebivel.contrato;
  const valor = Number(recebivel.valor);

  const numFatura = recebivel.numero_parcela
    ? `${String(recebivel.numero_parcela).padStart(4, "0")}`
    : `${recebivelId.slice(0, 8).toUpperCase()}`;

  const parcelaLabel = recebivel.numero_parcela && recebivel.total_parcelas
    ? `Parcela ${recebivel.numero_parcela} de ${recebivel.total_parcelas}`
    : null;

  const linhasEndCliente = cliente ? enderecoCliente(cliente) : [];

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <FaturaToolbar title={`Fatura ${numFatura} — ${cliente?.nome ?? ""}`} recebivelId={recebivelId} />

      {/* Documento */}
      <div className="max-w-225 mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none">
        <div className="p-10 print:p-8 space-y-8">

          {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[#1B4F72]">
            {/* Emitente */}
            <div className="flex-1">
              {empresa.logo_url && (
                <div className="mb-3">
                  <Image
                    src={empresa.logo_url}
                    alt={empresa.nome}
                    width={160}
                    height={60}
                    className="object-contain max-h-14 max-w-40"
                    unoptimized
                  />
                </div>
              )}
              <p className="text-lg font-bold text-[#1B4F72] leading-tight">{empresa.nome}</p>
              {nomeFantasia && (
                <p className="text-sm text-slate-600">{nomeFantasia}</p>
              )}
              {empresa.cnpj && (
                <p className="text-sm text-slate-500">CNPJ: {empresa.cnpj}</p>
              )}
              {enderecoEmpresa && (
                <p className="text-xs text-slate-500 mt-1">{enderecoEmpresa}</p>
              )}
              <div className="flex gap-3 mt-1 text-xs text-slate-500">
                {telefoneEmpresa && <span>{telefoneEmpresa}</span>}
                {emailEmpresa && <span>{emailEmpresa}</span>}
              </div>
            </div>

            {/* Título e número */}
            <div className="text-right">
              <p className="text-4xl font-black tracking-tight text-[#1B4F72]">FATURA</p>
              <p className="text-xl font-semibold text-slate-500 mt-1">Nº {numFatura}</p>
              <div className="mt-3 text-sm space-y-0.5 text-slate-600">
                <div className="flex justify-end gap-2">
                  <span className="text-slate-400">Emissão:</span>
                  <span className="font-medium">{fmtDate(new Date())}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <span className="text-slate-400">Vencimento:</span>
                  <span className={`font-semibold ${new Date(recebivel.data_vencimento) < new Date() && recebivel.status !== "PAGO" ? "text-red-600" : "text-slate-800"}`}>
                    {fmtDate(recebivel.data_vencimento)}
                  </span>
                </div>
                {parcelaLabel && (
                  <div className="flex justify-end gap-2">
                    <span className="text-slate-400">Parcela:</span>
                    <span className="font-medium">{parcelaLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Destinatário ──────────────────────────────────────────────── */}
          {cliente && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Destinatário</p>
                <p className="font-bold text-slate-800 text-base">{cliente.nome}</p>
                {cliente.nome_fantasia && (
                  <p className="text-sm text-slate-600">{cliente.nome_fantasia}</p>
                )}
                {cliente.cpf_cnpj && (
                  <p className="text-sm text-slate-500 mt-1">CNPJ/CPF: {cliente.cpf_cnpj}</p>
                )}
                {linhasEndCliente.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    {linhasEndCliente.map((l, i) => <p key={i}>{l}</p>)}
                  </div>
                )}
                {(cliente.email || cliente.telefone) && (
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    {cliente.email && <p>{cliente.email}</p>}
                    {cliente.telefone && <p>{cliente.telefone}</p>}
                  </div>
                )}
              </div>

              {/* Contrato resumo */}
              {contrato && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contrato</p>
                  <p className="font-semibold text-slate-800">{contrato.titulo}</p>
                  {contrato.numero_contrato && (
                    <p className="text-sm text-slate-500">Nº {contrato.numero_contrato}</p>
                  )}
                  {contrato.objeto && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{contrato.objeto}</p>
                  )}
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    {contrato.data_inicio && (
                      <p>Início: {fmtDate(contrato.data_inicio)}</p>
                    )}
                    {contrato.data_fim && (
                      <p>Término: {fmtDate(contrato.data_fim)}</p>
                    )}
                    {contrato.forma_pagamento && (
                      <p>Pagamento: {contrato.forma_pagamento}</p>
                    )}
                    {contrato.periodicidade && (
                      <p>Periodicidade: {contrato.periodicidade.toLowerCase()}</p>
                    )}
                    {contrato.valor_total && Number(contrato.valor_total) > 0 && (
                      <p>Valor total do contrato: <strong>{fmtBRL(Number(contrato.valor_total))}</strong></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Descrição do serviço ───────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Descrição dos Serviços</p>
            <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-[#1B4F72] text-white">
                  <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                  {parcelaLabel && <th className="text-center px-4 py-2.5 font-medium whitespace-nowrap">Parcela</th>}
                  <th className="text-center px-4 py-2.5 font-medium whitespace-nowrap">Vencimento</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{recebivel.descricao}</td>
                  {parcelaLabel && (
                    <td className="px-4 py-3 text-center text-slate-600">
                      {recebivel.numero_parcela}/{recebivel.total_parcelas}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-slate-600">
                    {fmtDate(recebivel.data_vencimento)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {fmtBRL(valor)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Total ────────────────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="bg-[#1B4F72] text-white rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-80">Total a pagar</span>
                  <span className="text-2xl font-black">{fmtBRL(valor)}</span>
                </div>
                {recebivel.forma_pagamento && (
                  <p className="text-xs opacity-70 mt-1 text-right">{recebivel.forma_pagamento}</p>
                )}
              </div>
              {parcelasEmAberto.length > 0 && (() => {
                const totalVencido = parcelasEmAberto.reduce((s, p) => s + Number(p.valor), 0);
                const totalDevido = valor + totalVencido;
                return (
                  <div className="bg-red-700 text-white rounded-lg p-4">
                    <div className="flex justify-between items-baseline gap-4">
                      <div>
                        <p className="text-sm font-semibold leading-tight">Total devido</p>
                        <p className="text-xs opacity-75 mt-0.5">Esta fatura + {parcelasEmAberto.length} vencida{parcelasEmAberto.length > 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-2xl font-black whitespace-nowrap">{fmtBRL(totalDevido)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Dados para Pagamento ─────────────────────────────────────────── */}
          {contaRecebimento && (
            <div className="border border-slate-200 rounded-lg p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados para Pagamento</p>
              <div className="grid grid-cols-2 gap-6">
                {contaRecebimento.pix_chave && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Chave PIX</p>
                    <p className="font-mono text-sm font-semibold text-[#1B4F72] break-all">
                      {contaRecebimento.pix_chave}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Favorecido: {empresa.nome}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Dados Bancários</p>
                  <div className="text-sm text-slate-700 space-y-0.5">
                    {contaRecebimento.banco && <p>Banco: {contaRecebimento.banco}</p>}
                    {contaRecebimento.agencia && <p>Agência: {contaRecebimento.agencia}</p>}
                    {contaRecebimento.conta && (
                      <p>
                        Conta: {contaRecebimento.conta}{contaRecebimento.digito ? `-${contaRecebimento.digito}` : ""}
                        {" "}({contaRecebimento.tipo === "CORRENTE" ? "C/C" : contaRecebimento.tipo === "POUPANCA" ? "C/P" : contaRecebimento.tipo})
                      </p>
                    )}
                    {empresa.cnpj && <p>CNPJ: {empresa.cnpj}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Parcelas em aberto ────────────────────────────────────────── */}
          {parcelasEmAberto.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
                ⚠️ Parcelas em aberto ({parcelasEmAberto.length})
              </p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="text-left pb-2 font-semibold text-amber-800">Descrição</th>
                    <th className="text-center pb-2 font-semibold text-amber-800 whitespace-nowrap">Vencimento</th>
                    <th className="text-right pb-2 font-semibold text-amber-800">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelasEmAberto.map((p, i) => {
                    const parcLabel = p.numero_parcela && p.total_parcelas
                      ? ` (${p.numero_parcela}/${p.total_parcelas})`
                      : "";
                    return (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="py-2 text-slate-700">{p.descricao}{parcLabel}</td>
                        <td className="py-2 text-center font-semibold text-red-600 whitespace-nowrap">
                          {fmtDate(p.data_vencimento)}
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-800">
                          {fmtBRL(Number(p.valor))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-amber-300">
                    <td colSpan={2} className="pt-2 text-sm font-semibold text-amber-800">Total em aberto</td>
                    <td className="pt-2 text-right font-bold text-amber-900">
                      {fmtBRL(parcelasEmAberto.reduce((s, p) => s + Number(p.valor), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-amber-700 mt-3">
                Caso já tenha efetuado o pagamento, pedimos que entre em contato.
              </p>
            </div>
          )}

          {/* ── Observações ───────────────────────────────────────────────── */}
          {recebivel.observacoes && (
            <div className="text-xs text-slate-500 border-t border-slate-100 pt-4">
              <p className="font-medium mb-1">Observações:</p>
              <p>{recebivel.observacoes}</p>
            </div>
          )}

          {/* ── Rodapé ────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p>{empresa.nome}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}</p>
            {enderecoEmpresa && <p>{enderecoEmpresa}</p>}
            {(telefoneEmpresa || emailEmpresa) && (
              <p>{[telefoneEmpresa, emailEmpresa].filter(Boolean).join(" · ")}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
