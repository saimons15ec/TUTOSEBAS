import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser as XmlParser } from "@xmldom/xmldom";
import { strToU8, zipSync } from "fflate";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { documentQuestionInputs, questionTextInputs, readQuestionWordXml } from "../lib/question-document.ts";
import { readQuestionBlockFile, assertSafeQuestionArchive } from "../lib/question-block-file.ts";
import { questionWordTemplate } from "../lib/question-word-template.ts";
import { extractQuestionPdf } from "../lib/question-pdf.ts";
import { questionTemplateCsv } from "../lib/question-templates.ts";
import { parseQuestionTable, QUESTION_FORMATS, tableQuestionInputs, previewQuestionBlock, type BlockContext } from "../lib/question-blocks.ts";

const parser = new XmlParser() as unknown as Pick<DOMParser, "parseFromString">;
const context: BlockContext = { area: "complexive", subject: "Ciencias Naturales", topic: "Tema 1", period: "2026-2027", title: "Tema 1", source: "Manual, p. 3", sourceResourceId: "", format: "Selección directa", plan: "Bronce" };

test("mixed Word and CSV templates preserve each of the five question formats and case context", async () => {
  const mixed = { ...context, requireExplicitFormat: true };
  const csv = previewQuestionBlock(tableQuestionInputs(parseQuestionTable(questionTemplateCsv("Mixto"))), mixed);
  const file = new File([questionWordTemplate("Mixto").buffer as ArrayBuffer], "Mixto.docx");
  const extracted = await readQuestionBlockFile(file, parser);
  const word = previewQuestionBlock(questionTextInputs(extracted.text || ""), mixed);
  for (const preview of [csv, word]) {
    assert.equal(preview.invalid, 0); assert.equal(preview.questions.length, 5);
    assert.deepEqual(preview.questions.map(question => question.format), [...QUESTION_FORMATS]);
    assert.ok(preview.questions.find(question => question.format === "Caso práctico")?.caseContext);
    assert.equal(preview.questions.find(question => question.format === "Ordenar")?.shuffleOptions, false);
  }
});

test("mixed imports reject an unspecified format instead of silently converting the question", () => {
  const table = parseQuestionTable(questionTemplateCsv("Mixto")); table[1][7] = "";
  const preview = previewQuestionBlock(tableQuestionInputs(table), { ...context, requireExplicitFormat: true });
  assert.equal(preview.invalid, 1); assert.match(preview.rows[0].errors.join(" "), /Indica el formato/);
  assert.equal(preview.questions.length, 4);
});
const prepared = (index: number, format = "Selección directa") => `Pregunta ${index}: Pregunta sobre ciencias ${index}.
Formato: ${format}
${format === "Caso práctico" ? "Contexto: Un aula investiga la germinación.\nLa segunda línea conserva sus datos.\n" : ""}Alternativa A: Observar y comparar
Alternativa B: Copiar sin analizar
Alternativa C: Omitir los datos
Alternativa D: Cambiar la variable sin registro
Correcta: B
Explicación: Se conserva la clave escrita en el documento.
Fuente: Manual, p. 3`;
const xml = (body: string) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const paragraphs = (text: string) => text.split("\n").map(line => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("");
const docx = (body: string) => zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml(body)) });

test("reads a real DOCX archive of 20 questions with five formats and multiline cases", async () => {
  const formats = ["Selección directa", "Completar", "Relacionar", "Ordenar", "Caso práctico"];
  const result = await readQuestionBlockFile(new File([docx(paragraphs(Array.from({ length: 20 }, (_, i) => prepared(i + 1, formats[i % 5])).join("\n\n")))], "bloque.docx"), parser);
  const preview = previewQuestionBlock(questionTextInputs(result.text!), context);
  assert.equal(preview.questions.length, 20); assert.equal(preview.invalid, 0);
  assert.equal(preview.questions[4].format, "Caso práctico"); assert.match(preview.questions[4].caseContext, /segunda línea/);
  assert.equal(preview.questions[19].correctIndex, 1);
});

