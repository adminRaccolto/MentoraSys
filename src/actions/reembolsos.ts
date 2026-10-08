"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { enviarReembolso } from "@/lib/email";
import type { ReembolsoItem } from "@/lib/generated/prisma";

const schemaItem = z.object({
  tipo: z.enum(["DESLOCAMENTO", "REFEICAO", "HOTEL", "PEDAGIO"]),
  data: z.string().min(1),
  descricao: z.string().min(1),
  valor: z.coerce.number().positive(),
  km: z.coerce.number().nonnegative().optional().nullable(),
  valor_km: z.coerce.number().nonnegative().optional().nullable(),
  clientes_ids: z.array(z.string()).optional().default([]),
});

const schemaReembolso = z.object({
  periodo: z.string().min(1),
  descricao: z.string().optional(),
  itens: z.array(schemaItem).min(1, "Adicione ao menos um item"),
});

type InputReembolso = z.input<typeof schemaReembolso>;

export async function listarReembolsos() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.reembolso.findMany({
    where: { empresa_id: empresaId },
    include: { itens: true },
    orderBy: { criado_em: "desc" },
  });
}

export async function obterReembolso(id: string) {
  const empresaId = await obterEmpresaAtiva();
  return prisma.reembolso.findFirst({
    where: { id, empresa_id: empresaId },
    include: { itens: true },
  });
}

export async function criarReembolso(input: InputReembolso) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaReembolso.parse(input);
  const total = data.itens.reduce((s, i) => s + i.valor, 0);

  const r = await prisma.reembolso.create({
    data: {
      empresa_id: empresaId,
      periodo: data.periodo,
      descricao: data.descricao || null,
      total,
      itens: {
        create: data.itens.map((i) => ({
          tipo: i.tipo,
          data: new Date(i.data),
          descricao: i.descricao,
          valor: i.valor,
          km: i.km ?? null,
          valor_km: i.valor_km ?? null,
          clientes_ids: i.clientes_ids ?? [],
        })),
      },
    },
  });

  revalidatePath("/relatorios/reembolso");
  return r;
}

export async function editarReembolso(id: string, input: InputReembolso) {
  const empresaId = await obterEmpresaAtiva();
  const data = schemaReembolso.parse(input);
  const total = data.itens.reduce((s, i) => s + i.valor, 0);

  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolsoItem.deleteMany({ where: { reembolso_id: id } });

  const r = await prisma.reembolso.update({
    where: { id },
    data: {
      periodo: data.periodo,
      descricao: data.descricao || null,
      total,
      itens: {
        create: data.itens.map((i) => ({
          tipo: i.tipo,
          data: new Date(i.data),
          descricao: i.descricao,
          valor: i.valor,
          km: i.km ?? null,
          valor_km: i.valor_km ?? null,
          clientes_ids: i.clientes_ids ?? [],
        })),
      },
    },
  });

  revalidatePath("/relatorios/reembolso");
  return r;
}

export async function marcarPago(id: string) {
  const empresaId = await obterEmpresaAtiva();
  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolso.update({ where: { id }, data: { status: "PAGO" } });
  revalidatePath("/relatorios/reembolso");
}

export async function excluirReembolso(id: string) {
  const empresaId = await obterEmpresaAtiva();
  const exists = await prisma.reembolso.findFirst({ where: { id, empresa_id: empresaId } });
  if (!exists) throw new Error("Reembolso não encontrado");

  await prisma.reembolso.delete({ where: { id } });
  revalidatePath("/relatorios/reembolso");
}

