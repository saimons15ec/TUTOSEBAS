import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { AcademicTopicError, academicScope, buildAcademicTopics, normalizedTopicDefinition, topicMatches, type TopicRecord } from "../lib/academic-topics.ts";
import { resolveAcademicTopic, saveAcademicTopic, synchronizeAcademicTopics } from "../lib/academic-topics-storage.ts";
import { drawTopicPractice } from "../lib/academic-selection.ts";
import { resolveAcademicRequirements } from "../lib/academic-selection-storage.ts";
import { simulatorQuestionQuery } from "../lib/final-exam-blocks.ts";
import { saveQuestionBlock } from "../lib/question-block-storage.ts";
import { QUESTION_FORMATS, type BlockContext, type BlockQuestion } from "../lib/question-blocks.ts";
import { isDemonstrationContent } from "../lib/operations.ts";

const scope = { area: "complexive" as const, subject: "Ciencias naturales", period: "2026-2027" };
class TopicsDatabase {
  sql = new DatabaseSync(":memory:");
  failAt = -1;
  beforeBatch: (() => void) | null = null;
  constructor() { this.sql.exec("CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,title TEXT,status TEXT,data_json TEXT,created_by TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"); }
  prepare(query: string) {
    const values: SQLInputValue[] = [];
    return { ...this.statement(query, values), bind: (...input: SQLInputValue[]) => { values.push(...input); return this.statement(query, values); } };
  }
  statement(query: string, values: SQLInputValue[]) {
    return { query, values, first: async () => this.sql.prepare(query).get(...values) || null, all: async () => ({ results: this.sql.prepare(query).all(...values) }), run: async () => ({ meta: { changes: Number(this.sql.prepare(query).run(...values).changes) } }) };
  }
  async batch(statements: { query: string; values: SQLInputValue[] }[]) {
    this.beforeBatch?.(); this.beforeBatch = null;
    this.sql.exec("BEGIN");
    try { const results = statements.map((statement, i) => { if (i === this.failAt) throw new Error("Simulated write failure"); assert.ok(statement.values.length <= 100); return { meta: { changes: Number(this.sql.prepare(statement.query).run(...statement.values).changes) } }; }); this.sql.exec("COMMIT"); return results; }
    catch (error) { this.sql.exec("ROLLBACK"); throw error; }
  }
  binding() { return this as unknown as D1Database; }
  add(id: string, kind: string, data: Record<string, unknown>, status = "published", title = id) { this.sql.prepare("INSERT INTO records(id,kind,title,status,data_json,created_by) VALUES(?,?,?,?,?,'admin')").run(id, kind, title, status, JSON.stringify(data)); }
  data(id: string) { return JSON.parse(this.sql.prepare("SELECT data_json FROM records WHERE id=?").get(id)!.data_json as string) as Record<string, unknown>; }
  records(): TopicRecord[] { return this.sql.prepare("SELECT * FROM records").all().map(row => ({ id: row.id as string, kind: row.kind as string, title: row.title as string, status: row.status as string, data: JSON.parse(row.data_json as string) })); }
}

test("catalog orders numbered topics naturally and shares materials/questions while keeping scope boundaries", () => {
  const content = [
    { id: "a", kind: "resource", title: "Audio", status: "published", data: { ...scope, topic: "Tema 10 · Ecosistemas" } },
    { id: "b", kind: "question", title: "Pregunta", status: "approved", data: { ...scope, topic: "Tema 2 · Plantas" } },
    { id: "c", kind: "resource", title: "Otro periodo", status: "published", data: { ...scope, topic: "Tema 1", period: "2025-2026" } },
    { id: "d", kind: "question", title: "Otra área", status: "approved", data: { ...scope, topic: "Tema 1", area: "final_degree" } },
  ];
  const topics = buildAcademicTopics([], content, scope);
  assert.deepEqual(topics.map(topic => topic.number), [2, 10]);
  assert.equal(topicMatches(content[1].data, topics[0]), true);
  assert.equal(topicMatches({ ...content[1].data, topicId: "foreign" }, topics[0]), false);
  assert.equal(topicMatches(content[2].data, topics[0]), false);
});

