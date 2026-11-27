"use server";

import { z } from "zod";
import { deletarCliente, excluirCliente } from "@/actions/clientes";
import { excluirLead } from "@/actions/crm";
import { excluirFornecedor } from "@/actions/fornecedores";
import { excluirServico } from "@/actions/servicos";
import { excluirProposta } from "@/actions/propostas";
import { excluirContrato } from "@/actions/contratos";
import { excluirProjeto } from "@/actions/projetos";
import { excluirDiagnostico } from "@/actions/diagnosticos";
import { excluirRecebivel } from "@/actions/recebiveis";
import { excluirContaPagar } from "@/actions/contas-pagar";
import { excluirConta as desativarContaBancaria } from "@/actions/contas-bancarias";
import { excluirCentroCusto } from "@/actions/centros-custo";
import { excluirTransferencia } from "@/actions/tesouraria";
import { excluirNota } from "@/actions/faturamento";
import { excluirModelo } from "@/actions/modelos";
import { excluirDocumento } from "@/actions/documentos";
import { excluirCupom } from "@/actions/campanhas-cupom";
import { excluirEvento } from "@/actions/agenda";
import { excluirCampanha } from "@/actions/campanhas-diagnostico";
import { verificarPermissao } from "@/lib/permissoes";

const operacoes = {
  clientes: { permissao: ["clientes", "excluir"], executar: deletarCliente },
  desativarClientes: { permissao: ["clientes", "excluir"], executar: excluirCliente },
  leads: { permissao: ["crm", "excluir"], executar: excluirLead },
  fornecedores: { permissao: ["fornecedores", "excluir"], executar: excluirFornecedor },
  servicos: { permissao: ["servicos", "excluir"], executar: excluirServico },
  propostas: { permissao: ["propostas", "excluir"], executar: excluirProposta },
  contratos: { permissao: ["contratos", "excluir"], executar: excluirContrato },
  projetos: { permissao: ["projetos", "excluir"], executar: excluirProjeto },
  diagnosticos: { permissao: ["diagnosticos", "excluir"], executar: excluirDiagnostico },
  recebiveis: { permissao: ["financeiro", "excluir"], executar: excluirRecebivel },
  contasPagar: { permissao: ["financeiro", "excluir"], executar: excluirContaPagar },
  contasBancarias: { permissao: ["financeiro", "excluir"], executar: desativarContaBancaria },
  centrosCusto: { permissao: ["financeiro", "excluir"], executar: excluirCentroCusto },
  transferencias: { permissao: ["financeiro", "excluir"], executar: excluirTransferencia },
  notasFiscais: { permissao: ["faturamento", "excluir"], executar: excluirNota },
  modelos: { permissao: ["modelos", "excluir"], executar: excluirModelo },
  documentos: { permissao: ["projetos", "editar"], executar: excluirDocumento },
  cupons: { permissao: ["servicos", "excluir"], executar: excluirCupom },
  eventos: { permissao: ["agenda", "excluir"], executar: excluirEvento },
  campanhasDiagnostico: { permissao: ["crm", "excluir"], executar: excluirCampanha },
} as const;

const schemaIds = z.array(z.string().min(1).max(128)).min(1).max(10);

export async function excluirRegistrosEmLote(tipo: keyof typeof operacoes, ids: string[]) {
  if (!Object.hasOwn(operacoes, tipo)) throw new Error("Operação inválida.");
  const operacao = operacoes[tipo];
  const unicos = [...new Set(schemaIds.parse(ids))];
  const [recurso, acao] = operacao.permissao;
  await verificarPermissao(recurso, acao);

  const excluidos: string[] = [];
  const falhas: { id: string; motivo: string }[] = [];

  for (const id of unicos) {
    try {
      // Cada rotina mantém as validações e o escopo da exclusão individual.
      const resultado = await operacao.executar(id);
      if (resultado && "ok" in resultado && !resultado.ok) {
        const motivo = "error" in resultado && typeof resultado.error === "string"
          ? resultado.error
          : "Não foi possível concluir a operação.";
        falhas.push({ id, motivo });
      } else {
        excluidos.push(id);
      }
    } catch (erro) {
      const motivo = erro instanceof Error && !erro.name.startsWith("Prisma")
        ? erro.message
        : "O registro pode ter vínculos ou ter sido alterado. Atualize a lista e tente novamente.";
      falhas.push({ id, motivo });
    }
  }

  return { excluidos, falhas };
}
