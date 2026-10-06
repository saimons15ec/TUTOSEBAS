import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { normalizedFormatSelection, planAcademicRequirementsFromRows, planFormatRequirements } from "../lib/academic-format-distribution.ts";
import { planTopicCoverage } from "../lib/academic-selection.ts";
import { resolveAcademicRequirements } from "../lib/academic-selection-storage.ts";
import { simulatorQuestionQuery, type SimulatorRequirement } from "../lib/final-exam-blocks.ts";
import { QUESTION_FORMATS } from "../lib/question-blocks.ts";
import { buildOperatingOverview } from "../lib/operations.ts";

const [direct, complete, relate, order, practical] = QUESTION_FORMATS;
const scope = { area: "complexive", period: "2026-2027" };
const base = { ...scope, mode: "subject", subject: "Ciencias", count: 20, formats: [], formatCoverage: "varied" };
const sums = (requirements: SimulatorRequirement[], key: "subject" | "topic" | "format" | "blockId") => requirements.reduce<Record<string, number>>((result, item) => { const value = String(item[key]); result[value] = (result[value] || 0) + item.count; return result; }, {});
const capacities = (counts: number[]) => Object.fromEntries(QUESTION_FORMATS.map((format, i) => [format, counts[i] || 0]));

class Bank {
  sql = new DatabaseSync(":memory:");
  rows: { id: string; kind: string; title: string; status: string; data: Record<string, unknown> }[] = [];
  constructor() { this.sql.exec("CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,title TEXT,status TEXT,data_json TEXT)"); }
  prepare(query: string) { return { bind: (...values: SQLInputValue[]) => ({ all: async () => ({ results: this.sql.prepare(query).all(...values) }) }) }; }
  binding() { return this as unknown as D1Database; }
  add(data: Record<string, unknown>, count: number, status = "approved") { for (let i = 0; i < count; i++) { const id = `q${this.rows.length}`; this.rows.push({ id, kind: "question", title: id, status, data }); this.sql.prepare("INSERT INTO records VALUES (?,'question',?,?,?)").run(id, id, status, JSON.stringify(data)); } }
  draw(data: Record<string, unknown>, requirements: SimulatorRequirement[]) { return requirements.flatMap(requirement => { const query = simulatorQuestionQuery(data, requirement); const result = this.sql.prepare("SELECT id,data_json FROM records WHERE " + query.sql + " ORDER BY RANDOM() LIMIT ?").all(...query.values, requirement.count); assert.equal(result.length, requirement.count); return result.map(row => ({ id: String(row.id), data: JSON.parse(String(row.data_json)) as Record<string, unknown> })); }); }
}

test("old configurations keep pool draws and exact quotas reject ambiguous or invalid quantities", () => {
  assert.deepEqual(normalizedFormatSelection({}), { formatCoverage: "pool", formatDistribution: [] });
  const valid = { count: 20, formats: [direct, complete], formatCoverage: "quota", formatDistribution: [{ format: direct, count: 5 }, { format: complete, count: 15 }] };
  assert.equal(normalizedFormatSelection(valid).formatDistribution.length, 2);
  for (const patch of [
    { formatCoverage: "other" }, { count: 21 },
    { formatDistribution: [{ format: practical, count: 20 }] },
    { formatDistribution: [{ format: direct, count: 10 }, { format: direct, count: 10 }] },
    { formatDistribution: [{ format: direct, count: "20" }] },
    { formatDistribution: [{ format: direct, count: 0 }] },
    { formatDistribution: [{ format: direct, count: 1.5 }] },
  ]) assert.throws(() => normalizedFormatSelection({ ...valid, ...patch }));
});

test("variety includes five formats and gives each four questions when the bank permits", () => {
  const result = planFormatRequirements(base, [{ subject: "Ciencias", count: 20 }], [capacities([10, 10, 10, 10, 10])]);
  assert.deepEqual(sums(result, "format"), capacities([4, 4, 4, 4, 4]));
});

test("variety adapts to scarce formats while preserving quantities per matter", () => {
  const requirements = [{ subject: "Ciencias", count: 10 }, { subject: "Lengua", count: 10 }];
  const result = planFormatRequirements(base, requirements, [capacities([1, 10, 2, 0, 0]), capacities([0, 10, 10, 0, 0])]);
  assert.deepEqual(sums(result, "subject"), { Ciencias: 10, Lengua: 10 });
  assert.equal(sums(result, "format")[direct], 1);
  assert.equal(sums(result, "format")[order], undefined);
  assert.ok(sums(result, "format")[complete] > 0 && sums(result, "format")[relate] > 0);
});

