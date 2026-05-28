import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SUPABASE_USER_ID = "98760e1d-9aeb-40a9-82b0-47e31c6a5775";
const SUPABASE_USER_EMAIL = "financeiro@raccolto.com.br";
const SUPABASE_USER_NOME = "Gino Migotto";

// Todos os recursos e ações do sistema
const PERMISSOES = [
  "clientes", "servicos", "crm", "propostas", "contratos",
  "projetos", "modelos", "agenda", "financeiro", "faturamento",
  "diagnosticos",
].flatMap((recurso) =>
  ["criar", "editar", "excluir"].map((acao) => ({ recurso, acao }))
);

async function seedPermissoes(perfilId: string) {
  let count = 0;
  for (const { recurso, acao } of PERMISSOES) {
    const permissao = await prisma.permissao.upsert({
      where: { recurso_acao: { recurso, acao } },
      update: {},
      create: { recurso, acao, descricao: `${acao} ${recurso}` },
    });
    await prisma.perfilPermissao.upsert({
      where: { perfil_id_permissao_id: { perfil_id: perfilId, permissao_id: permissao.id } },
      update: {},
      create: { perfil_id: perfilId, permissao_id: permissao.id },
    });
    count++;
  }
  console.log(`✓ ${count} permissões vinculadas ao perfil`);
}

async function main() {
  console.log("Iniciando seed...");

  // 1. Empresa
  const empresa = await prisma.empresa.upsert({
    where: { id: "empresa-seed-01" },
    update: {},
    create: {
      id: "empresa-seed-01",
      nome: "Raccolto Consultoria",
      slug: "raccolto-consultoria",
      plano: "PROFISSIONAL",
    },
  });
  console.log("✓ Empresa:", empresa.nome);

  // 2. Usuario
  const usuario = await prisma.usuario.upsert({
    where: { id: SUPABASE_USER_ID },
    update: { nome: SUPABASE_USER_NOME, email: SUPABASE_USER_EMAIL },
    create: {
      id: SUPABASE_USER_ID,
      nome: SUPABASE_USER_NOME,
      email: SUPABASE_USER_EMAIL,
    },
  });
  console.log("✓ Usuário:", usuario.nome);

  // 3. Perfil de admin
  const perfil = await prisma.perfil.upsert({
    where: { empresa_id_nome: { empresa_id: empresa.id, nome: "Administrador" } },
    update: {},
    create: {
      empresa_id: empresa.id,
      nome: "Administrador",
      descricao: "Acesso total ao sistema",
    },
  });
  console.log("✓ Perfil:", perfil.nome);

  // 4. Permissões
  await seedPermissoes(perfil.id);

  // 5. Membro da empresa
  await prisma.membroEmpresa.upsert({
    where: { usuario_id_empresa_id: { usuario_id: usuario.id, empresa_id: empresa.id } },
    update: {},
    create: {
      empresa_id: empresa.id,
      usuario_id: usuario.id,
      perfil_id: perfil.id,
      ativo: true,
    },
  });
  console.log("✓ Membro vinculado à empresa");

  console.log("\nSeed concluído! Acesse /selecionar-empresa para continuar.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
