import { parseQuestionTable, tableQuestionInputs } from "./question-blocks.ts";

type DocumentQuestion = Record<string, unknown> & { prompt: string; options: string[]; documentErrors: string[] };
const labelKey = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const labels: Record<string, string> = {
  formato: "format", tipo: "format", contexto: "caseContext", "contexto del caso": "caseContext",
  enunciado: "prompt", "pregunta de analisis": "prompt", correcta: "correct", "respuesta correcta": "correct", clave: "correct",
  explicacion: "explanation", justificacion: "explanation", fuente: "source", referencia: "source", "mezclar alternativas": "shuffleOptions",
};

/** Prepared questions in paragraphs, with explicit answers; never infer a missing key. */
export function documentQuestionInputs(value: string) {
  if (new TextEncoder().encode(value).byteLength > 1_000_000) throw new Error("El texto extraído supera 1 MB. Divide el documento en bloques.");
  const lines = value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const questions: DocumentQuestion[] = []; let current: DocumentQuestion | null = null, field = "prompt", explicitOptions = false;
  const add = (prompt: string, lineIndex: number) => {
    if (questions.length >= 100) throw new Error("Cada bloque admite hasta 100 preguntas.");
    const question: DocumentQuestion = { prompt, options: ["", "", "", ""], documentErrors: [], importRow: questions.length + 1 }; questions.push(question); field = "prompt";
    // Explicit alternatives distinguish the answer choices from A/B lists in relation exercises.
    explicitOptions = false;
    for (let i = lineIndex + 1; i < lines.length; i++) {
      if (/^Pregunta\s+\d+/i.test(lines[i].trim())) break;
      if (/^(?:Alternativa\s+|Opci[oó]n\s+)[A-D]\s*[.):]/i.test(lines[i].trim())) { explicitOptions = true; break; }
      if (/^(?:Correcta|Respuesta correcta|Clave)\s*:/i.test(lines[i].trim())) break;
    }
    return question;
  };
  for (const [lineIndex, raw] of lines.entries()) {
    const line = raw.trim(); if (!line) continue;
    const explicit = /^Pregunta\s+\d+\s*[:.)-]?\s*(.*)$/i.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (explicit || (numbered && (!current || (current.options.every(Boolean) && ["correct", "explanation", "source", "shuffleOptions"].includes(field))))) { current = add((explicit || numbered)![1], lineIndex); continue; }
    if (!current) {
      if (/^Enunciado\s*:/i.test(line)) current = add(line.replace(/^Enunciado\s*:\s*/i, ""), lineIndex);
      continue;
    }
    const option = (explicitOptions ? /^(?:Alternativa\s+|Opci[oó]n\s+)([A-D])\s*[.):]\s*(.*)$/i : /^(?:Alternativa\s+|Opci[oó]n\s+)?([A-D])\s*[.):]\s*(.*)$/i).exec(line);
    if (option) {
      const index = option[1].toUpperCase().charCodeAt(0) - 65;
      if (current.options[index]) current.documentErrors.push(`La alternativa ${option[1].toUpperCase()} aparece dos veces. Si hay listas de relación, usa “Alternativa A:” para separar las respuestas de las listas.`);
      else current.options[index] = option[2];
      field = `option${index}`; continue;
    }
    const label = /^([^:]{2,35}):\s*(.*)$/.exec(line), target = label && labels[labelKey(label[1])];
    if (target) {
      if (current[target] && target !== "prompt") current.documentErrors.push(`El campo ${label![1]} aparece dos veces.`);
      current[target] = label![2]; field = target === "format" ? "prompt" : target; continue;
    }
    if (field.startsWith("option")) { const index = Number(field.slice(6)); current.options[index] += `\n${line}`; }
    else current[field] = `${current[field] || ""}${current[field] ? "\n" : ""}${line}`;
  }
  if (!questions.length) throw new Error("No se reconocieron preguntas. Usa “Pregunta 1:”, alternativas A–D, “Correcta:”, “Explicación:” y “Fuente:”, o una tabla con los encabezados de la plantilla.");
  return questions.map(question => {
    const correct = String(question.correct || "").trim().replace(/[.)]$/, "").toUpperCase();
    return { ...question, correctIndex: /^[A-D]$/.test(correct) ? correct.charCodeAt(0) - 65 : /^[1-4]$/.test(correct) ? Number(correct) - 1 : -1 };
  });
}

