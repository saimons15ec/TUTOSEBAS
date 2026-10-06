import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { readSheet } from "read-excel-file/node";
import { zipSync, strToU8 } from "fflate";
import { parseQuestionTable, previewQuestionBlock, QUESTION_FORMATS, tableQuestionInputs, validateBlockContext, type BlockContext, type BlockQuestion } from "../lib/question-blocks.ts";
import { assertSafeQuestionWorkbook, readQuestionBlockFile } from "../lib/question-block-file.ts";
import { approveQuestionBlockRecords, saveQuestionBlock } from "../lib/question-block-storage.ts";
import { gradeSimulatorAttempt, matchesSimulatorTopics, prepareQuestionChoices, publicAttemptQuestions, simulatorTopicQuery } from "../lib/simulators.ts";
import { assertSimulatorSessionSize, matchesSimulatorRequirement, normalizeFinalBlockDistribution, removeSubjectFromBlockDistribution, simulatorQuestionQuery, simulatorRequirements } from "../lib/final-exam-blocks.ts";
import { resolveFinalExamBlocks } from "../lib/final-exam-block-storage.ts";
import { drawTopicPractice, normalizedAcademicFormats, planTopicCoverage } from "../lib/academic-selection.ts";
import { resolveAcademicRequirements, validateAllSubjectCoverage } from "../lib/academic-selection-storage.ts";
import { buildOperatingOverview, isDemonstrationContent } from "../lib/operations.ts";
import { assertActiveAdministrator, PublicError } from "../lib/security.ts";

const context: BlockContext = { area: "complexive", subject: "Didáctica Ciencias Naturales", topic: "Tema 1", period: "2026-2027", title: "Tema 1 · bloque 1", format: "Selección directa", source: "Guía, Tema 1, p. 3", sourceResourceId: "", plan: "Bronce" };
function blockQuestions(prefix = "Pregunta") {
  return Array.from({ length: 20 }, (_, index): BlockQuestion => ({ prompt: `${prefix} ${index + 1}\nDatos y listas del ejercicio.`, options: ["Primera", "Segunda", "Tercera", "Cuarta"], correctIndex: index % 4, explanation: "Justificación académica de la respuesta.", source: "Guía, p. 3", format: QUESTION_FORMATS[index % 5], caseContext: index % 5 === 4 ? "Contexto real del aula.\nSegunda línea del caso." : "", shuffleOptions: true, importRow: index + 2 }));
}

type BoundStatement = { sql: string; values: SQLInputValue[] };
class TestDatabase {
  readonly sql = new DatabaseSync(":memory:");
  failAt = -1;
  beforeBatch: (() => void) | null = null;
  constructor() { this.sql.exec("CREATE TABLE records (id TEXT PRIMARY KEY,kind TEXT,title TEXT,status TEXT,data_json TEXT,created_by TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"); }
  prepare(sql: string) {
    const bound = (values: SQLInputValue[]) => ({ sql, values,
      bind: (...next: SQLInputValue[]) => bound(next),
      first: async <T>() => (this.sql.prepare(sql).get(...values) as T | undefined) || null,
      all: async <T>() => ({ results: this.sql.prepare(sql).all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(this.sql.prepare(sql).run(...values).changes) } }),
    });
    return bound([]);
  }
  async batch(statements: BoundStatement[]) {
    this.beforeBatch?.(); this.beforeBatch = null;
    this.sql.exec("BEGIN");
    try {
      const result = statements.map((statement, index) => {
        if (index === this.failAt) throw new Error("Simulated database write failure");
        if (statement.values.length > 100) throw new Error("D1 bound parameter limit exceeded");
        return { meta: { changes: Number(this.sql.prepare(statement.sql).run(...statement.values).changes) } };
      });
      this.sql.exec("COMMIT"); return result;
    } catch (error) { this.sql.exec("ROLLBACK"); throw error; }
  }
  binding() { return this as unknown as D1Database; }
  rows(kind = "question") { return this.sql.prepare("SELECT * FROM records WHERE kind=?").all(kind); }
}

