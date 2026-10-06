import { sameSubject, subjectKey } from "./subjects.ts";

export type AcademicScope = { area: "complexive" | "final_degree"; subject: string; period: string };
export type TopicRecord = { id: string; kind: string; title: string; status: string; data: Record<string, unknown> };
export type AcademicTopic = AcademicScope & { id: string; title: string; number: number; name: string; aliases: string[]; legacy: boolean; needsReview: boolean };
export class AcademicTopicError extends Error { status = 400; }

export function topicKey(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es") : "";
}
export function academicScope(value: Record<string, unknown>): AcademicScope {
  const area = value.area, subject = typeof value.subject === "string" ? value.subject.trim() : "", period = typeof value.period === "string" ? value.period.trim() : "";
  if (!["complexive", "final_degree"].includes(String(area)) || !subject || subject.length > 180 || !period || period.length > 40 || /[\u0000-\u001f]/.test(subject + period)) throw new AcademicTopicError("Selecciona área, materia y periodo válidos para el tema.");
  return { area: area as AcademicScope["area"], subject, period };
}
export function inAcademicScope(data: Record<string, unknown>, scope: AcademicScope) {
  return data.area === scope.area && sameSubject(data.subject, scope.subject) && data.period === scope.period;
}
export function legacyTopicParts(value: string) {
  const match = /^(?:tema|unidad)\s*(\d+)\s*(?:[.:·–—-]\s*)?(.*)$/iu.exec(value.trim());
  const number = match ? Number(match[1]) : 0;
  const valid = Number.isInteger(number) && number > 0 && number <= 999;
  return { number: valid ? number : 0, name: match && valid ? match[2].trim() : value.trim() };
}
export function topicTitle(number: number, name: string) { return `Tema ${number}${name ? ` · ${name}` : ""}`; }
export function nextTopicNumber(topics: { number: number }[]) {
  const used = new Set(topics.map(topic => topic.number));
  for (let number = 1; number <= 999; number++) if (!used.has(number)) return number;
  throw new AcademicTopicError("La materia ya alcanzó el límite de 999 temas.");
}
export function topicAliases(topic: { title: string; aliases: string[] }) { return new Set([topic.title, ...topic.aliases].map(topicKey).filter(Boolean)); }
export function topicMatches(data: Record<string, unknown>, topic: AcademicTopic) {
  if (!inAcademicScope(data, topic)) return false;
  if (data.topicId) return data.topicId === topic.id;
  return topicAliases(topic).has(topicKey(data.topic));
}
export function managedAcademicTopic(row: TopicRecord, scope: AcademicScope): AcademicTopic | null {
  if (row.kind !== "topic" || row.status !== "published" || !inAcademicScope(row.data, scope)) return null;
  const number = Number(row.data.number);
  if (!Number.isInteger(number) || number < 1 || number > 999) return null;
  return { ...scope, id: row.id, title: row.title, number, name: String(row.data.name || ""), aliases: Array.isArray(row.data.aliases) ? row.data.aliases.filter((item): item is string => typeof item === "string") : [], legacy: false, needsReview: row.data.needsReview === true };
}

/** Managed IDs are authoritative; text aliases keep pre-catalog content usable. */
export function buildAcademicTopics(topicRows: TopicRecord[], content: TopicRecord[], scope: AcademicScope): AcademicTopic[] {
  const topics = topicRows.flatMap(row => { const topic = managedAcademicTopic(row, scope); return topic ? [topic] : []; });
  const hidden = new Set(topicRows.filter(row => row.status === "archived" && inAcademicScope(row.data, scope)).map(row => row.id));
  for (const row of content) {
    if (row.status === "archived" || !["resource", "question", "question_block"].includes(row.kind) || !inAcademicScope(row.data, scope) || hidden.has(String(row.data.topicId || ""))) continue;
    const title = typeof row.data.topic === "string" ? row.data.topic.trim() : "";
    if (!title || topics.some(topic => topicMatches(row.data, topic))) continue;
    const existing = topics.find(topic => topic.legacy && topicKey(topic.title) === topicKey(title));
    if (existing) { existing.aliases.push(title); continue; }
    const parts = legacyTopicParts(title);
    topics.push({ ...scope, id: `legacy:${topicKey(title)}`, title, number: parts.number || nextTopicNumber(topics), name: parts.name, aliases: [title], legacy: true, needsReview: Boolean(row.data.topicId) });
  }
  return topics.sort((a, b) => a.number - b.number || a.title.localeCompare(b.title, "es", { numeric: true }));
}
export function topicScopeKey(scope: AcademicScope) { return JSON.stringify([scope.area, subjectKey(scope.subject), scope.period]); }
export function normalizedTopicDefinition(number: unknown, name: unknown) {
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > 999) throw new AcademicTopicError("El número del tema debe estar entre 1 y 999.");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 150 || /[\u0000-\u001f]/.test(name)) throw new AcademicTopicError("Escribe un nombre de tema de hasta 150 caracteres.");
  return { number, name: name.trim(), title: topicTitle(number, name.trim()) };
}
