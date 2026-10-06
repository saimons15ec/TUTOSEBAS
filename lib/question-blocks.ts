export const QUESTION_FORMATS = ["Selección directa", "Completar", "Relacionar", "Ordenar", "Caso práctico"] as const;
export const MAX_BLOCK_QUESTIONS = 100;
export type QuestionFormat = typeof QUESTION_FORMATS[number];
export type BlockContext = {
  area: "complexive" | "final_degree"; subject: string; topic: string; topicId?: string; period: string;
  title: string; format: QuestionFormat; source: string; sourceResourceId: string; plan: string; requireExplicitFormat?: boolean;
};
export type BlockQuestion = {
  prompt: string; options: string[]; correctIndex: number; explanation: string; source: string;
  format: QuestionFormat; caseContext: string; shuffleOptions: boolean; importRow: number;
};
export type BlockPreviewRow = { row: number; question: BlockQuestion | null; errors: string[]; duplicate: boolean };

export function questionKey(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function questionIdentity(question: { prompt?: unknown; caseContext?: unknown }) {
  return JSON.stringify([questionKey(typeof question.prompt === "string" ? question.prompt : ""), questionKey(typeof question.caseContext === "string" ? question.caseContext : "")]);
}

function headerKey(value: unknown) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s-]+/g, "_");
}
const headers: Record<string, string> = {
  pregunta: "prompt", enunciado: "prompt", opcion_a: "a", alternativa_a: "a", a: "a",
  opcion_b: "b", alternativa_b: "b", b: "b", opcion_c: "c", alternativa_c: "c", c: "c",
  opcion_d: "d", alternativa_d: "d", d: "d", correcta: "correct", respuesta_correcta: "correct",
  explicacion: "explanation", formato: "format", tipo: "format", contexto: "caseContext",
  contexto_del_caso: "caseContext", fuente: "source", mezclar_alternativas: "shuffleOptions",
  numero: "number", n: "number",
};