test("parses quoted CSV, BOM, semicolons, escaped quotes and multiline cases", () => {
  const csv = '\uFEFFpregunta;opcion_a;opcion_b;opcion_c;opcion_d;correcta;explicacion;formato;contexto\r\n"¿Qué dice ""el caso""?";Uno;Dos;Tres;Cuatro;B;Explicación;Caso práctico;"Situación; con datos\nOtra línea"\r\n';
  const preview = previewQuestionBlock(tableQuestionInputs(parseQuestionTable(csv)), context);
  assert.equal(preview.invalid, 0); assert.equal(preview.questions[0].correctIndex, 1);
  assert.equal(preview.questions[0].prompt, '¿Qué dice "el caso"?');
  assert.equal(preview.questions[0].caseContext, "Situación; con datos\nOtra línea");
});

test("accepts pasted Excel TSV and comma CSV without losing fields", () => {
  for (const delimiter of ["\t", ","]) {
    const table = ["pregunta", "opcion_a", "opcion_b", "opcion_c", "opcion_d", "correcta", "explicacion"].join(delimiter) + "\n" + ["Pregunta", "Uno", "Dos", "Tres", "Cuatro", "4", "Explicación"].join(delimiter);
    const preview = previewQuestionBlock(tableQuestionInputs(parseQuestionTable(table)), context);
    assert.equal(preview.invalid, 0); assert.equal(preview.questions[0].correctIndex, 3);
  }
});

test("accepts numeric Excel alternatives without treating cells as missing text", () => {
  const inputs = tableQuestionInputs([["pregunta", "a", "b", "c", "d", "correcta", "explicacion"], ["¿Cuántos elementos hay?", 1, 2, 3, 4, 2, "Hay dos elementos."]]);
  const preview = previewQuestionBlock(inputs, context);
  assert.equal(preview.invalid, 0); assert.deepEqual(preview.questions[0].options, ["1", "2", "3", "4"]); assert.equal(preview.questions[0].correctIndex, 1);
});

test("rejects ambiguous headers, damaged quotes and extra populated columns", () => {
  assert.throws(() => parseQuestionTable('pregunta,opcion_a\n"sin cierre,Uno'), /comillas/);
  assert.throws(() => tableQuestionInputs([["pregunta", "enunciado"]]), /repetidas/);
  assert.throws(() => tableQuestionInputs([["materia"]]), /desconocidas/);
  assert.throws(() => tableQuestionInputs([["pregunta"]]), /Faltan/);
  const inputs = tableQuestionInputs([["pregunta", "a", "b", "c", "d", "correcta", "explicacion"], ["P", "1", "2", "3", "4", "A", "Exp", "extra"]]);
  assert.equal(previewQuestionBlock(inputs, context).invalid, 1);
});

test("validates all five formats together, context, keys and field limits in both areas", () => {
  for (const area of ["complexive", "final_degree"] as const) {
    const preview = previewQuestionBlock(blockQuestions(), { ...context, area });
    assert.equal(preview.questions.length, 20); assert.equal(preview.invalid, 0);
    assert.equal(new Set(preview.questions.map(question => question.format)).size, 5);
  }
  for (const bad of [
    { format: "Caso práctico", caseContext: "" }, { correctIndex: null }, { correctIndex: 4 },
    { prompt: "x".repeat(2001) }, { options: ["A", "A", "C", "D"] }, { format: "Ensayo" },
    { explanation: "" }, { source: "", options: ["A", "B", "C"] }, { shuffleOptions: "quizás" },
  ]) assert.equal(previewQuestionBlock([{ ...blockQuestions()[0], ...bad }], context).invalid, 1);
  assert.ok(previewQuestionBlock(Array.from({ length: 101 }, (_, i) => ({ ...blockQuestions()[0], prompt: String(i) })), context).errors.length);
  assert.equal(validateBlockContext({ ...context, period: "", area: "otro" }).context, null);
});

test("detects duplicate normalized prompts and keeps conflicting repeated rows invalid", () => {
  const question = blockQuestions()[0];
  const preview = previewQuestionBlock([question], context, [question.prompt.toUpperCase().replace(/\n/g, "   ")]);
  assert.equal(preview.duplicates, 1); assert.equal(preview.questions.length, 0);
  assert.equal(previewQuestionBlock([question, { ...question, options: ["Otro", "Dos", "Tres", "Cuatro"] }], context).invalid, 1);
});