test("rejects malformed scopes, invalid order and oversized topic names", () => {
  for (const input of [{ ...scope, area: "resources" }, { ...scope, subject: "" }, { ...scope, period: "" }]) assert.throws(() => academicScope(input), AcademicTopicError);
  for (const number of [0, 1000, 1.5, "1"]) assert.throws(() => normalizedTopicDefinition(number, "Plantas"), AcademicTopicError);
  assert.throws(() => normalizedTopicDefinition(1, "x".repeat(151)), AcademicTopicError);
});

test("creates stable topic IDs, rejects duplicate numbers and cannot reuse a foreign or archived ID", async () => {
  const database = new TopicsDatabase();
  const first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  assert.equal(first.topic.title, "Tema 1 · Plantas");
  assert.equal((await resolveAcademicTopic(database.binding(), scope, { topicId: first.topic.id, topic: "Forged label" }, "admin")).title, first.topic.title);
  await assert.rejects(saveAcademicTopic(database.binding(), scope, { number: 1, name: "Animales" }, "admin"), /ya existe/);
  await assert.rejects(resolveAcademicTopic(database.binding(), { ...scope, subject: "Lengua" }, { topicId: first.topic.id }, "admin"), /misma materia/);
  await assert.rejects(resolveAcademicTopic(database.binding(), { ...scope, period: "2025-2026" }, { topicId: first.topic.id }, "admin"), /misma materia/);
  database.sql.prepare("UPDATE records SET status='archived' WHERE id=?").run(first.topic.id);
  await assert.rejects(resolveAcademicTopic(database.binding(), scope, { topicId: first.topic.id }, "admin"), /estar activo/);
});

test("organizes legacy materials and blocks idempotently without modifying files, keys or attempt snapshots", async () => {
  const database = new TopicsDatabase();
  database.add("audio", "resource", { ...scope, topic: "Tema 10 · Ecosistemas", fileKey: "private-audio", materialType: "Audio" });
  database.add("question", "question", { ...scope, topic: "  tema 10 · Ecosistemas  ", correctIndex: 2, options: ["a", "b", "c", "d"] }, "approved");
  database.add("block", "question_block", { ...scope, topic: "Tema 2 · Plantas", questionCount: 20 }, "pending");
  database.add("sim", "simulator", { ...scope, topics: ["Tema 10 · Ecosistemas", "Tema 2 · Plantas"], count: 20 });
  const snapshot = { ...scope, topic: "Tema 10 · Ecosistemas", questions: [{ correctIndex: 2, sourceMaterialTopic: "Tema 10 · Ecosistemas" }] };
  database.add("attempt", "attempt", snapshot, "finished");
  database.add("old", "resource", { ...scope, topic: "Tema 1 · Histórico", period: "2025-2026", fileKey: "historical" });
  database.add("archived", "question", { ...scope, topic: "Tema 1 · Archivado" }, "archived");
  const result = await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.equal(result.created, 2); assert.equal(database.data("audio").topicId, database.data("question").topicId);
  assert.equal(database.data("audio").fileKey, "private-audio"); assert.equal(database.data("question").correctIndex, 2);
  assert.deepEqual(database.data("attempt"), snapshot); assert.equal(database.data("old").topicId, undefined); assert.equal(database.data("archived").topicId, undefined);
  const again = await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.equal(again.created, 0); assert.equal(again.updated, 0);
  assert.deepEqual(buildAcademicTopics(database.records(), database.records(), scope).map(topic => topic.number), [2, 10]);
});

test("duplicate legacy topic numbers remain separate and request review rather than silently merging", async () => {
  const database = new TopicsDatabase();
  database.add("one", "resource", { ...scope, topic: "Tema 1 · Plantas" });
  database.add("two", "question", { ...scope, topic: "Tema 1 · Animales" }, "approved");
  const result = await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.equal(result.review, 1); assert.notEqual(database.data("one").topicId, database.data("two").topicId);
  assert.equal(database.records().filter(row => row.kind === "topic").length, 2);
});