test("the downloadable Word template is a readable DOCX with explicit keys", async () => {
  const result = await readQuestionBlockFile(new File([questionWordTemplate()], "plantilla.docx"), parser);
  const preview = previewQuestionBlock(questionTextInputs(result.text!), context);
  assert.equal(preview.invalid, 0); assert.equal(preview.questions.length, 2);
  assert.equal(preview.questions[0].correctIndex, 0); assert.equal(preview.questions[1].correctIndex, 0);
});

test("Word tables preserve cells and reject multiple tables instead of omitting content", () => {
  const header = ["pregunta", "opcion_a", "opcion_b", "opcion_c", "opcion_d", "correcta", "explicacion", "fuente"];
  const table = `<w:tbl>${[header, ["¿Qué proceso?", "Uno", "Dos", "Tres", "Cuatro", "C", "Justificación", "Manual"]].map(row => `<w:tr>${row.map(cell => `<w:tc>${paragraphs(cell)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  const result = readQuestionWordXml(xml(table), parser);
  assert.equal(result.grid?.[1][5], "C");
  assert.throws(() => readQuestionWordXml(xml(table + table), parser), /varias tablas/);
  assert.throws(() => readQuestionWordXml(xml(table + paragraphs(prepared(1))), parser), /fuera de la tabla/);
});

test("relation letters and ordered numbered steps stay in the prompt", () => {
  const text = prepared(1, "Relacionar").replace("Alternativa A:", "A) Planta\nB) Animal\n1. Fotosíntesis\n2. Respiración\nAlternativa A:");
  const questions = documentQuestionInputs(text), preview = previewQuestionBlock(questions, context);
  assert.equal(preview.invalid, 0); assert.equal(preview.questions.length, 1);
  assert.match(preview.questions[0].prompt, /A\) Planta/); assert.match(preview.questions[0].prompt, /1\. Fotosíntesis/);
  assert.equal(preview.questions[0].options[0], "Observar y comparar");
});

test("plain numbered questions and bare alternatives work without a template", () => {
  const text = `${prepared(1)}\n\n${prepared(2)}`.replace(/Pregunta (\d+):/g, "$1.").replace(/Alternativa /g, "");
  const preview = previewQuestionBlock(questionTextInputs(text), context);
  assert.equal(preview.questions.length, 2); assert.equal(preview.invalid, 0);
});

test("missing or duplicated keys and duplicated alternatives cannot silently pass", () => {
  for (const text of [prepared(1).replace("Correcta: B\n", ""), prepared(1).replace("Correcta: B", "Correcta: B\nCorrecta: A"), prepared(1).replace("Alternativa B:", "Alternativa A:")]) {
    assert.ok(previewQuestionBlock(documentQuestionInputs(text), context).invalid > 0);
  }
  assert.throws(() => documentQuestionInputs("Un material sin preguntas ni respuestas."), /No se reconocieron/);
  assert.throws(() => documentQuestionInputs(Array.from({ length: 101 }, (_, i) => prepared(i + 1)).join("\n")), /100 preguntas/);
});

test("Word rejects XML entities, embedded objects, empty text, and legacy DOC", async () => {
  assert.throws(() => readQuestionWordXml('<!DOCTYPE test [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + xml(paragraphs("Pregunta 1: &x;")), parser), /XML no permitidas/);
  assert.throws(() => readQuestionWordXml(xml("<w:p><w:drawing/></w:p>"), parser), /texto legible/);
  const embedded = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml(paragraphs(prepared(1)))), "word/embeddings/object.bin": new Uint8Array([1]) });
  assert.throws(() => assertSafeQuestionArchive(embedded, ["word/document.xml"], "Word"), /contenido no permitido/);
  await assert.rejects(readQuestionBlockFile(new File(["legacy"], "preguntas.doc")), /como .docx/);
});

// Complete PDF fixture: real cross-reference table and a standard text font.
function pdfFixture(lines: string[]) {
  const escaped = (line: string) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT /F1 11 Tf 40 790 Td 14 TL ${lines.map((line, i) => `${i ? "T* " : ""}(${escaped(line)}) Tj`).join("\n")} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`];
  let result = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(result, "latin1")); result += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result, "latin1");
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(result, "latin1"));
}