test("allows the same analysis prompt for different cases, while rejecting repeated case context", async () => {
  const first = { ...blockQuestions()[4], prompt: "¿Cuál es la estrategia adecuada?", caseContext: "Una escuela rural analiza plantas." };
  const second = { ...first, caseContext: "Una escuela urbana analiza el consumo de agua." };
  assert.equal(previewQuestionBlock([first, second], context).questions.length, 2);
  assert.equal(previewQuestionBlock([first], context, [first]).duplicates, 1);
  const database = new TestDatabase();
  const saved = await saveQuestionBlock(database.binding(), context, [first, second], "teacher");
  assert.equal(saved.count, 2); assert.equal(database.rows().length, 2);
});

for (const fixture of ["questions-inline.xlsx", "questions-shared.xlsx"]) {
  test(`reads actual ${fixture} and preserves case, relation lists and correct keys`, async () => {
    const bytes = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url));
    assertSafeQuestionWorkbook(bytes);
    const grid = await readSheet(bytes);
    const preview = previewQuestionBlock(tableQuestionInputs(grid), context);
    assert.equal(preview.invalid, 0); assert.equal(preview.questions.length, 2);
    assert.equal(preview.questions[0].correctIndex, 1); assert.equal(preview.questions[0].shuffleOptions, false);
    assert.match(preview.questions[0].caseContext, /\n/); assert.match(preview.questions[1].prompt, /1\. Observación\n/);
  });
}

test("blocks invalid, encrypted, macro, embedded and oversized workbooks before parsing", async () => {
  assert.throws(() => assertSafeQuestionWorkbook(strToU8("not an xlsx")), /válido/);
  const base = { "[Content_Types].xml": strToU8("<Types/>"), "xl/workbook.xml": strToU8("<workbook/>") };
  for (const name of ["xl/vbaProject.bin", "xl/embeddings/item.bin", "xl/externalLinks/link.xml", "../escape.xml"]) {
    assert.throws(() => assertSafeQuestionWorkbook(zipSync({ ...base, [name]: strToU8("data") })), /permitido/);
  }
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/questions-inline.xlsx", import.meta.url)));
  const encrypted = bytes.slice(); new DataView(encrypted.buffer).setUint16(6, 1, true);
  assert.throws(() => assertSafeQuestionWorkbook(encrypted), /inválida|inconsistentes/);
  assert.throws(() => assertSafeQuestionWorkbook(zipSync({ ...base, "xl/large.xml": new Uint8Array(9 * 1024 * 1024) })), /8 MB/);
  assert.throws(() => assertSafeQuestionWorkbook(new Uint8Array(2 * 1024 * 1024 + 1)), /2 MB/);
});

test("validates actual inflated bytes even when the ZIP directory lies about size", () => {
  const bytes = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "xl/workbook.xml": strToU8("<workbook/>"), "xl/large.xml": new Uint8Array(9 * 1024 * 1024) });
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 10, true);
    if (view.getUint32(i, true) === 0x04034b50) view.setUint32(i + 22, 10, true);
  }
  assert.throws(() => assertSafeQuestionWorkbook(bytes), /8 MB|invalid|inválid|incompleto/);
});

test("reads UTF-8 and Excel UTF-16 tables and rejects unsupported or oversized files", async () => {
  assert.equal((await readQuestionBlockFile(new File(["pregunta\nCiencias"], "bloque.csv"))).text, "pregunta\nCiencias");
  const bytes = new Uint8Array([255, 254, 80, 0, 241, 0]);
  assert.equal((await readQuestionBlockFile(new File([bytes], "bloque.tsv"))).text, "Pñ");
  await assert.rejects(readQuestionBlockFile(new File(["texto"], "bloque.pdf")), /PDF válido/);
  await assert.rejects(readQuestionBlockFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "bloque.csv")), /2 MB/);
});

test("imports a 20-question mixed block atomically and retry does not create duplicates", async () => {
  const database = new TestDatabase();
  const result = await saveQuestionBlock(database.binding(), context, blockQuestions(), "teacher");
  assert.equal(result.count, 20); assert.equal(database.rows().length, 20); assert.equal(database.rows("question_block").length, 1);
  assert.ok(database.rows().every(row => row.status === "pending"));
  const retry = await saveQuestionBlock(database.binding(), { ...context, title: "Otro nombre" }, blockQuestions(), "teacher");
  assert.equal(retry.reused, true); assert.equal(retry.blockId, result.blockId); assert.equal(database.rows().length, 20);
});