test("renaming/reordering a theme preserves its ID and updates materials, block and simulator scope together", async () => {
  const database = new TopicsDatabase();
  const first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  database.add("material", "resource", { ...scope, topicId: first.topic.id, topic: first.topic.title, fileKey: "safe-file" });
  database.add("question", "question", { ...scope, topicId: first.topic.id, topic: first.topic.title, correctIndex: 1 }, "approved");
  database.add("block", "question_block", { ...scope, topicId: first.topic.id, topic: first.topic.title }, "pending");
  database.add("sim", "simulator", { ...scope, topics: [first.topic.title], formats: ["Completar"], count: 20 });
  database.add("attempt", "attempt", { ...scope, questions: [{ topic: first.topic.title }] }, "finished");
  const result = await saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 3, name: "Seres vivos" }, "admin");
  assert.equal(result.topic.id, first.topic.id); assert.equal(result.updated, 4);
  for (const id of ["material", "question", "block"]) { assert.equal(database.data(id).topic, "Tema 3 · Seres vivos"); assert.equal(database.data(id).topicId, first.topic.id); }
  assert.deepEqual(database.data("sim").topics, ["Tema 3 · Seres vivos"]); assert.deepEqual(database.data("sim").formats, ["Completar"]);
  assert.deepEqual(database.data("attempt").questions, [{ topic: first.topic.title }]); assert.equal(database.data("material").fileKey, "safe-file");
  assert.equal((await resolveAcademicTopic(database.binding(), scope, { topic: first.topic.title }, "admin")).id, first.topic.id);
});

test("a failed rename transaction rolls back catalog and content together", async () => {
  const database = new TopicsDatabase(), first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  database.add("question", "question", { ...scope, topicId: first.topic.id, topic: first.topic.title }, "approved");
  database.failAt = 1;
  await assert.rejects(saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 2, name: "Animales" }, "admin"), /Simulated/);
  assert.equal(database.data("question").topic, first.topic.title); assert.equal(database.data(first.topic.id).number, 1);
});

test("a concurrent topic edit cannot overwrite the new catalog or move its questions", async () => {
  const database = new TopicsDatabase(), first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  database.add("question", "question", { ...scope, topicId: first.topic.id, topic: first.topic.title }, "approved");
  database.beforeBatch = () => database.sql.prepare("UPDATE records SET title='Tema 4 · Concurrente',data_json=json_set(data_json,'$.number',4,'$.name','Concurrente') WHERE id=?").run(first.topic.id);
  await assert.rejects(saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 2, name: "Animales" }, "admin"), /catálogo cambió/);
  assert.equal(database.data(first.topic.id).number, 4); assert.equal(database.data("question").topic, first.topic.title);
});

test("organizing or renaming a theme preserves independent concurrent changes to a material", async () => {
  const database = new TopicsDatabase(), first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  database.add("material", "resource", { ...scope, topicId: first.topic.id, topic: first.topic.title, description: "Before" });
  database.beforeBatch = () => database.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.description','Concurrent description') WHERE id='material'").run();
  await saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 2, name: "Animales" }, "admin");
  assert.equal(database.data("material").description, "Concurrent description"); assert.equal(database.data("material").topic, "Tema 2 · Animales");
});

test("mixed blocks keep their topic and retry identity after renaming while practice respects topic IDs", async () => {
  const database = new TopicsDatabase(), first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  const questions: BlockQuestion[] = Array.from({ length: 20 }, (_, i) => ({ prompt: `Pregunta ${i}`, options: ["Uno", "Dos", "Tres", "Cuatro"], correctIndex: i % 4, explanation: "Explicación", source: "Fuente académica", format: QUESTION_FORMATS[i % 5], caseContext: i % 5 === 4 ? "Caso de ciencias" : "", shuffleOptions: true, importRow: i + 1 }));
  const context: BlockContext = { ...scope, topic: first.topic.title, topicId: first.topic.id, title: "Bloque mixto", format: "Selección directa", source: "Fuente", sourceResourceId: "", plan: "Bronce" };
  const imported = await saveQuestionBlock(database.binding(), context, questions, "admin");
  database.sql.prepare("UPDATE records SET status='approved' WHERE kind='question'").run();
  const renamed = await saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 2, name: "Seres vivos" }, "admin");
  const repeated = await saveQuestionBlock(database.binding(), { ...context, topic: renamed.topic.title }, questions, "admin");
  assert.equal(repeated.blockId, imported.blockId); assert.equal(repeated.reused, true);
  database.add("other", "question", { ...scope, topicId: "other-topic", topic: renamed.topic.title, format: "Completar" }, "approved");
  const draw = drawTopicPractice(database.records().filter(row => row.kind === "question"), { ...scope, topic: renamed.topic.title, topicId: first.topic.id, format: "Completar" }, 4, rows => rows);
  assert.equal(draw.length, 4); assert.ok(draw.every(row => row.data.topicId === first.topic.id));
  await assert.rejects(resolveAcademicTopic(database.binding(), scope, { topicId: "unknown" }, "admin"), AcademicTopicError);
});

