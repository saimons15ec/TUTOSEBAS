type TextItem = { str: string; transform?: number[]; width?: number; hasEOL?: boolean };
type TextPage = { getTextContent: () => Promise<{ items: unknown[] }> };
type TextDocument = { numPages: number; getPage: (page: number) => Promise<TextPage> };

/** Extract text only. Images, forms and document scripts never supply answer keys. */
export async function extractQuestionPdf(document: TextDocument) {
  if (!Number.isInteger(document.numPages) || document.numPages < 1 || document.numPages > 60) throw new Error("El PDF debe tener entre 1 y 60 páginas. Divide el archivo en bloques.");
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber), content = await page.getTextContent();
    let previousY: number | undefined, previousEnd: number | undefined, lineEnded = true, pageHasText = false;
    for (const value of content.items) {
      if (!value || typeof value !== "object" || !("str" in value) || typeof value.str !== "string") continue;
      const item = value as TextItem, y = item.transform?.[5], x = item.transform?.[4];
      if (item.str && !lineEnded && typeof y === "number" && typeof previousY === "number" && Math.abs(y - previousY) > 2) { text += "\n"; lineEnded = true; }
      if (item.str) {
        const touching = typeof x === "number" && typeof previousEnd === "number" && Math.abs(x - previousEnd) <= 1;
        const separator = lineEnded || touching || /\s$/.test(text) || /^\s/.test(item.str) ? "" : " ";
        text += separator + item.str; lineEnded = false; previousY = y;
        previousEnd = typeof x === "number" && typeof item.width === "number" ? x + item.width : undefined;
        pageHasText ||= Boolean(item.str.trim());
      }
      if (item.hasEOL) { text += "\n"; lineEnded = true; }
      if (text.length > 1_000_000) throw new Error("El texto del PDF supera 1 MB. Divide el archivo en bloques.");
    }
    if (!pageHasText) throw new Error(`La página ${pageNumber} del PDF no contiene texto legible. Elimina las páginas vacías o convierte los escaneos a texto con OCR.`);
    text += "\n";
  }
  if (!text.trim()) throw new Error("El PDF no contiene texto legible. Si está escaneado o son imágenes, conviértelo primero a texto con OCR.");
  if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error("El texto del PDF supera 1 MB. Divide el archivo en bloques.");
  return text;
}