test("explicit variety never silently drops a selected format or changes group quantities", () => {
  assert.throws(() => planFormatRequirements({ ...base, formats: [direct, complete] }, [{ subject: "Ciencias", count: 20 }], [capacities([30, 0, 0, 0, 0])]), /Completar: necesitas 1 y hay 0/);
  const grouped = [{ subject: "Ciencias", count: 1 }, { subject: "Lengua", count: 2 }];
  assert.throws(() => planFormatRequirements({ ...base, count: 3, formats: [direct, complete, relate] }, grouped, [capacities([1, 1, 0, 0, 0]), capacities([0, 0, 3, 0, 0])]), /cada formato/);
  assert.throws(() => planFormatRequirements({ ...base, count: 2 }, [{ subject: "Ciencias", count: 2 }], [capacities([1, 1, 1, 0, 0])]), /al menos 3/);
});

test("joint quotas use alternate assignments rather than rejecting a feasible crossed bank", () => {
  const data = { ...base, count: 2, formatCoverage: "quota", formatDistribution: [{ format: direct, count: 1 }, { format: complete, count: 1 }] };
  const result = planFormatRequirements(data, [{ subject: "A", count: 1 }, { subject: "B", count: 1 }], [capacities([1, 1]), capacities([1, 0])]);
  assert.deepEqual(result, [{ subject: "A", count: 1, format: complete }, { subject: "B", count: 1, format: direct }]);
  assert.throws(() => planFormatRequirements({ ...data, count: 4, formatDistribution: [{ format: direct, count: 3 }, { format: complete, count: 1 }] }, [{ subject: "A", count: 2 }, { subject: "B", count: 2 }], [capacities([3, 0]), capacities([0, 3])]), /no caben/);
});

test("small capacity matrices agree with exhaustive feasible assignments", () => {
  for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) for (let d = 0; d <= 2; d++) for (let left = 1; left <= 2; left++) for (let right = 1; right <= 2; right++) for (let directCount = 1; directCount < left + right; directCount++) {
    const feasible = Array.from({ length: left + 1 }, (_, x) => x).some(x => x <= a && left - x <= b && directCount - x >= 0 && directCount - x <= c && right - directCount + x >= 0 && right - directCount + x <= d);
    const data = { ...base, count: left + right, formatCoverage: "quota", formatDistribution: [{ format: direct, count: directCount }, { format: complete, count: left + right - directCount }] };
    let actual = false;
    try { const result = planFormatRequirements(data, [{ subject: "A", count: left }, { subject: "B", count: right }], [capacities([a, b]), capacities([c, d])]); actual = true; assert.deepEqual(sums(result, "subject"), { A: left, B: right }); assert.deepEqual(sums(result, "format"), { [direct]: directCount, [complete]: left + right - directCount }); } catch (error) { if (error instanceof assert.AssertionError) throw error; }
    assert.equal(actual, feasible, JSON.stringify({ a, b, c, d, left, right, directCount }));
  }
});

test("server SQL and professor preview preserve balanced topics, formats and unique questions", async () => {
  const bank = new Bank();
  for (let topic = 1; topic <= 5; topic++) for (const format of QUESTION_FORMATS) bank.add({ ...scope, subject: "Ciencias", topic: `Tema ${topic}`, format }, 4);
  bank.add({ ...scope, subject: "Ciencias", topic: "Tema 6", format: direct }, 100, "pending");
  bank.add({ ...scope, subject: "Ciencias", topic: "Tema 1", format: direct, period: "2025-2026" }, 100);
  bank.add({ ...scope, subject: "Ciencias", topic: "Tema 1", format: direct, area: "final_degree" }, 100);
  const data = { ...base, topicCoverage: "balanced", formatCoverage: "quota", formatDistribution: [{ format: direct, count: 5 }, { format: complete, count: 15 }] };
  const server = await resolveAcademicRequirements(bank.binding(), data), preview = planAcademicRequirementsFromRows(data, bank.rows);
  assert.deepEqual(server, preview);
  assert.deepEqual(sums(server, "topic"), Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`Tema ${i + 1}`, 4])));
  const drawn = bank.draw(data, server);
  assert.equal(new Set(drawn.map(row => row.id)).size, 20);
  assert.equal(drawn.filter(row => row.data.format === direct).length, 5);
  assert.ok(drawn.every(row => row.data.period === scope.period && row.data.area === scope.area));
});

