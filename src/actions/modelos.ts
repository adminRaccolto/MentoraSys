"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verificarPermissao, obterEmpresaAtiva } from "@/lib/permissoes";

const schemaCreate = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  tipo: z.enum(["CONTRATO", "PROPOSTA", "RECIBO", "GENERICO"]),
});

const schemaEdit = z.object({
  nome: z.string().min(1, "Nome obrigatório").optional(),
  tipo: z.enum(["CONTRATO", "PROPOSTA", "RECIBO", "GENERICO"]).optional(),
  ativo: z.boolean().optional(),
});

type InputCreate = z.input<typeof schemaCreate>;
type InputEdit = z.input<typeof schemaEdit>;

export async function criarModelo(input: InputCreate) {
  await verificarPermissao("modelos", "criar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaCreate.parse(input);

  const modelo = await prisma.modeloDocumento.create({
    data: {
      empresa_id: empresaId,
      nome: data.nome,
      tipo: data.tipo,
      conteudo: "",
    },
  });

  revalidatePath("/modelos");
  return { ok: true, id: modelo.id };
}

export async function editarModelo(id: string, input: InputEdit) {
  await verificarPermissao("modelos", "editar");
  const empresaId = await obterEmpresaAtiva();
  const data = schemaEdit.parse(input);

  await prisma.modeloDocumento.updateMany({
    where: { id, empresa_id: empresaId },
    data,
  });

  revalidatePath("/modelos");
  return { ok: true };
}

export async function salvarConteudo(id: string, conteudo: string) {
  await verificarPermissao("modelos", "editar");
  const empresaId = await obterEmpresaAtiva();

  await prisma.modeloDocumento.updateMany({
    where: { id, empresa_id: empresaId },
    data: { conteudo },
  });

  return { ok: true };
}

export async function duplicarModelo(id: string) {
  await verificarPermissao("modelos", "criar");
  const empresaId = await obterEmpresaAtiva();

  const original = await prisma.modeloDocumento.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!original) return { ok: false, error: "Modelo não encontrado" };

  await prisma.modeloDocumento.create({
    data: {
      empresa_id: empresaId,
      nome: `Cópia de ${original.nome}`,
      tipo: original.tipo,
      conteudo: original.conteudo,
    },
  });

  revalidatePath("/modelos");
  return { ok: true };
}