test("rolls back the whole block if a database write fails", async () => {
  const database = new TestDatabase(); database.failAt = 2;
  await assert.rejects(saveQuestionBlock(database.binding(), context, [...blockQuestions("A"), ...blockQuestions("B"), ...blockQuestions("C")], "teacher"), /write failure/);
  assert.equal(database.rows().length, 0); assert.equal(database.rows("question_block").length, 0);
});

test("imports the maximum 100 questions within D1 parameter limits", async () => {
  const database = new TestDatabase();
  const questions = ["A", "B", "C", "D", "E"].flatMap(prefix => blockQuestions(prefix));
  const result = await saveQuestionBlock(database.binding(), context, questions, "teacher");
  assert.equal(result.count, 100); assert.equal(database.rows().length, 100);
});

test("rejects overlap with existing manual questions and detects a concurrent insertion", async () => {
  for (const concurrent of [false, true]) {
    const database = new TestDatabase(), question = blockQuestions()[0];
    const insert = () => database.sql.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'question','Manual','approved',?,'teacher')").run(concurrent ? "qimport_collision" : "manual", JSON.stringify({ ...question, area: context.area, subject: context.subject, period: context.period, topic: "Otro tema" }));
    if (concurrent) {
      // The deterministic ID must collide inside the transaction, after the initial read.
      const first = await saveQuestionBlock(database.binding(), context, [question], "teacher");
      const id = database.rows()[0].id as string;
      database.sql.exec("DELETE FROM records");
      database.beforeBatch = () => database.sql.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'question','Concurrent','approved',?,'teacher')").run(id, JSON.stringify({ ...question, area: context.area, subject: context.subject, period: context.period }));
      assert.equal(first.conflict, false);
    } else insert();
    const result = await saveQuestionBlock(database.binding(), context, blockQuestions(), "teacher");
    assert.equal(result.conflict, true); assert.equal(database.rows().length, 1); assert.equal(database.rows("question_block").length, 0);
  }
});

test("approves only a fully reviewed block with published source and no concurrent rewrite", async () => {
  const database = new TestDatabase();
  database.sql.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES ('source','resource','Material','draft','{}','teacher')").run();
  const result = await saveQuestionBlock(database.binding(), { ...context, sourceResourceId: "source" }, blockQuestions(), "teacher");
  assert.equal(await approveQuestionBlockRecords(database.binding(), result.blockId), false);
  assert.ok(database.rows().every(row => row.status === "pending"));
  database.sql.exec("UPDATE records SET status='published' WHERE id='source'");
  database.beforeBatch = () => { database.sql.prepare("UPDATE records SET status='rewrite' WHERE id=?").run(database.rows()[0].id as string); };
  assert.equal(await approveQuestionBlockRecords(database.binding(), result.blockId), false);
  assert.ok(database.rows().every(row => row.status !== "approved"));
  database.sql.exec("UPDATE records SET status='pending' WHERE kind='question'");
  assert.equal(await approveQuestionBlockRecords(database.binding(), result.blockId), true);
  assert.ok(database.rows().every(row => row.status === "approved"));
});

test("only active administrators can manage blocks or edit questions", () => {
  assert.doesNotThrow(() => assertActiveAdministrator("admin", "active"));
  for (const [role, status] of [["student", "active"], ["student", "invited"], ["admin", "suspended"]]) {
    assert.throws(() => assertActiveAdministrator(role, status), (error: unknown) => error instanceof PublicError && error.status === 403);
  }
});

test("approving all preserves a previous individual approval and never approves another block", async () => {
  for (const area of ["complexive", "final_degree"] as const) {
    const database = new TestDatabase(), scoped = { ...context, area };
    const first = await saveQuestionBlock(database.binding(), scoped, blockQuestions(), "teacher");
    const second = await saveQuestionBlock(database.binding(), { ...scoped, topic: "Tema 2" }, blockQuestions("Other"), "teacher");
    const individual = database.rows()[0];
    database.sql.prepare("UPDATE records SET status='approved',updated_at='2001-01-01' WHERE id=?").run(individual.id as string);
    assert.equal(await approveQuestionBlockRecords(database.binding(), first.blockId), true);
    const approved = database.rows().filter(row => JSON.parse(row.data_json as string).importBlockId === first.blockId);
    const untouched = database.rows().filter(row => JSON.parse(row.data_json as string).importBlockId === second.blockId);
    assert.equal(approved.length, 20); assert.ok(approved.every(row => row.status === "approved"));
    assert.equal(new Set(approved.map(row => JSON.parse(row.data_json as string).format)).size, 5);
    assert.ok(untouched.every(row => row.status === "pending"));
    const retained = approved.find(row => row.id === individual.id)!;
    assert.equal(retained.updated_at, "2001-01-01"); assert.equal(retained.data_json, individual.data_json);
  }
});

