import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const emailAluno = z.string().trim().max(254).email("Informe um e-mail válido.").transform((email) => email.toLowerCase());
export const senhaNovaAluno = z.string().min(12, "Use pelo menos 12 caracteres.").max(128, "Use até 128 caracteres.");

const TAMANHO_HASH = 32;
const OPCOES_SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derivarSenha(senha: string, sal: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(senha, sal, TAMANHO_HASH, OPCOES_SCRYPT, (erro, resultado) => {
      if (erro) reject(erro);
      else resolve(resultado);
    });
  });
}

export async function protegerSenhaAluno(senha: string) {
  const sal = randomBytes(16);
  const hash = await derivarSenha(senha, sal);
  return `s1.${sal.toString("base64url")}.${hash.toString("base64url")}`;
}

export async function verificarSenhaAluno(senha: string, armazenado?: string) {
  const [versao, salBase, hashBase] = armazenado?.split(".") ?? [];
  const sal = Buffer.from(salBase ?? "", "base64url");
  const hash = Buffer.from(hashBase ?? "", "base64url");
  const conhecido = versao === "s1" && sal.length === 16 && hash.length === TAMANHO_HASH;
  const informado = await derivarSenha(senha, conhecido ? sal : Buffer.alloc(16));
  const igual = timingSafeEqual(informado, conhecido ? hash : Buffer.alloc(TAMANHO_HASH));
  return conhecido && igual;
}

export function hashPortalAluno(valor: string) {
  return createHash("sha256").update(valor).digest("hex");
}

async function registrarTentativa(chave: string, agora: Date) {
  const expira = new Date(agora.getTime() + 15 * 60_000);
  const [resultado] = await prisma.$queryRaw<{ tentativas: number }[]>`
    INSERT INTO "portal_aluno_limites" ("chave", "tentativas", "expira_em")
    VALUES (${hashPortalAluno(chave)}, 1, ${expira})
    ON CONFLICT ("chave") DO UPDATE
    SET "tentativas" = CASE
      WHEN "portal_aluno_limites"."expira_em" <= ${agora} THEN 1
      ELSE LEAST("portal_aluno_limites"."tentativas" + 1, 1000)
    END,
    "expira_em" = CASE
      WHEN "portal_aluno_limites"."expira_em" <= ${agora} THEN ${expira}
      ELSE "portal_aluno_limites"."expira_em"
    END
    RETURNING "tentativas"
  `;
  return resultado.tentativas;
}

export async function permitirTentativaAluno(email: string) {
  const cabecalhos = await headers();
  const origem = cabecalhos.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "local";
  const agora = new Date();
  const tentativasIp = await registrarTentativa(`aluno:origem:${origem}`, agora);
  if (tentativasIp > 120) return false;
  const tentativasEmail = await registrarTentativa(`aluno:email:${email}`, agora);

  if (randomInt(64) === 0) {
    await prisma.$transaction([
      prisma.portalAlunoLimite.deleteMany({ where: { expira_em: { lt: agora } } }),
      prisma.portalAlunoSessao.deleteMany({ where: { expira_em: { lt: agora } } }),
    ]);
  }
  return tentativasEmail <= 10;
}
