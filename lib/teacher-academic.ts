import { inAcademicScope, topicMatches, type AcademicScope, type AcademicTopic, type TopicRecord } from "./academic-topics.ts";

export type TeacherAcademicStep = "materials" | "questions" | "simulators";

/** Keep older shortcuts inside the same academic workspace. */
export function teacherAcademicDestination(value: string) {
  if (value === "questions" || value === "simulators") return { section: "complexive", step: value as TeacherAcademicStep };
  const [section, requested] = value.split(":");
  const step: TeacherAcademicStep = ["questions", "simulators"].includes(requested) && ["complexive", "final"].includes(section) ? requested as TeacherAcademicStep : "materials";
  return { section, step };
}

/** A subject's questions and materials use the selected topic; simulators use its whole bank. */
export function teacherAcademicRecords<T extends TopicRecord>(rows: T[], scope: AcademicScope, topic: AcademicTopic | null = null) {
  return rows.filter(row => row.status !== "archived" && inAcademicScope(row.data, scope) && (!topic || topicMatches(row.data, topic)));
}

export function questionBlockReviewState(block: TopicRecord, rows: TopicRecord[]) {
  const questions = rows.filter(row => row.kind === "question" && row.data.importBlockId === block.id);
  const approved = questions.filter(row => row.status === "approved").length;
  const pending = questions.filter(row => ["pending", "draft"].includes(row.status)).length;
  const blocked = block.status === "archived" || !questions.length || questions.some(row => !["pending", "draft", "approved"].includes(row.status));
  // Changing any question invalidates the teacher's previous review checkbox.
  const revision = JSON.stringify(questions.map(row => [row.id, row.status, row.data]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  return { total: questions.length, approved, pending, blocked, revision };
}