/** CSV/TSV with quoted cells, escaped quotes and multiline case descriptions. */
export function parseQuestionTable(value: string): string[][] {
  if (!value.trim()) return [];
  if (new TextEncoder().encode(value).byteLength > 1_000_000) throw new Error("La tabla supera 1 MB.");
  const input = value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const counts = new Map([["\t", 0], [";", 0], [",", 0]]);
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '"') {
      if (quoted && input[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && input[i] === "\n") break;
    else if (!quoted && counts.has(input[i])) counts.set(input[i], counts.get(input[i])! + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cell = "", inQuotes = false, afterQuote = false;
  const addRow = () => { row.push(cell); if (row.some(item => item.trim())) rows.push(row); row = []; cell = ""; afterQuote = false; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { inQuotes = false; afterQuote = true; }
      else cell += char;
    } else if (char === delimiter) { row.push(cell); cell = ""; afterQuote = false; }
    else if (char === "\n") addRow();
    else if (char === '"' && !cell && !afterQuote) inQuotes = true;
    else if (char === '"' || (afterQuote && char.trim())) throw new Error("Comillas mal cerradas en la tabla. Usa la plantilla y encierra las celdas con saltos de línea entre comillas.");
    else if (!afterQuote) cell += char;
    if (rows.length > MAX_BLOCK_QUESTIONS + 1 || row.length > 20) throw new Error("Cada bloque admite hasta 100 preguntas y las columnas de la plantilla.");
  }
  if (inQuotes) throw new Error("Hay una celda con comillas sin cerrar.");
  addRow();
  return rows;
}

export function tableQuestionInputs(grid: unknown[][]) {
  if (!grid.length) throw new Error("La tabla está vacía.");
  if (grid.length > MAX_BLOCK_QUESTIONS + 1) throw new Error("Cada bloque admite hasta 100 preguntas.");
  const mapped = grid[0].map(value => headers[headerKey(value)]);
  if (mapped.some(value => !value)) throw new Error("Hay columnas desconocidas. Descarga la plantilla para comprobar los encabezados.");
  if (new Set(mapped).size !== mapped.length) throw new Error("Hay columnas repetidas.");
  if (["prompt", "a", "b", "c", "d", "correct", "explanation"].some(value => !mapped.includes(value))) throw new Error("Faltan columnas: pregunta, opcion_a, opcion_b, opcion_c, opcion_d, correcta y explicacion.");
  return grid.slice(1).flatMap((cells, index) => {
    if (!cells.some(cell => cell !== null && String(cell).trim())) return [];
    const values = Object.fromEntries(mapped.map((key, i) => {
      const cell = cells[i] ?? "";
      return [key, typeof cell === "number" && Number.isFinite(cell) ? String(cell) : cell];
    }));
    const correct = String(values.correct).trim().toUpperCase();
    const correctIndex = /^[A-D]$/.test(correct) ? correct.charCodeAt(0) - 65 : /^[1-4]$/.test(correct) ? Number(correct) - 1 : -1;
    return [{ ...values, options: [values.a, values.b, values.c, values.d], correctIndex, importRow: index + 2,
      columnError: cells.length > mapped.length && cells.slice(mapped.length).some(value => value !== null && String(value).trim()) }];
  });
}

/** Letter-dependent choices cannot be reordered without changing their meaning. */
export function optionsCanShuffle(options: string[], requested?: unknown, context = "") {
  if (requested === false || /^(no|false|0)$/i.test(String(requested ?? "").trim())) return false;
  return ![...options, context].some(option => /\b(?:anteriores|precedentes|siguientes)\b/i.test(option)
    || /\b[A-D]\s*(?:[,/+]\s*|\s+(?:y|e|o)\s+)[A-D]\b/i.test(option)
    || /\b(?:opci[oó]n|opciones|alternativa|alternativas|respuesta|respuestas)\s+[A-D]\b/i.test(option));
}

export function validateBlockContext(input: unknown): { context: BlockContext | null; errors: string[] } {
  const data = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const errors: string[] = [];
  function field(key: string, max: number, required = true) {
    const value = typeof data[key] === "string" ? (data[key] as string).trim() : "";
    if (required && !value) errors.push(`Completa ${key === "subject" ? "materia" : key === "topic" ? "tema" : key === "title" ? "nombre del bloque" : key}.`);
    if (value.length > max) errors.push(`El campo ${key} supera ${max} caracteres.`);
    return value;
  }
  const area = field("area", 40); if (!["complexive", "final_degree"].includes(area)) errors.push("Selecciona un área válida.");
  const format = field("format", 60); if (!(QUESTION_FORMATS as readonly string[]).includes(format)) errors.push("Selecciona un formato válido.");
  const context = { area, subject: field("subject", 180), topic: field("topic", 180), period: field("period", 40), title: field("title", 180), format,
    source: field("source", 500, false), sourceResourceId: field("sourceResourceId", 100, false), plan: field("plan", 20) } as BlockContext;
  const topicId = field("topicId", 100, false);
  if (topicId) context.topicId = topicId;
  if (data.requireExplicitFormat !== undefined && typeof data.requireExplicitFormat !== "boolean") errors.push("La selección de bloque mixto no es válida.");
  if (data.requireExplicitFormat === true) context.requireExplicitFormat = true;
  if (!["Bronce", "Plata", "Gold"].includes(context.plan)) errors.push("Selecciona un plan válido.");
  return { context: errors.length ? null : context, errors };
}

export function previewQuestionBlock(input: unknown[], context: BlockContext, existingQuestions: Array<string | { prompt?: unknown; caseContext?: unknown }> = []) {
  const existing = new Set(existingQuestions.map(question => questionIdentity(typeof question === "string" ? { prompt: question } : question))), seen = new Set<string>();
  if (input.length > MAX_BLOCK_QUESTIONS) return { rows: [] as BlockPreviewRow[], errors: ["El bloque debe contener entre 1 y 100 preguntas."], questions: [] as BlockQuestion[], invalid: 0, duplicates: 0 };
  const rows: BlockPreviewRow[] = input.map((item, index) => {
    const data = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    const errors: string[] = [];
    function field(value: unknown, label: string, max: number, required = true) {
      const result = typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
      if (required && !result) errors.push(`Falta ${label}.`);
      if (result.length > max) errors.push(`${label} supera ${max} caracteres.`);
      if (/\u0000/.test(result)) errors.push(`${label} contiene caracteres no permitidos.`);
      return result;
    }
    const prompt = field(data.prompt, "enunciado", 2000);
    const options = Array.isArray(data.options) ? data.options.map((value, i) => field(value, `alternativa ${String.fromCharCode(65 + i)}`, 500)) : [];
    if (options.length !== 4) errors.push("Debe tener cuatro alternativas.");
    if (new Set(options.map(questionKey)).size !== options.length) errors.push("Las alternativas deben ser distintas.");
    const correctIndex = data.correctIndex;
    if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) errors.push("Indica una sola correcta: A, B, C, D o 1–4.");
    const rawFormat = typeof data.format === "string" && data.format.trim() ? data.format.trim() : context.format;
    if (context.requireExplicitFormat && !(typeof data.format === "string" && data.format.trim())) errors.push("Indica el formato de esta pregunta en el bloque mixto.");
    const format = QUESTION_FORMATS.find(value => headerKey(value) === headerKey(rawFormat));
    if (!format) errors.push("Formato desconocido. Usa uno de los cinco formatos de la plantilla.");
    const caseContext = field(data.caseContext ?? "", "contexto", 4000, format === "Caso práctico");
    const explanation = field(data.explanation, "explicación", 2000);
    const source = field(typeof data.source === "string" && data.source.trim() ? data.source : context.source, "fuente", 500);
    if (data.columnError) errors.push("Hay más celdas que columnas en esta fila.");
    if (Array.isArray(data.documentErrors)) errors.push(...data.documentErrors.filter((error): error is string => typeof error === "string").slice(0, 5));
    if (![undefined, "", true, false, "Sí", "Si", "sí", "si", "No", "no", "true", "false", "1", "0"].includes(data.shuffleOptions as string | boolean | undefined)) errors.push("mezclar_alternativas debe ser Sí o No.");
    const key = questionIdentity({ prompt, caseContext }), duplicate = existing.has(key);
    if (seen.has(key)) errors.push("El enunciado se repite dentro del bloque.");
    seen.add(key);
    const row = typeof data.importRow === "number" && Number.isInteger(data.importRow) && data.importRow > 0 && data.importRow <= 1000 ? data.importRow : index + 1;
    return { row, errors, duplicate, question: errors.length ? null : { prompt, options, correctIndex: correctIndex as number, explanation, source,
      format: format!, caseContext, shuffleOptions: optionsCanShuffle(options, data.shuffleOptions, `${prompt}\n${caseContext}`), importRow: row } };
  });
  const errors = input.length < 1 || input.length > MAX_BLOCK_QUESTIONS ? ["El bloque debe contener entre 1 y 100 preguntas."] : [];
  return { rows, errors, questions: rows.flatMap(row => row.question && !row.duplicate ? [row.question] : []),
    invalid: rows.filter(row => row.errors.length).length, duplicates: rows.filter(row => row.duplicate).length };
}

export const QUESTION_TEMPLATE = "\uFEFFpregunta;opcion_a;opcion_b;opcion_c;opcion_d;correcta;explicacion;formato;contexto;fuente;mezclar_alternativas\r\n";