test("bulk approval stops if the parent block disappears or is archived, and rolls back an interrupted transaction", async () => {
  for (const change of ["archive", "remove", "fail"] as const) {
    const database = new TestDatabase();
    const block = await saveQuestionBlock(database.binding(), context, blockQuestions(), "teacher");
    if (change === "archive") database.beforeBatch = () => { database.sql.prepare("UPDATE records SET status='archived' WHERE id=?").run(block.blockId); };
    if (change === "remove") database.beforeBatch = () => { database.sql.prepare("DELETE FROM records WHERE id=?").run(block.blockId); };
    if (change === "fail") { database.failAt = 1; await assert.rejects(approveQuestionBlockRecords(database.binding(), block.blockId), /Simulated/); }
    else assert.equal(await approveQuestionBlockRecords(database.binding(), block.blockId), false);
    assert.ok(database.rows().every(row => row.status === "pending"));
  }
});

test("grades all five formats correctly after mixing options and keeps cases and keys private", () => {
  const questions = blockQuestions().map((question, i) => {
    const choices = prepareQuestionChoices(question, values => [...values].reverse()); assert.ok(choices);
    return { ...question, ...choices, questionId: "q" + i, subject: context.subject, topic: context.topic };
  });
  const visible = publicAttemptQuestions({ questions });
  assert.equal(visible.length, 20); assert.match(visible[4].caseContext!, /\n/);
  assert.ok(visible.every(question => !("correctIndex" in question) && !("explanation" in question)));
  const result = gradeSimulatorAttempt(questions, questions.map(question => ({ questionId: question.questionId, selectedIndex: question.correctIndex })), 14);
  assert.equal(result.ok, true); if (result.ok) { assert.equal(result.score, 20); assert.equal(result.correct, 20); }
});

test("preserves letter-dependent choices and explicit fixed order while updating the shuffled key", () => {
  for (const options of [["Uno", "Dos", "A y B", "Ninguna"], ["Uno", "Dos", "Tres", "Todas las anteriores"]]) {
    const choices = prepareQuestionChoices({ options, correctIndex: 2 }, values => [...values].reverse());
    assert.deepEqual(choices, { options, correctIndex: 2 });
  }
  const question = blockQuestions()[0];
  assert.deepEqual(prepareQuestionChoices({ ...question, shuffleOptions: false }, values => [...values].reverse()), { options: question.options, correctIndex: question.correctIndex });
  assert.equal(prepareQuestionChoices({ ...question, correctIndex: null }, values => values), null);
  assert.deepEqual(prepareQuestionChoices({ ...question, prompt: "Compara las opciones A y B." }, values => [...values].reverse()), { options: question.options, correctIndex: question.correctIndex });
});

test("topic selection filters the real SQL bank without mixing areas, periods or pending questions", async () => {
  const database = new TestDatabase();
  const first = await saveQuestionBlock(database.binding(), context, blockQuestions(), "teacher");
  const second = await saveQuestionBlock(database.binding(), { ...context, topic: "Tema 2" }, blockQuestions("Otro"), "teacher");
  await approveQuestionBlockRecords(database.binding(), first.blockId);
  await approveQuestionBlockRecords(database.binding(), second.blockId);
  await saveQuestionBlock(database.binding(), { ...context, area: "final_degree" }, blockQuestions("Carrera"), "teacher");
  const query = simulatorTopicQuery({ topics: ["Tema 1"] });
  const rows = database.sql.prepare("SELECT data_json FROM records WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.subject')=? AND json_extract(data_json,'$.period')=?" + query.sql).all(context.area, context.subject, context.period, ...query.values);
  assert.equal(rows.length, 20); assert.ok(rows.every(row => JSON.parse(row.data_json as string).topic === "Tema 1"));
  assert.equal(matchesSimulatorTopics({ topic: "Tema 2" }, { topics: ["Tema 1"] }), false);
  assert.equal(matchesSimulatorTopics({ topic: "Tema 2" }, { topics: [] }), true);
  const injection = simulatorTopicQuery({ topics: ["Tema 1') OR 1=1 --"] });
  assert.ok(!injection.sql.includes("OR")); assert.equal(injection.values.length, 1);
});