const TEMPLATE_PROPOSTA_CONSULTORIA = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1E293B;max-width:820px;margin:0 auto;">

  <!-- ===================== CAPA ===================== -->
  <div style="page-break-after:always;min-height:1050px;display:flex;flex-direction:column;padding:80px 70px 50px;border:1px solid #e2e8f0;">

    <!-- Logo centralizada -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:40px;">
      <img src="{{empresa.logo_url}}" alt="{{empresa.nome}}" style="max-height:110px;max-width:300px;object-fit:contain;" />

      <!-- Caixa PROPOSTA COMERCIAL -->
      <div style="border:2px solid #1B4F72;padding:28px 60px;text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;color:#64748b;text-transform:uppercase;">Proposta Comercial</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#1B4F72;letter-spacing:1px;text-transform:uppercase;">{{proposta.titulo}}</p>
      </div>

      <!-- Tabela de identificação da capa -->
      <table style="width:100%;max-width:520px;border-collapse:collapse;">
        <tr>
          <td style="background:#1B4F72;color:white;padding:9px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;width:42%;">Cliente</td>
          <td style="background:#f8fafc;padding:9px 14px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">{{cliente.nome}}</td>
        </tr>
        <tr>
          <td style="background:#1B4F72;color:white;padding:9px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Responsável (RD)</td>
          <td style="background:white;padding:9px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.responsavel}}</td>
        </tr>
        <tr>
          <td style="background:#1B4F72;color:white;padding:9px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Data da Proposta</td>
          <td style="background:#f8fafc;padding:9px 14px;font-size:13px;">{{data_hoje}}</td>
        </tr>
      </table>
    </div>

    <!-- Rodapé da capa -->
    <div style="margin-top:auto;padding-top:20px;border-top:2px solid #1B4F72;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <p style="margin:2px 0;font-size:12px;font-weight:700;color:#1B4F72;">{{empresa.nome}}</p>
        <p style="margin:2px 0;font-size:10px;color:#64748b;">CNPJ: {{empresa.cnpj}}</p>
        <p style="margin:2px 0;font-size:10px;color:#64748b;">{{empresa.endereco}}, {{empresa.cidade}} – {{empresa.estado}}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:2px 0;font-size:10px;color:#64748b;">Tel.: {{empresa.telefone}}</p>
        <p style="margin:2px 0;font-size:10px;color:#64748b;">{{empresa.email}}</p>
        <p style="margin:2px 0;font-size:10px;color:#94a3b8;">Confidencial</p>
      </div>
    </div>
  </div>

  <!-- ===== CABEÇALHO DAS PÁGINAS INTERNAS ===== -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;margin-bottom:28px;border-bottom:2px solid #1B4F72;">
    <img src="{{empresa.logo_url}}" alt="{{empresa.nome}}" style="max-height:44px;max-width:150px;object-fit:contain;object-position:left;" />
    <div style="text-align:right;line-height:1.6;">
      <p style="margin:0;font-size:10px;font-weight:700;color:#1B4F72;">{{empresa.nome}}</p>
      <p style="margin:0;font-size:10px;color:#64748b;">CNPJ: {{empresa.cnpj}}</p>
      <p style="margin:0;font-size:10px;color:#64748b;">{{empresa.endereco}}, {{empresa.cidade}} – {{empresa.estado}}</p>
      <p style="margin:0;font-size:10px;color:#64748b;">Tel.: {{empresa.telefone}} | {{empresa.email}}</p>
    </div>
  </div>

  <!-- ===== IDENTIFICAÇÃO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Identificação</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;width:18%;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Empresa</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;border-right:2px solid #e2e8f0;width:32%;">{{empresa.nome}}</td>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;width:18%;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Cliente</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{cliente.nome}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Endereço</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;border-right:2px solid #e2e8f0;">{{empresa.endereco}}, {{empresa.cidade}} – {{empresa.estado}}</td>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Contato</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.contato_nome}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Responsável</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;border-right:2px solid #e2e8f0;">{{proposta.responsavel}}</td>
        <td style="background:#f8fafc;padding:8px 14px;font-size:10px;font-weight:700;color:#1B4F72;text-transform:uppercase;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">Telefone</td>
        <td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.contato_telefone}}</td>
      </tr>
    </table>
  </div>

  <!-- ===== PROPOSIÇÃO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Proposição</div>
    <div style="font-size:13px;line-height:1.85;color:#334155;white-space:pre-line;">{{proposta.introducao}}</div>
  </div>

  <!-- ===== ESCOPO SINTÉTICO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Escopo Sintético</div>
    <div style="font-size:13px;line-height:1.85;color:#334155;white-space:pre-line;">{{proposta.objeto}}</div>
  </div>

  <!-- ===== CRONOGRAMA E ACOMPANHAMENTO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Cronograma e Acompanhamento</div>
    <div style="font-size:13px;line-height:1.85;color:#334155;">
      <p style="margin:0 0 10px;">O projeto será desenvolvido em fases, com reuniões periódicas de acompanhamento entre a equipe da <strong>{{empresa.nome}}</strong> e o cliente, para avaliação do progresso e alinhamento das expectativas.</p>
      <p style="margin:0 0 10px;">Cada entrega será validada em conjunto antes da etapa seguinte, garantindo que o trabalho realizado esteja em conformidade com as necessidades e a realidade do cliente.</p>
      <p style="margin:0;">As datas de início e encerramento de cada etapa serão estabelecidas após a assinatura do contrato, respeitando a disponibilidade da organização contratante e o cronograma acordado entre as partes.</p>
    </div>
  </div>

  <!-- ===== INVESTIMENTO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:0;">Investimento</div>
    <div style="background:#f8fafc;padding:14px 16px;border:1px solid #e2e8f0;font-size:13px;line-height:1.8;color:#475569;">
      O investimento para o projeto é calculado com base no esforço (tempo) previsto para o desenvolvimento das atividades descritas no escopo sintético, considerando a complexidade e profundidade de cada entrega.
    </div>
  </div>

  <!-- ===== DETALHAMENTO DOS SERVIÇOS ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:0;">Detalhamento dos Serviços</div>
    {{proposta.tabela_itens}}
  </div>

  <!-- ===== CONDIÇÕES DE PAGAMENTO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:0;">Condições de Pagamento</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="background:#f8fafc;padding:10px 14px;font-size:10px;font-weight:700;color:#1B4F72;width:38%;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">Valor do Projeto</td>
        <td style="padding:10px 14px;font-size:15px;font-weight:700;color:#1B4F72;border-bottom:1px solid #e2e8f0;">{{proposta.valor_total}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:10px 14px;font-size:10px;font-weight:700;color:#1B4F72;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">Forma de Pagamento</td>
        <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.forma_pagamento}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:10px 14px;font-size:10px;font-weight:700;color:#1B4F72;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">Parcelas</td>
        <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.numero_parcelas}}x {{proposta.periodicidade}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:10px 14px;font-size:10px;font-weight:700;color:#1B4F72;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">1º Vencimento</td>
        <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0;">{{proposta.primeiro_vencimento}}</td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:10px 14px;font-size:10px;font-weight:700;color:#1B4F72;text-transform:uppercase;">Validade da Proposta</td>
        <td style="padding:10px 14px;font-size:13px;">{{proposta.validade}}</td>
      </tr>
    </table>
    {{proposta.tabela_parcelas}}
  </div>

  <!-- ===== CONDIÇÕES DE DESENVOLVIMENTO ===== -->
  <div style="margin-bottom:28px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Condições de Desenvolvimento</div>
    <div style="font-size:13px;line-height:1.85;color:#334155;white-space:pre-line;">{{proposta.condicoes}}</div>
  </div>

  <!-- ===== PÓS IMPLANTAÇÃO ===== -->
  <div style="margin-bottom:40px;">
    <div style="background:#1B4F72;color:white;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Pós Implantação</div>
    <div style="font-size:13px;line-height:1.85;color:#334155;">
      <p style="margin:0 0 10px;">Após a conclusão do projeto, a <strong>{{empresa.nome}}</strong> disponibilizará suporte para esclarecimento de dúvidas referentes ao trabalho realizado, pelo prazo de 30 (trinta) dias corridos, a contar da data de entrega final.</p>
      <p style="margin:0;">Solicitações de alterações, ampliações de escopo ou novos projetos serão tratadas como demandas específicas e orçadas separadamente, conforme tabela de serviços vigente.</p>
    </div>
  </div>

  <!-- ===== ASSINATURA ===== -->
  <div style="margin-top:60px;padding-top:16px;border-top:2px solid #1B4F72;display:flex;justify-content:space-between;gap:60px;">
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #1B4F72;padding-top:8px;margin-top:64px;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#1B4F72;">{{proposta.responsavel}}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b;">{{empresa.nome}}</p>
      </div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #1B4F72;padding-top:8px;margin-top:64px;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#1B4F72;">{{proposta.contato_nome}}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b;">{{cliente.nome}}</p>
      </div>
    </div>
  </div>

  <!-- ===== RODAPÉ ===== -->
  <div style="margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <p style="margin:0;font-size:10px;color:#94a3b8;">Tel.: {{empresa.telefone}} | {{empresa.email}}</p>
    <p style="margin:0;font-size:10px;color:#94a3b8;">{{empresa.nome}} · CNPJ {{empresa.cnpj}} · Proposta válida até {{proposta.validade}}</p>
  </div>

</div>
`.trim();

export async function seedModeloProposta() {
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.modeloDocumento.count({
    where: { empresa_id: empresaId, tipo: "PROPOSTA" },
  });
  if (existente > 0) return { ok: false, message: "Já existe um modelo de proposta para esta empresa." };

  await prisma.modeloDocumento.create({
    data: {
      empresa_id: empresaId,
      nome: "Proposta de Consultoria",
      tipo: "PROPOSTA",
      conteudo: TEMPLATE_PROPOSTA_CONSULTORIA,
    },
  });

  revalidatePath("/modelos");
  return { ok: true, message: "Modelo de proposta criado com sucesso." };
}

export async function resetarModeloProposta() {
  await verificarPermissao("modelos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.modeloDocumento.findFirst({
    where: { empresa_id: empresaId, tipo: "PROPOSTA" },
    select: { id: true },
  });

  if (existente) {
    await prisma.modeloDocumento.update({
      where: { id: existente.id },
      data: { conteudo: TEMPLATE_PROPOSTA_CONSULTORIA },
    });
  } else {
    await prisma.modeloDocumento.create({
      data: {
        empresa_id: empresaId,
        nome: "Proposta de Consultoria",
        tipo: "PROPOSTA",
        conteudo: TEMPLATE_PROPOSTA_CONSULTORIA,
      },
    });
  }

  revalidatePath("/modelos");
  return { ok: true, message: "Template de proposta atualizado com sucesso." };
}

const TEMPLATE_CONTRATO_CONSULTORIA = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;color:#000;text-align:justify;">

  <!-- Cabeçalho -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:28px;">
    <tr>
      <td width="45%" valign="middle">{{empresa.logo_img}}</td>
      <td align="right" valign="top" style="font-size:9pt;line-height:1.5;">
        CNPJ: {{empresa.cnpj}}<br>
        {{empresa.razao_social}}<br>
        {{empresa.endereco}}<br>
        {{empresa.cidade}}, {{empresa.estado}}
      </td>
    </tr>
  </table>

  <!-- Título -->
  <p style="text-align:center;font-weight:bold;font-size:12pt;margin:0 0 28px 0;">
    Instrumento Particular de Contrato de Prestação de Serviços Profissionais na Área de Gestão.
  </p>

  <!-- Partes -->
  <p style="margin-bottom:14px;">
    <strong>CONTRATADA:</strong> Empresa com Razão Social {{empresa.razao_social}}, nome fantasia {{empresa.nome_fantasia}}, CNPJ {{empresa.cnpj}}, estabelecida à {{empresa.endereco}}, na cidade de {{empresa.cidade}}. Representada neste ato pelo Sr. {{empresa.representante}}, na qualidade de {{empresa.representante_cargo}}, CPF {{empresa.representante_cpf}}.
  </p>

  <p style="margin-bottom:24px;">
    <strong>CONTRATANTE:</strong> {{cliente.nome}}, CPF/CNPJ {{cliente.cpf_cnpj}}. Pelo presente instrumento particular, as partes acima, devidamente qualificadas, doravante denominadas, simplesmente, CONTRATADA e CONTRATANTE, na melhor forma de direito, ajustam e contratam a prestação de serviços profissionais, segundo as cláusulas e condições adiante arroladas.
  </p>

  <!-- Cláusula 1 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA PRIMEIRA - DO OBJETO</p>
  <p style="margin-bottom:8px;">O objeto do presente consiste na prestação de serviços pela CONTRATADA à CONTRATANTE dos seguintes serviços profissionais:</p>
  <div style="margin-bottom:16px;">{{contrato.objeto}}</div>

  <!-- Cláusula 2 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA SEGUNDA - DAS CONDIÇÕES DE EXECUÇÃO DOS SERVIÇOS</p>
  <p>Os Serviços serão executados nas dependências da CONTRATANTE e da CONTRATADA, em obediência às seguintes condições:</p>
  <p><strong>Condições Gerais:</strong></p>
  <p>2.1. A documentação e disposição da colaboração de Funcionários é indispensável para o desempenho dos serviços arrolados na Cláusula Primeira e será fornecida pela CONTRATANTE, consistindo, basicamente, em:</p>
  <p>2.1.1. A CONTRATANTE fica responsável pela lisura e confiabilidade dos números apresentados, não recaindo sobre a CONTRATADA ônus de revisão em caso de erro nas informações cedidas;</p>
  <p>2.1.2. Havendo necessidade de recalculo ou reprocessamento do material já entregue por inconsistência no resultado causada por informações incorretas cedidas pela CONTRATANTE, a CONTRATADA cobrará hora técnica no valor de R$ 500,00 (quinhentos reais) para retificação dos cálculos e emissão de novo laudo;</p>
  <p>2.2. A CONTRATADA compromete-se a cumprir todos os prazos estabelecidos no cronograma, podendo todavia haver flexibilidade nas datas pré-determinadas no cronograma, observando que sempre que postergada uma atividade, todo o cronograma se estende.</p>
  <p>2.3. A entrega de materiais finalizados também ocorrerá conforme cronograma, podendo todavia haver flexibilidade nas datas pré-determinadas no cronograma.</p>
  <p>2.3.1. CONTRATADA compromete-se em efetuar a entrega do serviço contratado até a data limite de <strong>{{contrato.data_fim}}</strong>, podendo haver entrega antecipada sem prejuízo ao item 4.2.</p>
  <p>2.4. A remessa de documentos entre os contratantes deverá ser feita via e-mail ({{empresa.email}}) e/ou pasta compartilhada em nuvem e/ou plataforma dedicada à gestão do projeto de consultoria indicada pela CONTRATADA.</p>
  <p><strong>Condições para execução dos serviços nas dependências da Contratante:</strong></p>
  <p>2.6. A CONTRATANTE deverá fornecer ao Consultor da CONTRATADA condições adequadas de infraestrutura para execução dos serviços contratados, tais como: ambiente climatizado e bem iluminado, mesa e cadeira adequados, acesso à internet com velocidade adequada, acesso a impressora quando necessário.</p>
  <p>2.7. Os Projetistas da CONTRATADA seguirão as escalas de execução dos serviços conforme cronograma estimado, podendo todavia haver entrega antecipada do escopo contratado.</p>
  <p>2.8. A gestão dos Consultores é de completa responsabilidade da CONTRATADA, não podendo a CONTRATANTE reportar demandas fora do Objeto deste instrumento diretamente aos Projetistas da CONTRATADA, devendo comunicar a CONTRATADA para que em comum acordo novas demandas sejam liberadas, observando a possibilidade de apresentação de orçamento prévio para contratação dessas demandas.</p>

  <!-- Cláusula 3 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA TERCEIRA - DOS DEVERES DA CONTRATADA</p>
  <p>3.1. A CONTRATADA desempenhará os serviços enumerados na Cláusula Primeira com todo zelo, diligência e honestidade, observada a legislação vigente resguardando os interesses da CONTRATANTE, sem prejuízo da dignidade e independência profissionais, sujeitando-se, ainda, às normas do Código de Ética Profissional dos Administradores.</p>
  <p>3.2. Obriga-se a CONTRATADA a fornecer à CONTRATANTE, no escritório dessa e dentro do horário normal de expediente, todas as informações relativas ao andamento dos serviços ora contratados.</p>
  <p>3.3. Responsabilizar-se-á a CONTRATADA por todos os documentos a ela entregues pela CONTRATANTE, enquanto permanecerem sob sua guarda para a consecução dos serviços pactuados, respondendo pelo seu mau uso, perda, extravio ou inutilização, salvo comprovado caso fortuito ou força maior.</p>
  <p>3.4. A CONTRATADA não assume nenhuma responsabilidade pelas consequências de informações, declarações ou documentação inidôneas ou incompletas que lhe forem apresentadas, bem como por omissões próprias da CONTRATANTE ou decorrentes do desrespeito à orientação prestada.</p>

  <!-- Cláusula 4 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA QUARTA - DOS DEVERES DA CONTRATANTE</p>
  <p>4.1. Obriga-se a CONTRATANTE a fornecer à CONTRATADA todos os dados, documentos e informações que se façam necessários ao bom desempenho dos serviços ora contratados, em tempo hábil, nenhuma responsabilidade caberá à segunda caso recebidos intempestivamente.</p>
  <p>4.2. Para a execução dos serviços constantes da Cláusula Primeira, a CONTRATANTE pagará à CONTRATADA os honorários profissionais correspondentes a <strong>{{contrato.valor_total}}</strong>, parcelados da seguinte forma:</p>
  <p><strong>Parcelas Regulares Mensais (Valores Expressos em Reais):</strong></p>
  {{contrato.tabela_parcelas}}
  <p>4.4. Os honorários pagos após a data avençada acarretarão à CONTRATANTE o acréscimo de multa de 10,00%, e juros moratórios de 2,00% ao mês ou fração em distribuição "pro rata die".</p>
  <p>4.4.2. A CONTRATANTE reembolsará mensalmente à CONTRATADA os custos decorrentes de deslocamento quando este ocorrer fora do perímetro urbano de {{empresa.cidade}} – {{empresa.estado}}, sendo estas, despesas com quilometragem, hospedagem e alimentação.</p>
  <p>4.4.3. Os serviços solicitados pela CONTRATANTE não especificados na Cláusula Primeira serão cobrados pela CONTRATADA em apartado, como extraordinários, segundo valor específico constante de orçamento previamente aprovado.</p>
  <p>4.5. À CONTRATANTE fica vedada a contratação direta de Projetistas que trabalhem para a CONTRATADA, ainda que na condição de autônomos, pelo período de 12 meses do desligamento deste com a CONTRATADA.</p>

  <!-- Cláusula 5 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA QUINTA - DA VIGÊNCIA E RESCISÃO</p>
  <p>5.1. O presente contrato vigorará a partir de <strong>{{contrato.data_inicio}}</strong>, findando na data limite de <strong>{{contrato.data_fim}}</strong>, podendo ocorrer seu término em data anterior, desde que a CONTRATADA faça a entrega integral do serviço contratado, podendo, a qualquer tempo, ser rescindido, incorrendo sobre o período andamento dos trabalhos e sua remuneração.</p>
  <p>5.1.1. No caso de rescisão, a dispensa pela CONTRATANTE da execução de quaisquer serviços, seja qual for a razão, durante o prazo do pré-aviso, deverá ser feita por escrito, não a desobrigando do pagamento integral dos honorários referente aos serviços já executados até o término final do contrato.</p>
  <p>5.2. Considerar-se-á rescindido o presente contrato, independentemente de notificação judicial ou extrajudicial, caso qualquer das partes CONTRATANTES venha a infringir cláusula ora convencionada.</p>

  <!-- Cláusula 6 -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA SEXTA - DO FORO</p>
  <p>Fica eleito o Foro da Cidade de {{empresa.cidade}} - {{empresa.estado}}, com expressa renúncia a qualquer outro, por mais privilegiado que seja, para dirimir as questões oriundas da interpretação e execução do presente contrato. Os CONTRATANTES submeterão à arbitragem eventuais litígios oriundos do presente contrato. (Lei nº 9.307/96).</p>
  <p>E, por estarem justos e contratados, assinam o presente, em 2 (duas) vias de igual teor e para um só efeito.</p>

  <!-- Assinaturas -->
  <p style="text-align:right;margin-top:40px;">{{empresa.cidade}}-{{empresa.estado}}, {{data_hoje_extenso}}.</p>
  <br><br><br>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="44%" align="center" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.5;">
        {{empresa.representante}}<br>
        {{empresa.representante_cargo}}<br>
        {{empresa.razao_social}}<br>
        CNPJ: {{empresa.cnpj}}
      </td>
      <td width="12%"></td>
      <td width="44%" align="center" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.5;">
        {{cliente.nome}}<br>
        CPF/CNPJ: {{cliente.cpf_cnpj}}
      </td>
    </tr>
  </table>

  <!-- Rodapé -->
  <div style="border-top:2px solid #000;margin-top:40px;padding-top:8px;display:flex;justify-content:space-between;font-size:9pt;">
    <span>Tel.: {{empresa.telefone}}</span>
    <span>{{empresa.email}}</span>
  </div>

</div>
`;

export async function seedModeloContrato() {
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.modeloDocumento.count({
    where: { empresa_id: empresaId, tipo: "CONTRATO" },
  });
  if (existente > 0) return { ok: false, message: "Já existe um modelo de contrato para esta empresa." };

  await prisma.modeloDocumento.create({
    data: {
      empresa_id: empresaId,
      nome: "Contrato de Prestação de Serviços",
      tipo: "CONTRATO",
      conteudo: TEMPLATE_CONTRATO_CONSULTORIA,
    },
  });

  revalidatePath("/modelos");
  return { ok: true, message: "Modelo de contrato criado com sucesso." };
}

export async function resetarModeloContrato() {
  await verificarPermissao("modelos", "editar");
  const empresaId = await obterEmpresaAtiva();

  const existente = await prisma.modeloDocumento.findFirst({
    where: { empresa_id: empresaId, tipo: "CONTRATO" },
    select: { id: true },
  });

  if (existente) {
    await prisma.modeloDocumento.update({
      where: { id: existente.id },
      data: { conteudo: TEMPLATE_CONTRATO_CONSULTORIA },
    });
  } else {
    await prisma.modeloDocumento.create({
      data: {
        empresa_id: empresaId,
        nome: "Contrato de Prestação de Serviços",
        tipo: "CONTRATO",
        conteudo: TEMPLATE_CONTRATO_CONSULTORIA,
      },
    });
  }

  revalidatePath("/modelos");
  return { ok: true, message: "Template de contrato atualizado com sucesso." };
}

export async function excluirModelo(id: string) {
  await verificarPermissao("modelos", "excluir");
  const empresaId = await obterEmpresaAtiva();

  await prisma.modeloDocumento.deleteMany({
    where: { id, empresa_id: empresaId },
  });

  revalidatePath("/modelos");
  return { ok: true };
}
