import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const esquemaConfiguracaoZoom = z.object({
  conta: z.string().trim().min(1).max(128),
  cliente: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Client ID inválido."),
  segredo: z.string().trim().min(1).max(256),
  anfitriao: z.string().trim().min(1).max(254),
  webhook: z.string().trim().max(256).optional(),
});

export type ConfiguracaoZoom = z.infer<typeof esquemaConfiguracaoZoom>;

function chaveZoom() {
  const valor = process.env.ZOOM_CONFIG_ENCRYPTION_KEY?.trim();
  if (!valor || !/^[a-zA-Z0-9+/]{43}=$/.test(valor)) return null;
  const chave = Buffer.from(valor, "base64");
  return chave.length === 32 ? chave : null;
}

export function podeSalvarConfiguracaoZoom() {
  return Boolean(chaveZoom());
}

function contexto(empresaId: string) {
  return Buffer.from(`mentorias-zoom:v1:${empresaId}`, "utf8");
}

function cifrarZoom(empresaId: string, dados: ConfiguracaoZoom) {
  const chave = chaveZoom();
  if (!chave) throw new Error("Chave de armazenamento Zoom indisponível");
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", chave, iv);
  cifrador.setAAD(contexto(empresaId));
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(dados), "utf8"), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), cifrado].map((parte) => parte.toString("base64url")).join(".");
}

function decifrarZoom(empresaId: string, pacote: string) {
  const chave = chaveZoom();
  if (!chave) throw new Error("Chave de armazenamento Zoom indisponível");
  const [iv, tag, cifrado] = pacote.split(".").map((parte) => Buffer.from(parte, "base64url"));
  if (iv?.length !== 12 || tag?.length !== 16 || !cifrado?.length) throw new Error("Configuração Zoom inválida");
  const decifrador = createDecipheriv("aes-256-gcm", chave, iv);
  decifrador.setAAD(contexto(empresaId));
  decifrador.setAuthTag(tag);
  const texto = Buffer.concat([decifrador.update(cifrado), decifrador.final()]).toString("utf8");
  return esquemaConfiguracaoZoom.parse(JSON.parse(texto));
}

export function configuracaoZoomAmbiente(empresaId: string) {
  if (process.env.ZOOM_EMPRESA_ID !== empresaId) return null;
  const resultado = esquemaConfiguracaoZoom.safeParse({
    conta: process.env.ZOOM_ACCOUNT_ID,
    cliente: process.env.ZOOM_CLIENT_ID,
    segredo: process.env.ZOOM_CLIENT_SECRET,
    anfitriao: process.env.ZOOM_HOST_ID,
    webhook: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
  });
  return resultado.success ? resultado.data : null;
}

export async function obterConfiguracaoZoomSalva(empresaId: string) {
  const registro = await prisma.integracaoZoomMentoria.findUnique({ where: { empresa_id: empresaId }, select: { dados: true } });
  return registro ? decifrarZoom(empresaId, registro.dados) : null;
}

export async function obterConfiguracaoZoom(empresaId: string) {
  return await obterConfiguracaoZoomSalva(empresaId) ?? configuracaoZoomAmbiente(empresaId);
}

export async function persistirConfiguracaoZoom(empresaId: string, configuracao: ConfiguracaoZoom) {
  const dados = cifrarZoom(empresaId, configuracao);
  await prisma.integracaoZoomMentoria.upsert({
    where: { empresa_id: empresaId },
    update: { dados },
    create: { empresa_id: empresaId, dados },
  });
}