for (const area of ["complexive", "final_degree"]) for (const formatCoverage of ["pool", "varied", "quota"]) {
  test(`numbered topics keep the same remainder and format quotas in SQL and preview (${area}, ${formatCoverage})`, async () => {
    const bank = new Bank();
    const topicBank = [
      { topic: "Tema 10 · Ecosistemas", format: practical },
      { topic: "Tema 2 · Plantas", format: complete },
      { topic: "Tema 1 · Inicio", format: direct },
    ];
    for (const item of topicBank) bank.add({ ...scope, area, subject: "Ciencias", ...item }, 3);
    bank.add({ ...scope, area, subject: "Ciencias", topic: "Tema 3 · Pendiente", format: direct }, 10, "pending");
    bank.add({ ...scope, area, subject: "Ciencias", topic: "Tema 3 · Histórico", format: direct, period: "2025-2026" }, 10);
    const data = { ...base, area, count: 5, topicCoverage: "balanced", formatCoverage, formatDistribution: [{ format: direct, count: 2 }, { format: complete, count: 2 }, { format: practical, count: 1 }] };
    try {
      const preview = planAcademicRequirementsFromRows(data, bank.rows);
      const server = await resolveAcademicRequirements(bank.binding(), data);
      assert.deepEqual(server, preview);
      assert.deepEqual(sums(server, "topic"), { "Tema 1 · Inicio": 2, "Tema 2 · Plantas": 2, "Tema 10 · Ecosistemas": 1 });
      const drawn = bank.draw(data, server);
      assert.equal(drawn.length, 5);
      assert.equal(new Set(drawn.map(row => row.id)).size, 5);
      assert.deepEqual(Object.fromEntries([direct, complete, practical].map(format => [format, drawn.filter(row => row.data.format === format).length])), { [direct]: 2, [complete]: 2, [practical]: 1 });
      assert.ok(drawn.every(row => row.data.area === area && row.data.period === scope.period));
    } finally { bank.sql.close(); }
  });
}

test("balanced topic order does not depend on input order or equal numeric labels", () => {
  const available = ["Tema 10", "Tema 2", "Tema 02"].map(topic => ({ topic, count: 3 }));
  const original = structuredClone(available);
  const data = { ...base, count: 5 };
  const forward = planTopicCoverage(data, available);
  const reversed = planTopicCoverage(data, [...available].reverse());
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.map(item => item.topic), ["Tema 02", "Tema 2", "Tema 10"]);
  assert.deepEqual(available, original);
});

test("final draws mix formats across matters and blocks while keeping exact block counts", async () => {
  const bank = new Bank();
  bank.add({ ...scope, subject: "Ciencias", importBlockId: "b1", topic: "Tema 1", format: direct }, 10);
  bank.add({ ...scope, subject: "Ciencias", importBlockId: "b1", topic: "Tema 1", format: complete }, 10);
  bank.add({ ...scope, subject: "Lengua", importBlockId: "b2", topic: "Tema 2", format: complete }, 15);
  bank.add({ ...scope, subject: "Lengua", importBlockId: "unselected", topic: "Tema 3", format: direct }, 30);
  const data = { ...base, mode: "final", selectionMode: "blocks", blockDistribution: [{ blockId: "b1", subject: "Ciencias", count: 10 }, { blockId: "b2", subject: "Lengua", count: 10 }], formatCoverage: "quota", formatDistribution: [{ format: direct, count: 5 }, { format: complete, count: 15 }] };
  const requirements = await resolveAcademicRequirements(bank.binding(), data);
  assert.deepEqual(sums(requirements, "blockId"), { b1: 10, b2: 10 });
  const draw = bank.draw(data, requirements);
  assert.equal(draw.filter(row => row.data.format === direct).length, 5);
  assert.equal(draw.filter(row => row.data.importBlockId === "unselected").length, 0);
  assert.equal(new Set(draw.map(row => row.id)).size, 20);
  assert.deepEqual(requirements, planAcademicRequirementsFromRows(data, bank.rows));
  const byMatter = { ...data, selectionMode: "subjects", distribution: [{ subject: "Ciencias", count: 10 }, { subject: "Lengua", count: 10 }] };
  assert.deepEqual(sums(await resolveAcademicRequirements(bank.binding(), byMatter), "subject"), { Ciencias: 10, Lengua: 10 });
});

test("readiness detects missing format stock and legacy pool settings stay compatible", async () => {
  const bank = new Bank(); bank.add({ ...scope, subject: "Ciencias", topic: "Tema 1", format: direct, source: "Texto académico" }, 20);
  const simulator = { id: "sim", kind: "simulator", title: "Ciencias", status: "published", data: { ...base, formats: [direct, complete] } };
  const material = { id: "material", kind: "resource", title: "Guía de plantas", status: "published", data: { ...scope, subject: "Ciencias", topic: "Tema 1", fileKey: "material/shared/registered.pdf" } };
  assert.equal(buildOperatingOverview([...bank.rows, simulator, material], [], "complexive", scope.period, ["Ciencias"]).subjects[0].ready, false);
  simulator.data = { ...simulator.data, formats: [], formatCoverage: "pool" };
  assert.equal(buildOperatingOverview([...bank.rows, simulator, material], [], "complexive", scope.period, ["Ciencias"]).subjects[0].ready, true);
  const legacy = { ...base, formatCoverage: undefined };
  assert.deepEqual(await resolveAcademicRequirements(bank.binding(), legacy), [{ subject: "Ciencias", count: 20 }]);
});