test("final blocks enforce explicit integer quotas, unique IDs and total limits", () => {
  const selected = normalizeFinalBlockDistribution([{ blockId: "one", count: 20 }, { blockId: "two", count: 1 }]);
  assert.equal(selected.reduce((sum, item) => sum + item.count, 0), 21);
  for (const value of [[], [{ blockId: "one", count: 0 }], [{ blockId: "one", count: 101 }], [{ blockId: "one", count: 1.5 }], [{ blockId: "one", count: 2 }, { blockId: "one", count: 2 }], [{ blockId: "one", count: 100 }, { blockId: "two", count: 100 }, { blockId: "three", count: 1 }], Array.from({ length: 31 }, (_, i) => ({ blockId: String(i), count: 1 }))]) assert.throws(() => normalizeFinalBlockDistribution(value));
});

test("block metadata comes from D1 and cannot cross an area, period or archived subject", async () => {
  const database = new TestDatabase();
  database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)").run("block-one", "question_block", "Tema 1", "pending", JSON.stringify(context));
  database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)").run("subject-one", "subject", context.subject, "published", JSON.stringify({ area: context.area, period: context.period }));
  database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)").run("historical-subject", "subject", context.subject, "archived", JSON.stringify({area:context.area,period:"2025-2026"}));
  const value = [{ blockId: "block-one", count: 20, subject: "spoofed", blockTitle: "spoofed" }];
  const selected = await resolveFinalExamBlocks(database.binding(), value, context.area, context.period, []);
  assert.equal(selected[0].subject, context.subject); assert.equal(selected[0].blockTitle, "Tema 1");
  await assert.rejects(resolveFinalExamBlocks(database.binding(), value, "final_degree", context.period, []), /área y periodo/);
  await assert.rejects(resolveFinalExamBlocks(database.binding(), value, context.area, "2025-2026", []), /área y periodo/);
  database.sql.exec("UPDATE records SET status='archived' WHERE kind='subject'");
  await assert.rejects(resolveFinalExamBlocks(database.binding(), value, context.area, context.period, []), /quitada/);
  database.sql.exec("UPDATE records SET status='archived' WHERE kind='question_block'");
  await assert.rejects(resolveFinalExamBlocks(database.binding(), value, context.area, context.period, []), /disponible/);
});

test("the actual final query draws approved questions only from selected blocks and quotas", async () => {
  const database = new TestDatabase();
  const insert = database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)");
  for (const [block, subject] of [["one", context.subject], ["two", "Otra materia"], ["excluded", context.subject]]) {
    for (let i = 0; i < 20; i++) insert.run(`${block}-${i}`, "question", "Question", "approved", JSON.stringify({ ...context, subject, importBlockId: block, ...blockQuestions()[i] }));
  }
  insert.run("pending", "question", "Question", "pending", JSON.stringify({ ...context, importBlockId: "one" }));
  insert.run("history", "question", "Question", "approved", JSON.stringify({ ...context, period: "2025-2026", importBlockId: "one" }));
  insert.run("other-area", "question", "Question", "approved", JSON.stringify({ ...context, area: "final_degree", importBlockId: "one" }));
  const config = { ...context, mode: "final", selectionMode: "blocks", topics: ["Ignored topic"], blockDistribution: [{ blockId: "one", subject: context.subject, blockTitle: "Tema 1", count: 10 }, { blockId: "two", subject: "Otra materia", blockTitle: "Tema 2", count: 5 }] };
  const selected: { id: string; data_json: string }[] = [];
  for (const requirement of simulatorRequirements(config)) {
    const query = simulatorQuestionQuery(config, requirement);
    const count = database.sql.prepare("SELECT COUNT(*) AS total FROM records WHERE " + query.sql).get(...query.values) as { total: number };
    assert.equal(count.total, 20);
    const rows = database.sql.prepare("SELECT id,data_json FROM records WHERE " + query.sql + " ORDER BY RANDOM() LIMIT ?").all(...query.values, requirement.count) as { id: string; data_json: string }[];
    assert.equal(rows.length, requirement.count);
    rows.forEach(row => assert.equal(matchesSimulatorRequirement(JSON.parse(row.data_json), config, requirement), true));
    selected.push(...rows);
  }
  assert.equal(selected.length, 15); assert.equal(new Set(selected.map(row => row.id)).size, 15);
  assert.ok(selected.every(row => /^(one|two)-/.test(row.id)));
  const snapshots = selected.map(row => ({ questionId: row.id, ...JSON.parse(row.data_json), ...prepareQuestionChoices(JSON.parse(row.data_json), values => [...values].reverse()) }));
  assert.ok(publicAttemptQuestions({ questions: snapshots }).every(question => !("correctIndex" in question)));
  const graded = gradeSimulatorAttempt(snapshots, snapshots.map(question => ({ questionId: question.questionId, selectedIndex: question.correctIndex })), 14);
  assert.equal(graded.ok, true); if (graded.ok) assert.equal(graded.score, 20);
  database.sql.exec("UPDATE records SET status='pending' WHERE id LIKE 'one-%'");
  const query = simulatorQuestionQuery(config, simulatorRequirements(config)[0]);
  assert.equal((database.sql.prepare("SELECT COUNT(*) AS total FROM records WHERE " + query.sql).get(...query.values) as { total: number }).total, 0);
});

