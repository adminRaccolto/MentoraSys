import { createHash } from "node:crypto";
import { ETAPAS_PADRAO } from "@/lib/crm-etapas";
import { prisma } from "@/lib/prisma";

interface Comprador {
  clienteId?: string | null;
  asaasId?: string | null;
  nome: string;
  email?: string | null;
  cpfCnpj?: string | null;
  telefone?: string | null;
}

interface VendaCrm {
  empresaId: string;
  comprador: Comprador;
  origem: string;
  referencia?: string;
  valor?: number;
  tags?: string[];
}

function idComentarioVenda(empresaId: string, referencia: string) {
  return createHash("sha256").update(JSON.stringify([empresaId, referencia])).digest("hex");
}

export async function localizarVendaNoCrm(empresaId: string, referencia: string) {
  const comentario = await prisma.comentarioCrm.findUnique({
    where: { id: idComentarioVenda(empresaId, referencia) },
    select: { lead: { select: { id: true, cliente_id: true, empresa_id: true } } },
  });
  const lead = comentario?.lead;
  if (lead?.empresa_id !== empresaId || !lead.cliente_id) return null;
  return { leadId: lead.id, clienteId: lead.cliente_id };
}

export async function registrarVendaNoCrm({
  empresaId, comprador, origem, referencia, valor, tags = [],
}: VendaCrm) {
  const email = comprador.email?.trim().toLowerCase() || null;
  const cpfCnpj = comprador.cpfCnpj?.replace(/\D/g, "") || null;
  const documentoFormatado = cpfCnpj?.replace(
    cpfCnpj.length === 14 ? /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/ : /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    cpfCnpj.length === 14 ? "$1.$2.$3/$4-$5" : "$1.$2.$3-$4",
  );
  const telefone = comprador.telefone?.trim() || null;
  const idComentario = referencia ? idComentarioVenda(empresaId, referencia) : null;

  return prisma.$transaction(async (tx) => {
    const identidade = cpfCnpj ?? email ?? comprador.asaasId ?? comprador.clienteId;
    if (!identidade) throw new Error("A venda precisa identificar o comprador.");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${empresaId}), hashtext(${identidade}))`;

    const comentario = idComentario
      ? await tx.comentarioCrm.findUnique({
          where: { id: idComentario },
          select: { lead: { select: { id: true, cliente_id: true, empresa_id: true } } },
        })
      : null;
    if (comentario?.lead.empresa_id === empresaId && comentario.lead.cliente_id) {
      return { leadId: comentario.lead.id, clienteId: comentario.lead.cliente_id };
    }

    const select = { id: true, nome: true, asaas_id: true, email: true, cpf_cnpj: true, telefone: true, status: true };
    const vinculoAsaas = comprador.asaasId ? { OR: [{ asaas_id: null }, { asaas_id: comprador.asaasId }] } : {};
    const clienteId = comprador.clienteId;
    const idAsaas = comprador.asaasId;
    const existente = (clienteId && await tx.cliente.findFirst({
      where: { empresa_id: empresaId, id: clienteId },
      select,
    })) || (idAsaas && await tx.cliente.findFirst({
      where: { empresa_id: empresaId, asaas_id: idAsaas },
      select,
    })) || (cpfCnpj && await tx.cliente.findFirst({
      where: { empresa_id: empresaId, cpf_cnpj: { in: [cpfCnpj, documentoFormatado ?? cpfCnpj] }, ...vinculoAsaas },
      select,
    })) || (email && await tx.cliente.findFirst({
      where: { empresa_id: empresaId, email: { equals: email, mode: "insensitive" }, ...vinculoAsaas },
      select,
    }));

    const cliente = existente || await tx.cliente.create({
      data: {
        empresa_id: empresaId,
        nome: comprador.nome,
        tipo: cpfCnpj?.length === 14 ? "PESSOA_JURIDICA" : "PESSOA_FISICA",
        email,
        cpf_cnpj: cpfCnpj,
        telefone,
        asaas_id: comprador.asaasId,
      },
      select,
    });

    if (existente) {
      const atualizar = {
        ...(cliente.status === "PROSPECT" ? { status: "ATIVO" as const } : {}),
        ...(!cliente.asaas_id && idAsaas ? { asaas_id: idAsaas } : {}),
        ...(!cliente.email && email ? { email } : {}),
        ...(!cliente.cpf_cnpj && cpfCnpj ? { cpf_cnpj: cpfCnpj } : {}),
        ...(!cliente.telefone && telefone ? { telefone } : {}),
      };
      if (Object.keys(atualizar).length) {
        await tx.cliente.update({ where: { id: cliente.id }, data: atualizar });
      }
    }

    const etapaWhere = { empresa_id_chave: { empresa_id: empresaId, chave: "GANHO" } };
    let etapa = await tx.etapaCrm.findUnique({ where: etapaWhere });
    if (!etapa) {
      const padrao = ETAPAS_PADRAO.find((item) => item.chave === "GANHO")!;
      const etapas = await tx.etapaCrm.count({ where: { empresa_id: empresaId } });
      if (!etapas) {
        await tx.etapaCrm.createMany({
          data: ETAPAS_PADRAO.map((item) => ({ empresa_id: empresaId, ...item })),
          skipDuplicates: true,
        });
      }
      etapa = await tx.etapaCrm.upsert({
        where: etapaWhere,
        create: { empresa_id: empresaId, ...padrao },
        update: {},
      });
    }

    const emailLead = email ?? cliente.email;
    const lead = await tx.lead.findFirst({
      where: {
        empresa_id: empresaId,
        OR: [
          { cliente_id: cliente.id },
          ...(emailLead ? [{ cliente_id: null, email: { equals: emailLead, mode: "insensitive" as const } }] : []),
        ],
      },
      orderBy: [{ criado_em: "desc" }, { id: "desc" }],
    });

    const dadosGanho = {
      cliente_id: cliente.id,
      etapa_chave: etapa.chave,
      etapa_id: etapa.id,
      probabilidade: 100,
      motivo_perda: null,
    };
    const data = lead ? await tx.lead.update({
      where: { id: lead.id },
      data: {
        ...dadosGanho,
        ...(!lead.email && emailLead ? { email: emailLead } : {}),
        ...(!lead.telefone && (telefone ?? cliente.telefone) ? { telefone: telefone ?? cliente.telefone } : {}),
        ...(lead.valor_estimado == null && valor != null ? { valor_estimado: valor } : {}),
        tags: [...new Set([...lead.tags, ...tags])],
      },
      select: { id: true },
    }) : await tx.lead.create({
      data: {
        empresa_id: empresaId,
        nome: cliente.nome,
        empresa_nome: cliente.nome,
        contato_nome: comprador.nome,
        email: emailLead,
        telefone: telefone ?? cliente.telefone,
        origem,
        valor_estimado: valor,
        tags,
        ...dadosGanho,
      },
      select: { id: true },
    });

    if (idComentario && !comentario) {
      await tx.comentarioCrm.create({
        data: {
          id: idComentario,
          lead_id: data.id,
          autor_nome: origem,
          mensagem: "Pagamento da venda confirmado.",
        },
      });
    }
    return { leadId: data.id, clienteId: cliente.id };
  });
}
