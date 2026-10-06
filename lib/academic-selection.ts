import { QUESTION_FORMATS } from "./question-blocks.ts";
import { type SimulatorRequirement } from "./final-exam-blocks.ts";
import { topicKey } from "./academic-topics.ts";

export class AcademicSelectionError extends Error {}

export const MAX_SUBJECT_SIMULATOR_QUESTIONS = 100;
export function normalizedAcademicFormats(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > QUESTION_FORMATS.length || value.some(item => typeof item !== "string" || !QUESTION_FORMATS.includes(item as typeof QUESTION_FORMATS[number]))) throw new AcademicSelectionError("Selecciona formatos válidos de pregunta.");
  return [...new Set(value as string[])];
}

export function academicFormatQuery(data: Record<string, unknown>) {
  const formats = normalizedAcademicFormats(data.formats);
  return { sql: formats.length ? ` AND json_extract(data_json,'$.format') IN (${formats.map(() => "?").join(",")})` : "", values: formats };
}

export function planTopicCoverage(data: Record<string, unknown>, available: { topic: string; count: number }[]): SimulatorRequirement[] {
  const count = Number(data.count);
  if (!Number.isInteger(count) || count < 5 || count > MAX_SUBJECT_SIMULATOR_QUESTIONS) throw new AcademicSelectionError("El simulador por materia admite entre 5 y 100 preguntas.");
  const selectedTopics = Array.isArray(data.topics) ? data.topics.map(String) : [];
  if (available.some(item => !item.topic.trim())) throw new AcademicSelectionError("Hay preguntas aprobadas sin tema. Organízalas antes de publicar un simulador por temas.");
  // Assign remainders in the same natural order in SQL-backed and preview plans.
  const topics = available.filter(item => item.count > 0 && (!selectedTopics.length || selectedTopics.includes(item.topic)))
    .sort((a, b) => a.topic.localeCompare(b.topic, "es", { numeric: true }) || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0));
  if (!topics.length) throw new AcademicSelectionError("No hay preguntas aprobadas para los temas y formatos elegidos.");
  const missing = selectedTopics.filter(topic => !topics.some(item => item.topic === topic));
  if (missing.length) throw new AcademicSelectionError(`Faltan preguntas aprobadas en: ${missing.join(", ")}.`);
  if (topics.length > count) throw new AcademicSelectionError(`Necesitas al menos ${topics.length} preguntas para incluir los ${topics.length} temas.`);
  if (topics.reduce((sum, item) => sum + item.count, 0) < count) throw new AcademicSelectionError(`Necesitas ${count} preguntas aprobadas en los temas y formatos elegidos.`);
  const result = topics.map(item => ({ subject: String(data.subject || ""), topic: item.topic, count: 1 }));
  let assigned = result.length;
  while (assigned < count) for (let i = 0; i < result.length && assigned < count; i++) if (result[i].count < topics[i].count) { result[i].count++; assigned++; }
  return result;
}

type QuestionRecord = { id: string; status: string; data: Record<string, unknown> };
export type PracticeFilter = { area: string; subject: string; period: string; topic: string; format: string; topicId?: string; topicAliases?: string[] };
export function filterTopicPractice<T extends QuestionRecord>(rows: T[], filter: PracticeFilter): T[] {
  const aliases = new Set([filter.topic, ...(filter.topicAliases || [])].map(topicKey).filter(Boolean));
  return rows.filter(row => row.status === "approved" && row.data.area === filter.area && row.data.subject === filter.subject && row.data.period === filter.period && (!(filter.topic || filter.topicId) || (filter.topicId && row.data.topicId ? row.data.topicId === filter.topicId : aliases.has(topicKey(row.data.topic)))) && (!filter.format || row.data.format === filter.format));
}
export function topicPracticeFormats<T extends QuestionRecord>(rows: T[], filter: PracticeFilter) {
  const eligible = [...new Map(filterTopicPractice(rows, { ...filter, format: "" }).map(row => [row.id, row])).values()];
  return QUESTION_FORMATS.map(format => ({ format, count: eligible.filter(row => row.data.format === format).length }));
}

export function drawTopicPractice<T extends QuestionRecord>(rows: T[], filter: PracticeFilter, count: number, shuffle: (rows: T[]) => T[], previousQuestionIds: string[] = []): T[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new AcademicSelectionError("Elige entre 1 y 100 preguntas para la práctica.");
  const unique = [...new Map(filterTopicPractice(rows, filter).map(row => [row.id, row])).values()];
  if (unique.length < count) throw new AcademicSelectionError(`Hay ${unique.length} preguntas aprobadas con ese tema y formato; pediste ${count}.`);
  const previous = new Set(previousQuestionIds);
  const unused = shuffle(unique.filter(row => !previous.has(row.id)));
  const repeated = shuffle(unique.filter(row => previous.has(row.id)));
  return [...unused, ...repeated].slice(0, count);
}

export function missingExamSubjects(subjects: string[], requirements: SimulatorRequirement[]) {
  return subjects.filter(subject => !requirements.some(item => item.subject.trim().toLocaleLowerCase("es") === subject.trim().toLocaleLowerCase("es")));
}