test("subject removal adjusts only selected blocks and long exam sessions are bounded", () => {
  const value = [{ blockId: "a", subject: context.subject, count: 10 }, { blockId: "b", subject: "Otra materia", count: 5 }];
  const result = removeSubjectFromBlockDistribution(value, context.subject.toLocaleUpperCase("es"));
  assert.equal(result.entries.length, 1); assert.equal(result.count, 5);
  assertSimulatorSessionSize({ questions: blockQuestions() });
  assert.throws(() => assertSimulatorSessionSize({ questions: "x".repeat(1_500_001) }), /demasiado texto/);
});


test("topic practice draws only the requested area, matter, period and format without repeats", () => {
  const rows = blockQuestions().map((question, index) => ({ id: String(index), status: "approved", data: { ...context, ...question } }));
  const filter = { area: context.area, subject: context.subject, period: context.period, topic: context.topic, format: "Completar" };
  const selected = drawTopicPractice([...rows, rows[1], { ...rows[1], id: "wrong-area", data: { ...rows[1].data, area: "final_degree" } }, { ...rows[1], id: "wrong-period", data: { ...rows[1].data, period: "2025-2026" } }, { ...rows[1], id: "pending", status: "pending" }], filter, 3, values => [...values].reverse());
  assert.equal(selected.length, 3); assert.equal(new Set(selected.map(row => row.id)).size, 3);
  assert.ok(selected.every(row => row.data.format === "Completar" && !row.id.includes("wrong") && row.id !== "pending"));
  assert.throws(() => drawTopicPractice(rows, filter, 5, values => values), /Hay 4/);
  assert.throws(() => drawTopicPractice(rows, filter, 1.5, values => values), /1 y 100/);
  assert.throws(() => normalizedAcademicFormats(["ensayo"]), /formatos válidos/);
});

test("balanced subject simulators represent every topic with exact quotas and bank capacity", () => {
  const data = { ...context, subject: context.subject, count: 20 };
  const result = planTopicCoverage(data, Array.from({ length: 5 }, (_, index) => ({ topic: `Tema ${index + 1}`, count: 20 })));
  assert.deepEqual(result.map(item => item.count), [4, 4, 4, 4, 4]);
  assert.equal(result.reduce((sum, item) => sum + item.count, 0), 20);
  const limited = planTopicCoverage({ ...data, count: 10 }, [{ topic: "A", count: 1 }, { topic: "B", count: 20 }, { topic: "C", count: 20 }]);
  assert.deepEqual(limited.map(item => item.count), [1, 5, 4]);
  assert.throws(() => planTopicCoverage({ ...data, count: 5 }, Array.from({ length: 6 }, (_, i) => ({ topic: String(i), count: 3 }))), /al menos 6/);
  assert.throws(() => planTopicCoverage({ ...data, topics: ["A", "Missing"] }, [{ topic: "A", count: 40 }]), /Missing/);
  assert.throws(() => planTopicCoverage(data, [{ topic: "A", count: 1 }]), /20 preguntas aprobadas/);
});