export function questionTextInputs(text: string) {
  const first = text.replace(/^\uFEFF/, "").trimStart().split(/\r?\n/)[0];
  return /(?:opcion|opción|alternativa)[_ ]a/i.test(first) && /[,;\t]/.test(first) ? tableQuestionInputs(parseQuestionTable(text)) : documentQuestionInputs(text);
}

export const WORD_QUESTION_TEMPLATE_TEXT = `Pregunta 1: Escribe aquí el enunciado completo.
Formato: Selección directa
Alternativa A: Primera respuesta
Alternativa B: Segunda respuesta
Alternativa C: Tercera respuesta
Alternativa D: Cuarta respuesta
Correcta: A
Explicación: Justifica la respuesta correcta con el contenido del material.
Fuente: Material, tema y página o sección.

Pregunta 2:
Formato: Caso práctico
Contexto: Describe aquí la situación y sus datos relevantes.
Enunciado: Escribe aquí la pregunta de análisis.
Alternativa A: Primera decisión
Alternativa B: Segunda decisión
Alternativa C: Tercera decisión
Alternativa D: Cuarta decisión
Correcta: B
Explicación: Justifica la decisión correcta.
Fuente: Material, tema y página o sección.
`;

function paragraphText(element: Element) {
  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const child = node as Element;
      if (child.localName === "t") { text += child.textContent || ""; return; }
      if (child.localName === "br" || child.localName === "cr") { text += "\n"; return; }
      if (child.localName === "tab") { text += "\t"; return; }
      if (["del", "instrText", "drawing", "object"].includes(child.localName)) return;
    }
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
  };
  walk(element); return text;
}

export function readQuestionWordXml(xml: string, parser: Pick<DOMParser, "parseFromString"> = new DOMParser()): { grid?: string[][]; text?: string } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("El Word contiene declaraciones XML no permitidas.");
  const document = parser.parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("No se pudo leer el contenido del Word.");
  const wordNamespace = ["http://schemas.openxmlformats.org/wordprocessingml/2006/main", "http://purl.oclc.org/ooxml/wordprocessingml/main"].find(namespace => document.getElementsByTagNameNS(namespace, "body").length) || "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const tables = Array.from(document.getElementsByTagNameNS(wordNamespace, "tbl"));
  for (const table of tables) {
    const grid = Array.from(table.getElementsByTagNameNS(wordNamespace, "tr")).map(row => Array.from(row.childNodes).filter(node => node.nodeType === 1 && (node as Element).localName === "tc").map(cell => Array.from((cell as Element).getElementsByTagNameNS(wordNamespace, "p")).map(paragraphText).join("\n")));
    if (grid[0]?.some(cell => /(?:opcion|opción|alternativa)[_ ]a/i.test(cell))) {
      if (tables.length > 1) throw new Error("El documento tiene varias tablas. Deja una sola tabla de preguntas por archivo para evitar omisiones.");
      const outside = Array.from(document.getElementsByTagNameNS(wordNamespace, "p")).filter(paragraph => {
        for (let node = paragraph.parentNode; node; node = node.parentNode) if (node.nodeType === 1 && (node as Element).localName === "tbl") return false;
        return true;
      });
      if (outside.some(paragraph => /^(?:Pregunta\s+\d+|\d+[.)]\s|Enunciado\s*:)/i.test(paragraphText(paragraph).trim()))) throw new Error("Hay preguntas fuera de la tabla. Usa una sola tabla o todas las preguntas en párrafos para evitar omisiones.");
      return { grid };
    }
  }
  const text = Array.from(document.getElementsByTagNameNS(wordNamespace, "p")).map(paragraphText).join("\n");
  if (!text.trim()) throw new Error("El Word no contiene texto legible. Las preguntas en imágenes necesitan conversión a texto.");
  return { text };
}
