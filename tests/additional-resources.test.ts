import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { additionalResourceCatalog, filterAdditionalResources, normalizedAdditionalResource, resourceCategory, resourceInCurrentPeriod, type AdditionalResourceRow } from "../lib/additional-resources.ts";
import { setAdditionalResourceReference, updateAdditionalResource } from "../lib/additional-resources-storage.ts";

const period = "2026-2027", teacher = { role: "admin", status: "active" };
const row = (id: string, data: Record<string, unknown>, kind = "resource", status = "published"): AdditionalResourceRow => ({ id, kind, title: id, status, data });
class LibraryDatabase {
  sql = new DatabaseSync(":memory:");
  beforeWrite: (() => void) | null = null;
  constructor() { this.sql.exec("CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,title TEXT,status TEXT,data_json TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"); }
  prepare(query: string) { return { bind: (...values: SQLInputValue[]) => ({ first: async () => this.sql.prepare(query).get(...values) || null, all: async () => ({ results: this.sql.prepare(query).all(...values) }), run: async () => { this.beforeWrite?.(); this.beforeWrite = null; return { meta: { changes: Number(this.sql.prepare(query).run(...values).changes) } }; } }) }; }
  binding() { return this as unknown as D1Database; }
  add(item: AdditionalResourceRow) { this.sql.prepare("INSERT INTO records(id,kind,title,status,data_json) VALUES(?,?,?,?,?)").run(item.id, item.kind, item.title, item.status, JSON.stringify(item.data)); }
  record(id: string): AdditionalResourceRow { const found = this.sql.prepare("SELECT * FROM records WHERE id=?").get(id)!; return { id, kind: String(found.kind), title: String(found.title), status: String(found.status), data: JSON.parse(String(found.data_json)) }; }
}

test("one category catalog keeps legacy support and removes accidental academic duplicates", () => {
  const academic = row("plants", { area: "complexive", subject: "Ciencias", topic: "Tema 1", period });
  const rows = [row("curriculum", { area: "resources", category: "curriculum", period }), row("apa", { area: "resources", category: "apa", period }), row("guide", { area: "resources", category: "unknown", period }), row("course", { lessons: 3 }, "course"), academic, row("question", { ...academic.data, additionalCategory: "apa" }, "question"), row("history", { area: "resources", period: "2025-2026" }), row("archived", { area: "resources", period }, "resource", "archived")];
  assert.deepEqual(additionalResourceCatalog(rows, period).map(item => item.id), ["curriculum", "apa", "guide", "course"]);
  assert.equal(resourceCategory(academic), null);
  const referenced = { ...academic, data: { ...academic.data, additionalCategory: "other" } };
  assert.equal(additionalResourceCatalog([referenced, referenced], period).length, 1);
  assert.equal(resourceCategory(rows[3]), "courses");
  assert.equal(additionalResourceCatalog(rows, period, true).at(-1)?.id, "archived");
});

test("search works by subject, topic and accented titles together with material type", () => {
  const rows = [{ ...row("info", { area: "resources", category: "curriculum", subject: "Ciencias naturales", topic: "Tema 2", materialType: "Infografía" }), title: "Currículo y plantas" }, row("audio", { area: "resources", category: "other", subject: "Ciencias naturales", materialType: "Audio" })];
  assert.equal(filterAdditionalResources(rows, "curriculo", "Infografía").length, 1);
  assert.equal(filterAdditionalResources(rows, "Tema 2", "").length, 1);
  assert.equal(filterAdditionalResources(rows, "ciencias", "Audio")[0].id, "audio");
});

test("new resources use explicit categories, safe links and server period without injected privileges", () => {
  const resource = normalizedAdditionalResource("resource", { category: "apa", plan: "Plata", materialType: "Documento", description: "Guía", externalUrl: "https://example.edu/apa", period: "2025-2026", additionalCategory: "courses", correctIndex: 2, permissions: ["all"], area: "complexive" }, period);
  assert.equal(resource.period, period); assert.equal(resource.area, "resources"); assert.equal(resource.category, "apa");
  for (const field of ["permissions", "correctIndex", "additionalCategory", "topicId"]) assert.equal(field in resource, false);
  for (const input of [{ category: "invalid" }, { plan: "Sin plan" }, { materialType: "Executable" }, { externalUrl: "javascript:alert(1)" }, { externalUrl: "data:text/html,test" }, { externalUrl: "https://user:password@example.edu/" }, { materialType: "Video" }, { materialType: "Audio" }, { materialType: "Audio", fileKey: "materials/shared/guide.pdf" }]) assert.throws(() => normalizedAdditionalResource("resource", input, period));
  assert.equal(normalizedAdditionalResource("resource", { materialType: "Audio", fileKey: "materials/shared/voice.mp3" }, period).materialType, "Audio");
  assert.equal(normalizedAdditionalResource("course", { category: "apa", lessons: 30, minutes: 600 }, period).lessons, 0);
  assert.equal(normalizedAdditionalResource("course", {}, period).category, "courses");
});