test("SQL topic planning respects chosen formats, and each actual draw matches the plan", async () => {
  const database = new TestDatabase(), insert = database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)");
  for (let topic = 1; topic <= 5; topic++) for (let i = 0; i < 6; i++) insert.run(`topic-${topic}-${i}`, "question", "Question", "approved", JSON.stringify({ ...context, ...blockQuestions()[i], topic: `Tema ${topic}`, format: i < 4 ? "Completar" : "Ordenar" }));
  insert.run("wrong-period", "question", "Question", "approved", JSON.stringify({ ...context, topic: "Wrong", format: "Completar", period: "2025-2026" }));
  insert.run("not-approved", "question", "Question", "pending", JSON.stringify({ ...context, topic: "Wrong", format: "Completar" }));
  const data = { ...context, mode: "subject", topicCoverage: "balanced", count: 20, formats: ["Completar"] };
  const requirements = await resolveAcademicRequirements(database.binding(), data);
  assert.equal(requirements.length, 5);
  const ids = new Set<string>();
  for (const requirement of requirements) {
    assert.equal(requirement.count, 4);
    const query = simulatorQuestionQuery(data, requirement);
    const rows = database.sql.prepare("SELECT id,data_json FROM records WHERE " + query.sql + " ORDER BY RANDOM() LIMIT ?").all(...query.values, requirement.count) as { id: string; data_json: string }[];
    assert.equal(rows.length, 4); rows.forEach(row => { ids.add(row.id); assert.equal(matchesSimulatorRequirement(JSON.parse(row.data_json), data, requirement), true); });
  }
  assert.equal(ids.size, 20);
  await assert.rejects(resolveAcademicRequirements(database.binding(), { ...data, count: 25 }), /25 preguntas aprobadas/);
});

test("complete finals require all active matters, including block and mixed-format selections", async () => {
  const database = new TestDatabase(), insert = database.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES (?,?,?,?,?)");
  for (const subject of ["Ciencias", "Lengua", "Quitada"]) insert.run(subject, "subject", subject, subject === "Quitada" ? "archived" : "published", JSON.stringify({ area: "complexive", period: context.period }));
  insert.run("history-catalog", "subject", "Solo histórico", "published", JSON.stringify({area:"complexive",period:"2025-2026"}));
  const data = { mode: "final", area: "complexive", period: context.period, coverAllSubjects: true, distribution: [{ subject: "Ciencias", count: 5 }] };
  await assert.rejects(validateAllSubjectCoverage(database.binding(), data, []), /Lengua/);
  await validateAllSubjectCoverage(database.binding(), { ...data, distribution: [...data.distribution, { subject: "Lengua", count: 5 }] }, []);
  await validateAllSubjectCoverage(database.binding(), { ...data, coverAllSubjects: false }, []);
  await assert.rejects(validateAllSubjectCoverage(database.binding(), { ...data, selectionMode: "blocks", blockDistribution: [{ blockId: "one", subject: "Ciencias", count: 5 }] }, []), /Lengua/);
  await validateAllSubjectCoverage(database.binding(), { ...data, selectionMode: "blocks", blockDistribution: [{ blockId: "one", subject: "Ciencias", count: 5 }, { blockId: "two", subject: "Lengua", count: 5 }], formats: ["Completar", "Ordenar"] }, []);
});


test("operating readiness follows new topic and format constraints and excludes template examples", () => {
  const material = { id: "material", kind: "resource", title: "Guía académica", status: "published", data: { ...context, fileKey: "materials/shared/guide.pdf" } };
  const questions = Array.from({ length: 20 }, (_, index) => ({ id: `q-${index}`, kind: "question", title: "Pregunta académica", status: "approved", data: { ...context, ...blockQuestions()[index], topic: `Tema ${index % 5 + 1}`, format: "Completar" } }));
  const simulator = { id: "sim", kind: "simulator", title: "Ciencias", status: "published", data: { ...context, mode: "subject", count: 20, topicCoverage: "balanced", formats: ["Completar"] } };
  const overview = (sim: typeof simulator) => buildOperatingOverview([material, ...questions, sim], [], "complexive", context.period, [context.subject]).subjects[0];
  assert.equal(overview(simulator).ready, true);
  assert.equal(overview({ ...simulator, data: { ...simulator.data, formats: ["Ordenar"] } }).ready, false);
  assert.equal(overview({ ...simulator, data: { ...simulator.data, count: 30 } }).ready, false);
  assert.equal(isDemonstrationContent({ ...questions[0], data: { ...questions[0].data, prompt: "Ejemplo 1: Contenido guía", source: "Reemplaza por tu material, página o sección." } }), true);
});
