// Converte texto digitado em textarea para HTML seguro, preservando as quebras de linha.
export function textoParaHtml(texto: string | null | undefined): string {
  return (texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "<br />");
}
