import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const RECURSOS_TODOS = [
  "clientes", "servicos", "crm", "propostas", "contratos",
  "projetos", "modelos", "agenda", "financeiro", "faturamento",
  "diagnosticos", "configuracoes",
];
const ACOES = ["criar", "editar", "excluir"];

const PERFIS_CONFIG = [
  { nome: "Administrador", descricao: "Acesso total ao sistema", recursos: RECURSOS_TODOS },
  { nome: "Gestor", descricao: "Acesso a todos os módulos exceto configurações", recursos: RECURSOS_TODOS.filter(r => r !== "configuracoes") },
  { nome: "Analista", descricao: "Acesso somente a projetos", recursos: ["projetos"] },
];

async function garantirPermissao(recurso: string, acao: string) {
  return prisma.permissao.upsert({
    where: { recurso_acao: { recurso, acao } },
    update: {},
    create: { recurso, acao, descricao: `${acao} ${recurso}` },
  });
}

async function seedEmpresa(empresaId: string, empresaNome: string) {
  console.log(`\n→ Empresa: ${empresaNome} (${empresaId})`);

  for (const config of PERFIS_CONFIG) {
    const perfil = await prisma.perfil.upsert({
      where: { empresa_id_nome: { empresa_id: empresaId, nome: config.nome } },
      update: { descricao: config.descricao },
      create: { empresa_id: empresaId, nome: config.nome, descricao: config.descricao },
    });

    // Remove permissões existentes para recalcular corretamente
    await prisma.perfilPermissao.deleteMany({ where: { perfil_id: perfil.id } });

    let count = 0;
    for (const recurso of config.recursos) {
      for (const acao of ACOES) {
        const permissao = await garantirPermissao(recurso, acao);
        await prisma.perfilPermissao.create({
          data: { perfil_id: perfil.id, permissao_id: permissao.id },
        });
        count++;
      }
    }

    console.log(`  ✓ Perfil "${config.nome}" — ${count} permissões`);
  }
}

async function main() {
  console.log("Seed de perfis — Administrador / Gestor / Analista");

  const empresas = await prisma.empresa.findMany({ select: { id: true, nome: true } });
  console.log(`Empresas encontradas: ${empresas.length}`);

  for (const empresa of empresas) {
    await seedEmpresa(empresa.id, empresa.nome);
  }

  console.log("\n✅ Seed concluído!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