test("extracts real PDF text through PDF.js and preserves accents, keys and cases", async () => {
  const task = getDocument({ data: pdfFixture(`${prepared(1)}\n${prepared(2, "Caso práctico")}`.split("\n")), useWorkerFetch: false, useWasm: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: true });
  try {
    const text = await extractQuestionPdf(await task.promise), preview = previewQuestionBlock(questionTextInputs(text), context);
    assert.equal(preview.questions.length, 2); assert.equal(preview.invalid, 0);
    assert.equal(preview.questions[1].correctIndex, 1); assert.match(preview.questions[1].caseContext, /germinación/);
  } finally { await task.destroy(); }
});

test("rejects scanned PDF text, excessive pages and oversized extracted text", async () => {
  await assert.rejects(extractQuestionPdf({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [] }) }) }), /OCR/);
  await assert.rejects(extractQuestionPdf({ numPages: 61, getPage: async () => { throw new Error("must not read"); } }), /60 páginas/);
  await assert.rejects(extractQuestionPdf({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "x".repeat(1_000_001) }] }) }) }), /1 MB/);
  await assert.rejects(extractQuestionPdf({ numPages: 2, getPage: async page => ({ getTextContent: async () => ({ items: page === 1 ? [{ str: prepared(1) }] : [] }) }) }), /página 2.*OCR/);
});

test("joins adjacent PDF fragments without breaking question labels", async () => {
  const text = await extractQuestionPdf({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "Pregun", transform: [1, 0, 0, 1, 0, 100], width: 30 }, { str: "ta 1: Texto", transform: [1, 0, 0, 1, 30, 100], width: 50, hasEOL: true }, ...prepared(1).split("\n").slice(1).map(str => ({ str, hasEOL: true }))] }) }) });
  const preview = previewQuestionBlock(questionTextInputs(text), context);
  assert.equal(preview.invalid, 0); assert.equal(preview.questions[0].prompt, "Texto");
  const strict = readQuestionWordXml(xml(paragraphs(prepared(1))).replace(/http:\/\/schemas.openxmlformats.org\/wordprocessingml\/2006\/main/g, "http://purl.oclc.org/ooxml/wordprocessingml/main"), parser);
  assert.equal(previewQuestionBlock(questionTextInputs(strict.text!), context).invalid, 0);
});


test("each selected format produces its own valid Word and CSV question structure", async () => {
  for (const format of QUESTION_FORMATS) {
    const csv = questionTemplateCsv(format);
    const csvPreview = previewQuestionBlock(tableQuestionInputs(parseQuestionTable(csv)), { ...context, format });
    assert.equal(csvPreview.invalid, 0); assert.equal(csvPreview.questions.length, 2);
    assert.ok(csvPreview.questions.every(question => question.format === format));
    const document = await readQuestionBlockFile(new File([questionWordTemplate(format, { subject: context.subject, topic: context.topic })], "template.docx"), parser);
    const wordPreview = previewQuestionBlock(questionTextInputs(document.text!), { ...context, format });
    assert.equal(wordPreview.invalid, 0); assert.equal(wordPreview.questions.length, 2);
    assert.ok(wordPreview.questions.every(question => question.format === format));
    assert.equal(wordPreview.questions[0].prompt, csvPreview.questions[0].prompt);
    if (format === "Caso práctico") assert.ok(wordPreview.questions.every(question => question.caseContext));
    if (format === "Completar") assert.match(wordPreview.questions[0].prompt, /____/);
    if (format === "Relacionar") assert.match(wordPreview.questions[0].prompt, /Lista 1:[\s\S]*Lista 2:/);
    if (format === "Ordenar") assert.match(wordPreview.questions[0].prompt, /1\.[\s\S]*2\.[\s\S]*3\./);
  }
});
