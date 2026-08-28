import { notFound } from "next/navigation";
import { obterReembolso } from "@/actions/reembolsos";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import PrintButton from "./print-button";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cliente_id?: string }>;
};

const TIPO_LABELS: Record<string, string> = {
  DESLOCAMENTO: "Deslocamento",
  REFEICAO: "Refeição",
  HOTEL: "Hotel",
  PEDAGIO: "Pedágio",
};

function fmtBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function periodoLabel(p: string) {
  const [ano, mes] = p.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(mes) - 1]} de ${ano}`;
}

export default async function ReembolsoImprimivel({ params, searchParams }: Props) {
  const { id } = await params;
  const { cliente_id } = await searchParams;
  const empresaId = await obterEmpresaAtiva();

  const [reembolso, empresa] = await Promise.all([
    obterReembolso(id),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
  ]);

  if (!reembolso || !empresa) notFound();

  const todosClientesIds = [...new Set(reembolso.itens.flatMap((i) => i.clientes_ids))];
  const clientes = todosClientesIds.length > 0
    ? await prisma.cliente.findMany({
        where: { id: { in: todosClientesIds } },
        select: { id: true, nome: true },
      })
    : [];
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));

  const cfg = (empresa.configuracoes as Record<string, unknown>) ?? {};
  const enderecoEmpresa = (cfg.endereco as string) ?? "";

  // ── Relatório por cliente (valores rateados) ─────────────────────────────
  if (cliente_id) {
    const clienteNome = clienteMap[cliente_id] ?? "Cliente";

    // Nº total de clientes distintos no reembolso (para ratear outras despesas)
    const clientesNoReembolso = [...new Set(
      reembolso.itens.filter((i) => i.tipo === "DESLOCAMENTO").flatMap((i) => i.clientes_ids)
    )];
    const numClientesTotal = Math.max(clientesNoReembolso.length, 1);

    // Deslocamentos: rateio por item (conforme clientes de cada item)
    const deslocamentos = reembolso.itens
      .filter((i) => i.tipo === "DESLOCAMENTO" && i.clientes_ids.includes(cliente_id))
      .map((i) => {
        const valorTotal = Number(i.valor);
        const qtdClientes = i.clientes_ids.length;
        const valorRateio = qtdClientes > 0 ? valorTotal / qtdClientes : valorTotal;
        const outrosClientes = i.clientes_ids
          .filter((cid) => cid !== cliente_id)
          .map((cid) => clienteMap[cid] ?? cid);
        return {
          ...i,
          valorTotal,
          valorRateio,
          km: i.km != null ? Number(i.km) : null,
          valor_km: i.valor_km != null ? Number(i.valor_km) : null,
          outrosClientes,
          qtdClientes,
        };
      });

    // Outras despesas (refeição, hotel, pedágio): rateadas igualmente entre todos os clientes
    const outrasDespesas = reembolso.itens
      .filter((i) => i.tipo !== "DESLOCAMENTO")
      .map((i) => ({
        ...i,
        valorTotal: Number(i.valor),
        valorRateio: Number(i.valor) / numClientesTotal,
      }));

    const totalDeslocamento = deslocamentos.reduce((s, i) => s + i.valorRateio, 0);
    const totalOutras = outrasDespesas.reduce((s, i) => s + i.valorRateio, 0);
    const totalCliente = totalDeslocamento + totalOutras;

    return (
      <div className="min-h-screen bg-slate-100 print:bg-white">
        <PrintButton />

        <div className="max-w-3xl mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none">
          <div className="p-10 print:p-8 space-y-8">

            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[#1B4F72]">
              <div>
                <p className="text-xl font-bold text-[#1B4F72]">{empresa.nome}</p>
                {empresa.cnpj && <p className="text-sm text-slate-500">CNPJ: {empresa.cnpj}</p>}
                {enderecoEmpresa && <p className="text-xs text-slate-500 mt-0.5">{enderecoEmpresa}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#1B4F72] uppercase tracking-wide">
                  Relatório de Reembolso
                </p>
                <p className="text-lg text-slate-500 mt-1">{periodoLabel(reembolso.periodo)}</p>
                {reembolso.descricao && (
                  <p className="text-sm text-slate-600 mt-1">{reembolso.descricao}</p>
                )}
              </div>
            </div>

            {/* Destinatário */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
              <p className="text-lg font-bold text-slate-800">{clienteNome}</p>
            </div>

            {/* Deslocamentos */}
            {deslocamentos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Deslocamento
                </p>
                <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
                  <thead>
                    <tr className="bg-[#1B4F72] text-white">
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">km</th>
                      <th className="text-left px-3 py-2 font-medium">R$/km</th>
                      <th className="text-left px-3 py-2 font-medium">Rateio</th>
                      <th className="text-right px-3 py-2 font-medium">Seu valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deslocamentos.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(item.data)}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.km != null ? `${item.km} km` : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.valor_km != null ? `R$ ${item.valor_km.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {item.qtdClientes > 1 ? (
                            <>
                              <span className="font-medium text-slate-700">
                                {fmtBRL(item.valorTotal)} ÷ {item.qtdClientes}
                              </span>
                              {item.outrosClientes.length > 0 && (
                                <span className="block text-slate-400 mt-0.5">
                                  Compartilhado com: {item.outrosClientes.join(", ")}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">Exclusivo</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#1B4F72]">
                          {fmtBRL(item.valorRateio)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-slate-600">
                        Subtotal deslocamento
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{fmtBRL(totalDeslocamento)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Outras despesas rateadas */}
            {outrasDespesas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Outras despesas
                </p>
                <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
                  <thead>
                    <tr className="bg-[#1B4F72] text-white">
                      <th className="text-left px-3 py-2 font-medium">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      <th className="text-left px-3 py-2 font-medium">Rateio</th>
                      <th className="text-right px-3 py-2 font-medium">Seu valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outrasDespesas.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {TIPO_LABELS[item.tipo] ?? item.tipo}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(item.data)}</td>
                        <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {numClientesTotal > 1 ? (
                            <span className="font-medium text-slate-700">
                              {fmtBRL(item.valorTotal)} ÷ {numClientesTotal}
                            </span>
                          ) : (
                            <span className="text-slate-400">Exclusivo</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#1B4F72]">
                          {fmtBRL(item.valorRateio)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-slate-600">
                        Subtotal outras despesas
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{fmtBRL(totalOutras)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-72 bg-[#1B4F72] text-white rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-80">Total a reembolsar</span>
                  <span className="text-2xl font-black">{fmtBRL(totalCliente)}</span>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="border-t border-slate-200 pt-6 flex justify-between items-end text-xs text-slate-400">
              <div>
                <p>{empresa.nome}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}</p>
                <p className="mt-0.5">Relatório gerado em {fmtDate(new Date())}</p>
              </div>
              <div className="text-right space-y-6">
                <div className="border-t border-slate-300 pt-2 w-48 text-center">
                  <p>Assinatura / Responsável</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Relatório interno completo ────────────────────────────────────────────

  const tipos = ["DESLOCAMENTO", "REFEICAO", "HOTEL", "PEDAGIO"] as const;
  const itensNorm = reembolso.itens.map((i) => ({
    ...i,
    valor: Number(i.valor),
    km: i.km != null ? Number(i.km) : null,
    valor_km: i.valor_km != null ? Number(i.valor_km) : null,
  }));

  const porTipo = tipos.map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo],
    itens: itensNorm.filter((i) => i.tipo === tipo),
    subtotal: itensNorm
      .filter((i) => i.tipo === tipo)
      .reduce((s, i) => s + i.valor, 0),
  })).filter((g) => g.itens.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintButton />

      <div className="max-w-225 mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none">
        <div className="p-10 print:p-8 space-y-8">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[#1B4F72]">
            <div>
              <p className="text-xl font-bold text-[#1B4F72]">{empresa.nome}</p>
              {empresa.cnpj && <p className="text-sm text-slate-500">CNPJ: {empresa.cnpj}</p>}
              {enderecoEmpresa && <p className="text-xs text-slate-500 mt-0.5">{enderecoEmpresa}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#1B4F72]">REEMBOLSO</p>
              <p className="text-lg text-slate-500 mt-1">{periodoLabel(reembolso.periodo)}</p>
              {reembolso.descricao && (
                <p className="text-sm text-slate-600 mt-1">{reembolso.descricao}</p>
              )}
              <div className="mt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  reembolso.status === "PAGO"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {reembolso.status === "PAGO" ? "Pago" : "Em aberto"}
                </span>
              </div>
            </div>
          </div>

          {/* Tabelas por tipo */}
          {porTipo.map(({ tipo, label, itens, subtotal }) => (
            <div key={tipo}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {label}
              </p>
              <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
                <thead>
                  <tr className="bg-[#1B4F72] text-white">
                    <th className="text-left px-3 py-2 font-medium">Data</th>
                    <th className="text-left px-3 py-2 font-medium">Descrição</th>
                    {tipo === "DESLOCAMENTO" && (
                      <>
                        <th className="text-center px-3 py-2 font-medium">km</th>
                        <th className="text-center px-3 py-2 font-medium">R$/km</th>
                        <th className="text-left px-3 py-2 font-medium">Clientes</th>
                      </>
                    )}
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const nomesClientes = item.clientes_ids
                      .map((cid) => clienteMap[cid] ?? cid)
                      .join(", ");
                    const rateio = item.clientes_ids.length > 1
                      ? Number(item.valor) / item.clientes_ids.length
                      : null;
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(item.data)}</td>
                        <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                        {tipo === "DESLOCAMENTO" && (
                          <>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {item.km != null ? item.km : "—"}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {item.valor_km != null ? `R$ ${item.valor_km.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-xs">
                              {nomesClientes || "—"}
                              {rateio && (
                                <span className="block text-slate-400">
                                  Rateio: {fmtBRL(rateio)}/cliente
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right font-semibold">{fmtBRL(item.valor)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td colSpan={tipo === "DESLOCAMENTO" ? 5 : 2}
                      className="px-3 py-2 text-sm font-semibold text-slate-600">
                      Subtotal {label}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{fmtBRL(subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Total geral */}
          <div className="flex justify-end">
            <div className="w-64 bg-[#1B4F72] text-white rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-80">Total a reembolsar</span>
                <span className="text-2xl font-black">{fmtBRL(Number(reembolso.total))}</span>
              </div>
            </div>
          </div>

          {/* Resumo por categoria */}
          {porTipo.length > 1 && (
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resumo por categoria</p>
              <div className="space-y-1">
                {porTipo.map(({ label, subtotal }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium">{fmtBRL(subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p>{empresa.nome}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}</p>
            <p className="mt-1">Relatório gerado em {fmtDate(new Date())}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
