import { Unzip, UnzipInflate, unzipSync } from "fflate";
import { readQuestionWordXml } from "./question-document.ts";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;

/** Verify advertised and actual sizes before reading an Office archive. */
export function assertSafeQuestionArchive(bytes: Uint8Array, requiredEntries: string[], label = "Office") {
  if (bytes.length > MAX_FILE_BYTES) throw new Error("El archivo supera 2 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error(`El archivo no es un ${label} válido.`);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error(`No se admite un archivo ${label} dividido o incompleto.`);
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (!count || count > 256 || count !== view.getUint16(end + 8, true) || start + size !== end) throw new Error(`La estructura del ${label} supera los límites permitidos.`);
  let position = start, total = 0; const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw new Error(`El ${label} está dañado.`);
    const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true);
    const compressed = view.getUint32(position + 20, true), inflated = view.getUint32(position + 24, true);
    const length = view.getUint16(position + 28, true), extra = view.getUint16(position + 30, true), comment = view.getUint16(position + 32, true);
    const local = view.getUint32(position + 42, true), next = position + 46 + length + extra + comment;
    if (next > end || flags & 1 || ![0, 8].includes(method) || local + 30 > start || view.getUint32(local, true) !== 0x04034b50) throw new Error("No se admiten archivos cifrados o con una estructura inválida.");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(position + 46, position + 46 + length));
    if (names.has(name) || /(?:^|\/)\.\.(?:\/|$)|^\/|\\|vbaProject|externalLinks|embeddings|activeX/i.test(name)) throw new Error(`El ${label} contiene macros, enlaces externos o contenido no permitido.`);
    names.add(name);
    if (view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw new Error(`El ${label} contiene entradas inconsistentes.`);
    const localLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    const localName = new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + localLength));
    if (localName !== name || local + 30 + localLength + localExtra + compressed > start) throw new Error(`El ${label} contiene entradas inconsistentes.`);
    total += inflated;
    if (inflated === 0xffffffff || compressed === 0xffffffff || total > MAX_UNCOMPRESSED_BYTES) throw new Error(`El contenido descomprimido del ${label} supera 8 MB.`);
    position = next;
  }
  if (position !== end || requiredEntries.some(name => !names.has(name))) throw new Error(`El archivo no contiene un libro ${label} válido.`);
  // Do not trust the advertised size: inspect actual output in bounded input chunks.
  let actualBytes = 0, completed = 0; const extracted = new Set<string>(); let issue: Error | null = null;
  const unzip = new Unzip(file => {
    if (extracted.has(file.name) || !names.has(file.name)) { issue = new Error(`El ${label} contiene entradas inconsistentes.`); return; }
    extracted.add(file.name);
    file.ondata = (error, chunk, final) => {
      if (error) { issue = error; file.terminate(); return; }
      actualBytes += chunk.length;
      if (actualBytes > MAX_UNCOMPRESSED_BYTES) { issue = new Error(`El contenido descomprimido del ${label} supera 8 MB.`); file.terminate(); }
      if (final) completed++;
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 1024) {
      unzip.push(bytes.subarray(offset, Math.min(offset + 1024, bytes.length)), offset + 1024 >= bytes.length);
      if (issue) throw issue;
    }
  } catch (error) { throw error instanceof Error ? error : new Error(`No se pudo verificar el ${label}.`); }
  if (completed !== count || extracted.size !== count) throw new Error(`El ${label} está incompleto.`);
}

export function assertSafeQuestionWorkbook(bytes: Uint8Array) {
  assertSafeQuestionArchive(bytes, ["[Content_Types].xml", "xl/workbook.xml"], "Excel .xlsx");
}

export async function readQuestionBlockFile(file: File, parser?: Pick<DOMParser, "parseFromString">): Promise<{ grid?: unknown[][]; text?: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) {
    assertSafeQuestionWorkbook(bytes);
    const { readSheet } = await import("read-excel-file/browser");
    return { grid: await readSheet(file) };
  }
  if (/\.docx$/i.test(file.name)) {
    assertSafeQuestionArchive(bytes, ["[Content_Types].xml", "word/document.xml"], "Word .docx");
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(bytes, { filter: entry => entry.name === "word/document.xml" })["word/document.xml"]);
    return readQuestionWordXml(xml, parser);
  }
  if (/\.pdf$/i.test(file.name)) {
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) throw new Error("El archivo no es un PDF válido.");
    const { readQuestionPdfFile } = await import("./question-pdf-browser.ts");
    return { text: await readQuestionPdfFile(bytes) };
  }
  if (/\.doc$/i.test(file.name)) throw new Error("Guarda el Word antiguo .doc como .docx para leer sus preguntas.");
  if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error("Usa Word .docx, PDF con texto, Excel .xlsx, CSV o TSV/TXT.");
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  try { return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes) }; }
  catch { throw new Error("Guarda el CSV como UTF-8 o copia la tabla de Excel y pégala aquí."); }
}