function periodoLabel(p: string): string {
  const [ano, mes] = p.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(mes) - 1]} de ${ano}`;
}

function marcadorRateio(reembolsoId: string, clienteId: string) {
  return `reembolso:${reembolsoId}|cliente:${clienteId}`;
}

// Calcula o valor rateado (e o detalhamento por item) de cada cliente presente
// no reembolso. Deslocamento é dividido entre os clientes do próprio item;
// as demais despesas são divididas entre todos os clientes de deslocamento.
function ratearItens(itens: ReembolsoItem[]) {
  const idsDeslocamento = [...new Set(
    itens.filter((i) => i.tipo === "DESLOCAMENTO").flatMap((i) => i.clientes_ids)
  )];
  const numClientesTotal = Math.max(idsDeslocamento.length, 1);
  const todosIds = [...new Set(itens.flatMap((i) => i.clientes_ids))];

  return todosIds.map((clienteId) => {
    const deslocamentos = itens
      .filter((i) => i.tipo === "DESLOCAMENTO" && i.clientes_ids.includes(clienteId))
      .map((i) => ({
        descricao: i.descricao,
        tipo: i.tipo,
        valorRateio: Number(i.valor) / Math.max(i.clientes_ids.length, 1),
      }));

    const outrasDespesas = itens
      .filter((i) => i.tipo !== "DESLOCAMENTO")
      .map((i) => ({
        descricao: i.descricao,
        tipo: i.tipo,
        valorRateio: Number(i.valor) / numClientesTotal,
      }));

    const itensRateio = [...deslocamentos, ...outrasDespesas];
    const total = itensRateio.reduce((s, i) => s + i.valorRateio, 0);
    return { clienteId, itens: itensRateio, total };
  });
}

export async function obterRateioReembolso(id: string) {
  const empresaId = await obterEmpresaAtiva();
  const reembolso = await prisma.reembolso.findFirst({
    where: { id, empresa_id: empresaId },
    include: { itens: true },
  });
  if (!reembolso) throw new Error("Reembolso não encontrado");

  const rateio = ratearItens(reembolso.itens);
  const clienteIds = rateio.map((r) => r.clienteId);

  const [clientes, recebiveis] = await Promise.all([
    prisma.cliente.findMany({
      where: { id: { in: clienteIds }, empresa_id: empresaId },
      select: { id: true, nome: true, email: true },
    }),
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        cliente_id: { in: clienteIds },
        observacoes: { in: clienteIds.map((cId) => marcadorRateio(id, cId)) },
      },
      select: { cliente_id: true, status: true, data_pagamento: true },
    }),
  ]);

  return rateio.map((r) => {
    const cliente = clientes.find((c) => c.id === r.clienteId);
    const recebivel = recebiveis.find((rec) => rec.cliente_id === r.clienteId);
    return {
      clienteId: r.clienteId,
      nome: cliente?.nome ?? "Cliente",
      email: cliente?.email ?? null,
      total: r.total,
      pago: recebivel?.status === "PAGO",
      dataPagamento: recebivel?.data_pagamento ?? null,
    };
  });
}

export async function marcarPagoRateioCliente(reembolsoId: string, clienteId: string) {
  const empresaId = await obterEmpresaAtiva();
  const reembolso = await prisma.reembolso.findFirst({
    where: { id: reembolsoId, empresa_id: empresaId },
    include: { itens: true },
  });
  if (!reembolso) throw new Error("Reembolso não encontrado");

  const rateioCliente = ratearItens(reembolso.itens).find((r) => r.clienteId === clienteId);
  if (!rateioCliente) throw new Error("Cliente não faz parte do rateio deste reembolso");

  const marcador = marcadorRateio(reembolsoId, clienteId);
  const existente = await prisma.recebivel.findFirst({
    where: { empresa_id: empresaId, cliente_id: clienteId, observacoes: marcador },
  });

  if (existente) {
    if (existente.status !== "PAGO") {
      await prisma.recebivel.update({
        where: { id: existente.id },
        data: { status: "PAGO", data_pagamento: new Date(), valor_pago: rateioCliente.total },
      });
    }
  } else {
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 30);
    await prisma.recebivel.create({
      data: {
        empresa_id: empresaId,
        cliente_id: clienteId,
        descricao: `Reembolso de viagem — ${periodoLabel(reembolso.periodo)}${reembolso.descricao ? ` — ${reembolso.descricao}` : ""}`,
        valor: rateioCliente.total,
        data_vencimento: vencimento,
        status: "PAGO",
        data_pagamento: new Date(),
        valor_pago: rateioCliente.total,
        observacoes: marcador,
      },
    });
  }

  revalidatePath("/relatorios/reembolso");
  revalidatePath("/financeiro");
}

export async function desmarcarPagoRateioCliente(reembolsoId: string, clienteId: string) {
  const empresaId = await obterEmpresaAtiva();
  const marcador = marcadorRateio(reembolsoId, clienteId);
  const existente = await prisma.recebivel.findFirst({
    where: { empresa_id: empresaId, cliente_id: clienteId, observacoes: marcador },
  });
  if (!existente) return;

  await prisma.recebivel.update({
    where: { id: existente.id },
    data: { status: "PENDENTE", data_pagamento: null, valor_pago: null },
  });

  revalidatePath("/relatorios/reembolso");
  revalidatePath("/financeiro");
}

export async function enviarEmailsReembolso(id: string): Promise<{
  resultados: { clienteId: string; nome: string; email: string | null; ok: boolean; erro?: string; recebivel?: "criado" | "existente"; jaPago?: boolean }[];
}> {
  const empresaId = await obterEmpresaAtiva();

  const [reembolso, empresa] = await Promise.all([
    prisma.reembolso.findFirst({
      where: { id, empresa_id: empresaId },
      include: { itens: true },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { nome: true, configuracoes: true },
    }),
  ]);

  if (!reembolso || !empresa) throw new Error("Reembolso não encontrado");

  const cfg = (empresa.configuracoes as Record<string, unknown>) ?? {};
  const pagamento = (cfg.pagamento_reembolso as {
    banco?: string; agencia?: string; conta?: string; tipo_conta?: string; chave_pix?: string;
  }) ?? null;

  const rateio = ratearItens(reembolso.itens);
  const clienteIds = rateio.map((r) => r.clienteId);

  const [clientes, recebiveis] = await Promise.all([
    prisma.cliente.findMany({
      where: { id: { in: clienteIds }, empresa_id: empresaId },
      select: { id: true, nome: true, email: true },
    }),
    prisma.recebivel.findMany({
      where: {
        empresa_id: empresaId,
        cliente_id: { in: clienteIds },
        observacoes: { in: clienteIds.map((cId) => marcadorRateio(id, cId)) },
      },
      select: { cliente_id: true, status: true },
    }),
  ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const resultados = await Promise.all(
    rateio.map(async ({ clienteId, itens, total: totalCliente }) => {
      const cliente = clientes.find((c) => c.id === clienteId);
      const nome = cliente?.nome ?? "Cliente";

      // Cliente já pagou sua parte do rateio: não reenviar cobrança
      const recebivelAtual = recebiveis.find((rec) => rec.cliente_id === clienteId);
      if (recebivelAtual?.status === "PAGO") {
        return { clienteId, nome, email: cliente?.email ?? null, ok: true, jaPago: true };
      }

      if (!cliente?.email) {
        return { clienteId, nome, email: null, ok: false, erro: "Sem e-mail cadastrado" };
      }

      try {
        const link = `${baseUrl}/reembolso/${id}?cliente_id=${clienteId}`;

        await enviarReembolso({
          bcc: "financeiro@raccolto.com.br",
          para: cliente.email,
          clienteNome: cliente.nome,
          empresaNome: empresa.nome,
          periodo: reembolso.periodo,
          descricaoReembolso: reembolso.descricao,
          itens,
          totalCliente,
          link,
          pagamento,
        });

        // Lança no contas a receber (evita duplicata em reenvios)
        const marcador = marcadorRateio(id, clienteId);
        let recebivelStatus: "criado" | "existente" = "existente";
        if (!recebivelAtual) {
          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + 30);

          await prisma.recebivel.create({
            data: {
              empresa_id: empresaId,
              cliente_id: clienteId,
              descricao: `Reembolso de viagem — ${periodoLabel(reembolso.periodo)}${reembolso.descricao ? ` — ${reembolso.descricao}` : ""}`,
              valor: totalCliente,
              data_vencimento: vencimento,
              observacoes: marcador,
            },
          });
          recebivelStatus = "criado";
        }

        return { clienteId, nome, email: cliente.email, ok: true, recebivel: recebivelStatus };
      } catch (err) {
        return {
          clienteId,
          nome,
          email: cliente.email,
          ok: false,
          erro: err instanceof Error ? err.message : "Erro ao enviar",
        };
      }
    })
  );

  revalidatePath("/financeiro");
  return { resultados };
}

export async function listarClientesParaDeslocamento() {
  const empresaId = await obterEmpresaAtiva();
  return prisma.cliente.findMany({
    where: { empresa_id: empresaId },
    select: { id: true, nome: true, email: true, distancia_km: true, preco_km: true, cidade: true, estado: true },
    orderBy: { nome: "asc" },
  });
}