test("references preserve material, files, publication, plan, source questions and finished attempts", async () => {
  const database = new LibraryDatabase(), academic = row("material", { area: "complexive", subject: "Ciencias", topic: "Tema 1 · Plantas", topicId: "topic1", period, plan: "Gold", fileKey: "materials/shared/voice.mp3", materialType: "Audio" });
  database.add(academic); database.add(row("question", { sourceResourceId: "material", correctIndex: 2 }, "question", "approved")); database.add(row("attempt", { questions: [{ sourceResourceId: "material" }] }, "attempt", "finished"));
  const question = database.record("question"), attempt = database.record("attempt");
  await setAdditionalResourceReference(database.binding(), "material", "apa", period, teacher);
  assert.deepEqual(database.record("material"), { ...academic, data: { ...academic.data, additionalCategory: "apa" } });
  await setAdditionalResourceReference(database.binding(), "material", "other", period, teacher);
  assert.equal(resourceCategory(database.record("material")), "other");
  await setAdditionalResourceReference(database.binding(), "material", null, period, teacher);
  assert.deepEqual(database.record("material"), academic);
  assert.deepEqual(database.record("question"), question); assert.deepEqual(database.record("attempt"), attempt);
  assert.equal(database.sql.prepare("SELECT COUNT(*) AS total FROM records").get()!.total, 3);
});

test("edits return support resources to draft and preserve immutable attachments, scope and course state", async () => {
  const database = new LibraryDatabase(), initial = row("course", { area: "resources", category: "courses", period, plan: "Gold", lessons: 4, minutes: 60, fileKey: "materials/shared/guide.pdf", externalUrl: "https://example.edu/course" }, "course");
  database.add(initial);
  await updateAdditionalResource(database.binding(), "course", "Curso revisado", { description: "Nueva descripción", category: "apa", plan: "Plata", period: "2025-2026", fileKey: "bad", lessons: 0, area: "complexive" }, teacher);
  const updated = database.record("course");
  assert.equal(updated.status, "draft"); assert.equal(updated.title, "Curso revisado"); assert.equal(updated.data.description, "Nueva descripción");
  for (const key of ["area", "category", "period", "lessons", "minutes", "fileKey", "externalUrl"]) assert.equal(updated.data[key], initial.data[key]);
  assert.equal(updated.data.plan, "Plata");
});

test("student and suspended administrator writes are denied before touching the database", async () => {
  const database = new LibraryDatabase();
  for (const actor of [{ role: "student", status: "active" }, { role: "admin", status: "suspended" }]) {
    await assert.rejects(updateAdditionalResource(database.binding(), "missing", "Title", {}, actor), error => (error as { status: number }).status === 403);
    await assert.rejects(setAdditionalResourceReference(database.binding(), "missing", "apa", period, actor), error => (error as { status: number }).status === 403);
  }
});

test("archived or historical materials cannot be referenced or revived through library editing", async () => {
  const database = new LibraryDatabase();
  database.add(row("academic", { area: "complexive", period }));
  database.add(row("archived", { area: "complexive", period }, "resource", "archived"));
  database.add(row("history", { area: "final_degree", period: "2025-2026" }));
  database.add(row("support", { area: "resources", period }));
  for (const id of ["archived", "history", "support"]) await assert.rejects(setAdditionalResourceReference(database.binding(), id, "apa", period, teacher));
  await assert.rejects(updateAdditionalResource(database.binding(), "academic", "Changed", {}, teacher), /materia/);
  await assert.rejects(setAdditionalResourceReference(database.binding(), "academic", "invalid", period, teacher));
  assert.equal(database.record("archived").status, "archived");
});

test("concurrent metadata or material edits survive a rejected stale write", async () => {
  const database = new LibraryDatabase();
  database.add(row("support", { area: "resources", category: "apa", period, description: "Before" }));
  database.beforeWrite = () => database.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.description','Concurrent') WHERE id='support'").run();
  await assert.rejects(updateAdditionalResource(database.binding(), "support", "Edited", { description: "Replace" }, teacher), error => (error as { status: number }).status === 409);
  assert.equal(database.record("support").data.description, "Concurrent"); assert.equal(database.record("support").status, "published");
  database.add(row("academic", { area: "complexive", period, topic: "Before" }));
  database.beforeWrite = () => database.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.topic','Concurrent') WHERE id='academic'").run();
  await assert.rejects(setAdditionalResourceReference(database.binding(), "academic", "apa", period, teacher), error => (error as { status: number }).status === 409);
  assert.equal(database.record("academic").data.topic, "Concurrent"); assert.equal(database.record("academic").data.additionalCategory, undefined);
});

test("the same period policy covers catalog and direct protected downloads while keeping legacy courses", () => {
  assert.equal(resourceInCurrentPeriod({ period }, period), true);
  assert.equal(resourceInCurrentPeriod({ period: "2025-2026" }, period), false);
  assert.equal(resourceInCurrentPeriod({}, period), true);
  assert.equal(resourceInCurrentPeriod({ period: { invalid: true } }, period), false);
  const archived = row("archived", { area: "resources", category: "apa", period, fileKey: "materials/shared/safe.pdf" }, "resource", "archived");
  assert.equal(additionalResourceCatalog([archived], period).length, 0);
  assert.equal(additionalResourceCatalog([archived], period, true).length, 1);
});
