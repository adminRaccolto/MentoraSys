// Script: cria o modelo "Termo de Confidencialidade e Sigilo" na empresa
// Uso: node scripts/criar-modelo-nda.mjs

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const envFile = readFileSync(resolve(root, ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

process.env.DATABASE_URL = process.env.DIRECT_URL;
const { PrismaClient } = await import(resolve(root, "src/lib/generated/prisma/index.js"));
const { PrismaPg } = await import("@prisma/adapter-pg");
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const CNPJ = "51.499.616/0001-90";

const empresa = await prisma.empresa.findUnique({
  where: { cnpj: CNPJ },
  select: { id: true, nome: true },
});

if (!empresa) { console.error("Empresa não encontrada:", CNPJ); process.exit(1); }
console.log("Empresa:", empresa.nome);

const conteudo = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.7;color:#000;text-align:justify;">

  <!-- Cabeçalho -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:28px;">
    <tr>
      <td width="40%" valign="middle">{{empresa.logo_img}}</td>
      <td align="right" valign="top" style="font-size:9pt;line-height:1.5;">
        CNPJ: {{empresa.cnpj}}<br>
        {{empresa.razao_social}}<br>
        {{empresa.endereco}}<br>
        {{empresa.cidade}} - {{empresa.estado}}, Brasil
      </td>
    </tr>
  </table>

  <!-- Título -->
  <p style="text-align:center;font-weight:bold;font-size:13pt;margin:0 0 28px 0;">
    Termo de Confidencialidade e Sigilo
  </p>

  <!-- Preâmbulo -->
  <p style="margin-bottom:16px;">
    Pelo presente Termo a empresa <strong>{{empresa.razao_social}}</strong>, CNPJ {{empresa.cnpj}}, estabelecida à {{empresa.endereco}}, {{empresa.cidade}} - {{empresa.estado}}, CEP nº {{empresa.cep}}, Brasil. Representada neste ato pelo Sr. <strong>{{empresa.representante}}</strong>, na qualidade de {{empresa.representante_cargo}}, CPF {{empresa.representante_cpf}}, doravante denominados individualmente como PARTE, se obrigam à manter o mais absoluto sigilo com relação a toda e qualquer informação a que tiverem acesso sobre o projeto denominado <strong>{{contrato.titulo}}</strong> do contratante <strong>{{cliente.nome}}</strong>, CPF/CNPJ: {{cliente.cpf_cnpj}}, estabelecido(a) em {{cliente.logradouro}}, {{cliente.cidade}}, {{cliente.estado}}, CEP: {{cliente.cep}}, e-mail: {{cliente.email}}, telefone: {{cliente.telefone}}. Para tanto, declara e se compromete:
  </p>

  <p style="margin-bottom:12px;padding-left:20px;">
    A manter sigilo, tanto escrito como verbal, ou, por qualquer outra forma, de todos os dados, informações científicas e técnicas e, sobre todos os materiais obtidos com sua participação, podendo incluir, mas não se limitando a: técnicas, desenhos, cópias, diagramas, modelos, fluxogramas, croquis, fotografias, programas de computador, discos, disquetes, pen drives, processos, projetos, dentre outros;
  </p>

  <p style="margin-bottom:20px;padding-left:20px;">
    A não revelar, reproduzir, utilizar ou dar conhecimento, em hipótese alguma, a terceiros, de dados, informações científicas ou materiais obtidos com sua participação, sem a prévia análise do contratante <strong>{{cliente.nome}}</strong> sobre a possibilidade de proteção, nos órgãos especializados, dos resultados ou tecnologia envolvendo aquela informação.
  </p>

  <!-- Cláusulas -->
  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA PRIMEIRA – DO OBJETIVO</p>
  <p style="margin-bottom:16px;">
    Este termo de confidencialidade é firmado com o intuito de evitar a divulgação e utilização não autorizada das informações confidenciais trocadas entre as PARTES por ocasião da realização do seguinte projeto de <strong>{{contrato.titulo}}</strong>.
  </p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA SEGUNDA – DAS INFORMAÇÕES CONFIDENCIAIS E OUTROS CONCEITOS</p>
  <p style="margin-bottom:12px;">
    Para os fins deste acordo, serão consideradas confidenciais todas as informações, transmitidas por meios escritos, eletrônicos, verbais ou quaisquer outros e de qualquer natureza, incluindo, mas não se limitando a: know-how, técnicas, design, especificações, desenhos, cópias, modelos, fluxogramas, croquis, fotografias, software, mídias, contratos, planos de negócios, propostas comerciais, processos, tabelas, projetos, nomes de clientes, de revendedor e distribuidor, resultados de pesquisas, invenções e ideias, financeiras, comerciais, dentre outros.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO PRIMEIRO:</p>
  <p style="margin-bottom:12px;padding-left:20px;">
    Serão, ainda, consideradas informações confidenciais todas aquelas que assim forem identificadas pela PARTE REVELADORA, por meio de legendas ou quaisquer outras marcações, ou que, devido às circunstâncias da revelação ou à própria natureza da informação, devam ser consideradas confidenciais ou de propriedade desta.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO SEGUNDO:</p>
  <p style="margin-bottom:16px;padding-left:20px;">
    Em caso de dúvida sobre a confidencialidade de determinada informação, a PARTE RECEPTORA deverá mantê-la em absoluto sigilo, até que a PARTE REVELADORA se manifeste expressamente a respeito.
  </p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA TERCEIRA – DO USO DAS INFORMAÇÕES CONFIDENCIAIS</p>
  <p style="margin-bottom:12px;">
    As PARTES comprometem-se a utilizar as informações confidenciais apenas no âmbito do desenvolvimento e da execução do projeto, sendo vedada tanto a sua divulgação à terceiros, quanto qualquer outra utilização que não seja expressamente permitida pela PARTE REVELADORA, em observância à Lei nº 13709/2018 - LGPD.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO PRIMEIRO</p>
  <p style="margin-bottom:12px;padding-left:20px;">
    A PARTE RECEPTADORA deverá dispensar às informações confidenciais da PARTE REVELADORA o mesmo zelo e cuidado com que trataria os seus próprios dados e deverá mantê-las em local seguro, com acesso limitado, apenas às pessoas autorizadas.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO SEGUNDO</p>
  <p style="margin-bottom:16px;padding-left:20px;">
    Em caso de qualquer falha na segurança das informações confidenciais, a PARTE RECEPTADORA deverá comunicar imediatamente à PARTE REVELADORA. A pronta comunicação da PARTE RECEPTADORA não exclui, entretanto, a sua responsabilização pelo defeito na proteção dos dados sigilosos.
  </p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA QUARTA – DAS EXCEÇÕES À CONFIDENCIALIDADE</p>
  <p style="margin-bottom:8px;">Não serão consideradas confidenciais as informações que:</p>
  <p style="margin-bottom:6px;padding-left:20px;">a) Sejam ou venham a ser publicadas ou a se tornar públicas, desde que tais divulgações não tenham sido, de qualquer forma, ocasionadas pela PARTE RECEPTORA;</p>
  <p style="margin-bottom:6px;padding-left:20px;">b) Tenham sido desenvolvidas pela PARTE RECEPTORA a qualquer tempo, a partir de fontes independentes do projeto;</p>
  <p style="margin-bottom:6px;padding-left:20px;">c) Tenham sido legitimamente recebidas de terceiros, desde que não derivadas de violação de dever de confidencialidade;</p>
  <p style="margin-bottom:16px;padding-left:20px;">d) Sejam expressas ou tacitamente identificadas pela PARTE REVELADORA como não mais sendo sigilosas ou de sua propriedade.</p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA QUINTA – DA REQUISIÇÃO JUDICIAL</p>
  <p style="margin-bottom:8px;">
    Não será considerada quebra de confidencialidade a divulgação de informações ordenadas pela legislação ou por autoridade judiciária ou administrativa competente.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO ÚNICO.</p>
  <p style="margin-bottom:16px;padding-left:20px;">
    Neste caso, a PARTE RECEPTORA deverá imediatamente comunicar à PARTE REVELADORA, apresentando-lhe a legislação referente ou a devida intimação judicial ou administrativa, para que esta sirva-se dos melhores recursos disponíveis para impedir a divulgação das informações reveladas.
  </p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA SEXTA – DA QUEBRA DA CONFIDENCIALIDADE</p>
  <p style="margin-bottom:8px;">
    A PARTE que violar as obrigações previstas neste Termo deverá indenizar e ressarcir a outra PARTE pelas perdas, lucros cessantes, danos diretos e indiretos e quaisquer outros prejuízos patrimoniais ou morais que surjam em decorrência deste descumprimento.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO ÚNICO.</p>
  <p style="margin-bottom:16px;padding-left:20px;">
    Por ocasião de sua violação, o Termo de Confidencialidade poderá ser imediatamente rescindido pela PARTE prejudicada, sem necessidade de aviso prévio e sem gerar, com este fato, direito a indenizações ou ressarcimentos.
  </p>

  <p style="font-weight:bold;margin:20px 0 8px 0;">CLÁUSULA SÉTIMA – DA VIGÊNCIA</p>
  <p style="margin-bottom:8px;">
    O presente acordo possui caráter irrevogável e irretratável e inicia a partir da data de sua assinatura, permanecendo-o enquanto estiver sendo desenvolvido ou executado o projeto de colaboração.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO PRIMEIRO</p>
  <p style="margin-bottom:8px;padding-left:20px;">
    Após a extinção do Termo, as obrigações de confidencialidade nele firmadas manter-se-ão, a contar da data que for concluído o projeto de colaboração ou descartada a sua concretização.
  </p>
  <p style="font-weight:bold;margin:12px 0 6px 0;">PARÁGRAFO SEGUNDO</p>
  <p style="margin-bottom:16px;padding-left:20px;">
    Ainda que o projeto de colaboração não venha a ser executado, o dever de confidencialidade persistirá.
  </p>

  <p style="margin-bottom:24px;">
    O presente Termo tem natureza irrevogável e irretratável, e o seu não cumprimento acarretará todos os efeitos de ordem penal, civil e administrativa contra seus transgressores.
  </p>

  <p style="margin-bottom:32px;">
    Para dirimir quaisquer dúvidas oriundas do presente Termo, fica eleito o foro da Comarca de {{empresa.cidade}} - {{empresa.estado}}, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir as questões oriundas da interpretação e execução do presente contrato. Os CONTRATANTES submeterão à arbitragem eventuais litígios oriundos do presente contrato. (Lei nº 9.307/96).
  </p>

  <p style="margin-bottom:48px;">
    E, por estarem justos e contratados, as partes assinam o presente contrato, em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas e para um só efeito.
  </p>

  <p style="text-align:right;margin-bottom:48px;">{{empresa.cidade}}, {{data_hoje}}.</p>

  <!-- Assinaturas -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td width="44%" align="center" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.6;">
        {{empresa.representante}}<br>
        {{empresa.representante_cargo}}<br>
        {{empresa.razao_social}}<br>
        CNPJ: {{empresa.cnpj}}
      </td>
      <td width="12%"></td>
      <td width="44%" align="center" style="border-top:1px solid #000;padding-top:6px;font-size:10pt;line-height:1.6;">
        {{cliente.nome}}<br>
        CPF/CNPJ: {{cliente.cpf_cnpj}}
      </td>
    </tr>
  </table>

  <!-- Rodapé -->
  <div style="border-top:2px solid #000;margin-top:48px;padding-top:8px;display:flex;justify-content:space-between;font-size:9pt;color:#555;">
    <span>Tel.: {{empresa.telefone}}</span>
    <span>{{empresa.email}}</span>
  </div>

</div>
`;

// Verifica se já existe
const existente = await prisma.modeloDocumento.findFirst({
  where: { empresa_id: empresa.id, nome: "Termo de Confidencialidade e Sigilo" },
});

if (existente) {
  const atualizado = await prisma.modeloDocumento.update({
    where: { id: existente.id },
    data: { conteudo, ativo: true },
  });
  console.log(`✅ Modelo atualizado: [${atualizado.id}] ${atualizado.nome}`);
} else {
  const criado = await prisma.modeloDocumento.create({
    data: {
      empresa_id: empresa.id,
      nome: "Termo de Confidencialidade e Sigilo",
      tipo: "CONTRATO",
      conteudo,
      ativo: true,
    },
  });
  console.log(`✅ Modelo criado: [${criado.id}] ${criado.nome}`);
}

await prisma.$disconnect();
