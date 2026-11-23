// O Autentique não acessa URLs externas ao converter o HTML: a logo precisa ir embutida.
export async function logoImgBase64(logoUrl: string | null | undefined): Promise<string> {
  if (!logoUrl) return "";
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return "";
    const mime = res.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `<img src="data:${mime};base64,${b64}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`;
  } catch {
    return "";
  }
}
