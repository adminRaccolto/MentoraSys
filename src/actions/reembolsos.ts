"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterEmpresaAtiva } from "@/lib/permissoes";
import { enviarReembolso } from "@/lib/email";

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

export async function enviarEmailsReembolso(id: string): Promise<{
  resultados: { clienteId: string; nome: string; email: string | null; ok: boolean; erro?: string }[];
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

  // Clientes distintos de deslocamento (para calcular rateio das outras despesas)
  const idsDeslocamento = [...new Set(
    reembolso.itens.filter((i) => i.tipo === "DESLOCAMENTO").flatMap((i) => i.clientes_ids)
  )];
  const numClientesTotal = Math.max(idsDeslocamento.length, 1);

  // Todos os clientes presentes em qualquer item
  const todosIds = [...new Set(reembolso.itens.flatMap((i) => i.clientes_ids))];

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: todosIds }, empresa_id: empresaId },
    select: { id: true, nome: true, email: true },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const resultados = await Promise.all(
    clientes.map(async (cliente) => {
      if (!cliente.email) {
        return { clienteId: cliente.id, nome: cliente.nome, email: null, ok: false, erro: "Sem e-mail cadastrado" };
      }

      try {
        // Deslocamentos deste cliente
        const deslocamentos = reembolso.itens
          .filter((i) => i.tipo === "DESLOCAMENTO" && i.clientes_ids.includes(cliente.id))
          .map((i) => ({
            descricao: i.descricao,
            tipo: i.tipo,
            valorRateio: Number(i.valor) / Math.max(i.clientes_ids.length, 1),
          }));

        // Outras despesas rateadas igualmente
        const outrasDespesas = reembolso.itens
          .filter((i) => i.tipo !== "DESLOCAMENTO")
          .map((i) => ({
            descricao: i.descricao,
            tipo: i.tipo,
            valorRateio: Number(i.valor) / numClientesTotal,
          }));

        const itens = [...deslocamentos, ...outrasDespesas];
        const totalCliente = itens.reduce((s, i) => s + i.valorRateio, 0);

        const link = `${baseUrl}/reembolso/${id}?cliente_id=${cliente.id}`;

        await enviarReembolso({
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

        return { clienteId: cliente.id, nome: cliente.nome, email: cliente.email, ok: true };
      } catch (err) {
        return {
          clienteId: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          ok: false,
          erro: err instanceof Error ? err.message : "Erro ao enviar",
        };
      }
    })
  );

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
