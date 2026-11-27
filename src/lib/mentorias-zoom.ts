import { z } from "zod";
import { urlOpcional } from "@/lib/mentorias";

import type { ConfiguracaoZoom } from "@/lib/mentorias-zoom-config";

export class ErroZoom extends Error {}

export async function obterTokenZoom(configuracao: ConfiguracaoZoom) {
  const params = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: configuracao.conta,
  });
  const credenciais = Buffer.from(`${configuracao.cliente}:${configuracao.segredo}`).toString("base64");
  const resposta = await fetch(`https://zoom.us/oauth/token?${params}`, {
    method: "POST",
    headers: { Authorization: `Basic ${credenciais}` },
    signal: AbortSignal.timeout(7000),
  });
  if (!resposta.ok) throw new ErroZoom("O Zoom recusou a autenticação. Confira a configuração da conta.");
  const dados = z.object({ access_token: z.string().min(1) }).parse(await resposta.json());
  return dados.access_token;
}

export type HorarioZoom = { titulo: string; pauta: string | null; inicio: Date; duracao: number };

function corpoEncontro(encontro: HorarioZoom) {
  return {
    topic: encontro.titulo,
    agenda: encontro.pauta ?? "",
    start_time: encontro.inicio.toISOString(),
    duration: encontro.duracao,
    timezone: "America/Cuiaba",
  };
}

export async function criarSalaZoom(configuracao: ConfiguracaoZoom, encontro: HorarioZoom, gravar: boolean) {
  const token = await obterTokenZoom(configuracao);
  const host = encodeURIComponent(configuracao.anfitriao);
  const resposta = await fetch(`https://api.zoom.us/v2/users/${host}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...corpoEncontro(encontro),
      type: 2,
      settings: { waiting_room: true, auto_recording: gravar ? "cloud" : "none" },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!resposta.ok) throw new ErroZoom("O Zoom recusou a criação da sala. Confira o anfitrião e as permissões do aplicativo.");
  const dados = z.object({ id: z.union([z.number(), z.string()]), join_url: urlOpcional }).parse(await resposta.json());
  if (!dados.join_url) throw new Error("O Zoom não retornou o link da sala.");
  return { zoom_id: String(dados.id), sala_url: dados.join_url };
}

export async function atualizarSalaZoom(configuracao: ConfiguracaoZoom, id: string, encontro: HorarioZoom | null) {
  const token = await obterTokenZoom(configuracao);
  const resposta = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(id)}`, {
    method: encontro ? "PATCH" : "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: encontro ? JSON.stringify(corpoEncontro(encontro)) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!resposta.ok && !(encontro === null && resposta.status === 404)) {
    throw new ErroZoom("O Zoom recusou a alteração da sala.");
  }
}