test("renamed topic filters still drive actual balanced simulator SQL with exact approved counts", async () => {
  const database = new TopicsDatabase(), first = await saveAcademicTopic(database.binding(), scope, { number: 1, name: "Plantas" }, "admin");
  for (let i = 0; i < 6; i++) database.add(`q${i}`, "question", { ...scope, topicId: first.topic.id, topic: first.topic.title, format: "Completar" }, "approved");
  database.add("sim", "simulator", { ...scope, mode: "subject", count: 5, topics: [first.topic.title], topicCoverage: "balanced", formats: ["Completar"] });
  await saveAcademicTopic(database.binding(), scope, { id: first.topic.id, number: 2, name: "Animales" }, "admin");
  const requirements = await resolveAcademicRequirements(database.binding(), database.data("sim"));
  const query = simulatorQuestionQuery(database.data("sim"), requirements[0]);
  const draw = database.sql.prepare("SELECT id FROM records WHERE " + query.sql + " LIMIT ?").all(...query.values, requirements[0].count);
  assert.equal(draw.length, 5); assert.equal(requirements[0].topic, "Tema 2 · Animales");
});

test("archived matters cannot be revived by automatic legacy topic organization", async () => {
  const database = new TopicsDatabase();
  database.add("subject", "subject", { ...scope }, "archived", scope.subject);
  database.add("resource", "resource", { ...scope, topic: "Tema 1 · Plantas" });
  const result = await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.equal(result.created, 0); assert.equal(database.data("resource").topicId, undefined);
});

test("legacy organization converts every selected simulator topic in one pass", async () => {
  const database = new TopicsDatabase();
  database.add("plants", "resource", { ...scope, topic: "Unidad 1: Plantas" });
  database.add("animals", "question", { ...scope, topic: "Unidad 2: Animales" }, "approved");
  database.add("sim", "simulator", { ...scope, topics: ["Unidad 1: Plantas", "Unidad 2: Animales"], formats: ["Completar", "Ordenar"] });
  await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.deepEqual(database.data("sim").topics, ["Tema 1 · Plantas", "Tema 2 · Animales"]);
  assert.deepEqual(database.data("sim").formats, ["Completar", "Ordenar"]);
  assert.equal((await synchronizeAcademicTopics(database.binding(), scope.period, "admin")).updated, 0);
});

test("ambiguous numbering cannot merge a legacy topic into a newly generated title", async () => {
  const database = new TopicsDatabase();
  database.add("a", "resource", { ...scope, topic: "Tema 1 · Animales" });
  database.add("b", "resource", { ...scope, topic: "Tema 1 · Plantas" });
  database.add("c", "question", { ...scope, topic: "Tema 2 · Plantas" }, "approved");
  await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  assert.equal(new Set([database.data("a").topicId, database.data("b").topicId, database.data("c").topicId]).size, 3);
  assert.equal(database.data("b").topic, "Tema 3 · Plantas"); assert.equal(database.data("c").topic, "Tema 2 · Plantas");
});

test("topic numbering keeps technical samples excluded without classifying academic exam topics as samples", async () => {
  const database = new TopicsDatabase();
  database.add("sample", "question", { ...scope, topic: "Prueba funcional · Simulador protegido", source: "Referencia técnica" }, "approved", "Comprobación técnica");
  database.add("sample-material", "resource", { ...scope, topic: "Tema de prueba", fileKey: "technical" }, "published", "Comprobación de carga");
  database.add("real", "question", { ...scope, topic: "Pruebas de germinación", source: "Manual académico" }, "approved", "Comparar semillas");
  await synchronizeAcademicTopics(database.binding(), scope.period, "admin");
  const records = database.records();
  assert.equal(isDemonstrationContent(records.find(row => row.id === "sample")!), true);
  assert.equal(isDemonstrationContent(records.find(row => row.id === "sample-material")!), true);
  assert.equal(isDemonstrationContent(records.find(row => row.id === "real")!), false);
});
