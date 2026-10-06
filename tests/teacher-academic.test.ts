import assert from "node:assert/strict";
import test from "node:test";
import { buildAcademicTopics, type TopicRecord } from "../lib/academic-topics.ts";
import { drawTopicPractice, topicPracticeFormats, type PracticeFilter } from "../lib/academic-selection.ts";
import { questionBlockReviewState, teacherAcademicDestination, teacherAcademicRecords } from "../lib/teacher-academic.ts";
import { QUESTION_FORMATS } from "../lib/question-blocks.ts";

const base = { area: "complexive" as const, subject: "Ciencias naturales", period: "2026-2027", topic: "Tema 1 · Indagación" };
function record(id: string, data: Record<string, unknown> = {}, status = "approved", kind = "question"): TopicRecord {
  return { id, kind, title: id, status, data: { ...base, format: "Selección directa", ...data } };
}

test("teacher shortcuts open the intended area and stage, including legacy entries", () => {
  assert.deepEqual(teacherAcademicDestination("final:questions"), { section: "final", step: "questions" });
  assert.deepEqual(teacherAcademicDestination("complexive:simulators"), { section: "complexive", step: "simulators" });
  assert.deepEqual(teacherAcademicDestination("final"), { section: "final", step: "materials" });
  assert.deepEqual(teacherAcademicDestination("questions"), { section: "complexive", step: "questions" });
  assert.deepEqual(teacherAcademicDestination("simulators"), { section: "complexive", step: "simulators" });
  assert.deepEqual(teacherAcademicDestination("home"), { section: "home", step: "materials" });
});

test("workspace selection separates areas, subjects, periods and topics while retaining pending review", () => {
  const rows = [record("current"), record("pending", {}, "pending"), record("topic2", { topic: "Tema 2 · Plantas" }), record("foreignArea", { area: "final_degree" }), record("foreignSubject", { subject: "Lengua" }), record("historical", { period: "2025-2026" }), record("archived", {}, "archived")];
  const topics = buildAcademicTopics([], rows, base);
  assert.deepEqual(teacherAcademicRecords(rows, base, topics[0]).map(row => row.id), ["current", "pending"]);
  // The simulator's entire subject bank remains available even after choosing Tema 1 for editing.
  assert.deepEqual(teacherAcademicRecords(rows, base).map(row => row.id), ["current", "pending", "topic2"]);
});

test("reviewing a block includes every format and only that block's pending questions", () => {
  const block = record("block", {}, "pending", "question_block");
  const rows = QUESTION_FORMATS.map((format, index) => record(`question-${index}`, { format, importBlockId: "block" }, index === 0 ? "approved" : index === 1 ? "draft" : "pending"));
  rows.push(record("other-block", { importBlockId: "other" }, "rewrite"));
  const review = questionBlockReviewState(block, rows);
  assert.equal(review.total, 5); assert.equal(review.approved, 1); assert.equal(review.pending, 4); assert.equal(review.blocked, false);
  assert.equal(questionBlockReviewState(block, []).blocked, true);
  assert.equal(questionBlockReviewState({ ...block, status: "archived" }, rows).blocked, true);
  assert.equal(questionBlockReviewState(block, [...rows, record("held", { importBlockId: "block" }, "rewrite")]).blocked, true);
  assert.equal(questionBlockReviewState(block, [...rows, record("held", { importBlockId: "block" }, "archived")]).blocked, true);
});

test("an edit or individual approval invalidates the existing block review checkbox", () => {
  const block = record("block", {}, "pending", "question_block"), rows = [record("one", { importBlockId: "block", correctIndex: 0 }, "pending"), record("two", { importBlockId: "block" }, "pending")];
  const original = questionBlockReviewState(block, rows).revision;
  assert.equal(questionBlockReviewState(block, [...rows].reverse()).revision, original);
  assert.notEqual(questionBlockReviewState(block, [{ ...rows[0], data: { ...rows[0].data, correctIndex: 2 } }, rows[1]]).revision, original);
  assert.notEqual(questionBlockReviewState(block, [{ ...rows[0], status: "approved" }, rows[1]]).revision, original);
});

for (const area of ["complexive", "final_degree"] as const) {
  test(`practice format counts come only from the approved selected theme in ${area}`, () => {
    const filter: PracticeFilter = { ...base, area, format: "" };
    const rows = [record("one", { area }), record("two", { area }), record("case", { area, format: "Caso práctico" }), record("other-theme", { area, topic: "Tema 2", format: "Ordenar" }), record("unapproved", { area, format: "Completar" }, "pending"), record("other-area", { area: area === "complexive" ? "final_degree" : "complexive", format: "Relacionar" }), record("old", { area, period: "2025-2026", format: "Relacionar" }), record("other-subject", { area, subject: "Lengua", format: "Relacionar" })];
    assert.deepEqual(topicPracticeFormats([...rows, rows[0]], filter), QUESTION_FORMATS.map(format => ({ format, count: format === "Selección directa" ? 2 : format === "Caso práctico" ? 1 : 0 })));
    assert.throws(() => drawTopicPractice(rows, { ...filter, format: "Ordenar" }, 1, values => values), /Hay 0/);
    assert.throws(() => drawTopicPractice(rows, { ...filter, format: "Selección directa" }, 3, values => values), /Hay 2/);
  });
}

test("practice format availability respects a renamed topic's stable ID and legacy alias", () => {
  const filter: PracticeFilter = { ...base, topic: "Tema 1 · Nuevo nombre", topicId: "topic1", topicAliases: [base.topic], format: "" };
  const rows = [record("stable", { topicId: "topic1" }), record("legacy"), record("foreign-id", { topicId: "topic2" })];
  assert.equal(topicPracticeFormats(rows, filter).find(item => item.format === "Selección directa")!.count, 2);
});

test("practising again prefers different compatible questions and refills only from the same selection", () => {
  const filter: PracticeFilter = { ...base, format: "Selección directa" }, rows = Array.from({ length: 8 }, (_, index) => record(`q${index}`));
  rows.push(record("different-format", { format: "Ordenar" }), record("different-topic", { topic: "Tema 2" }), record("different-area", { area: "final_degree" }));
  const first = drawTopicPractice(rows, filter, 4, values => values);
  const second = drawTopicPractice(rows, filter, 4, values => values, first.map(row => row.id));
  assert.equal(new Set([...first, ...second].map(row => row.id)).size, 8);
  const refill = drawTopicPractice(rows, filter, 6, values => values, first.map(row => row.id));
  assert.equal(refill.length, 6); assert.equal(new Set(refill.map(row => row.id)).size, 6);
  assert.ok(refill.every(row => row.data.topic === base.topic && row.data.format === filter.format && row.data.area === base.area));
});
