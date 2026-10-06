import { simulatorTopicQuery } from "./simulators.ts";
import { sameSubject } from "./subjects.ts";
import { academicFormatQuery, normalizedAcademicFormats } from "./academic-selection.ts";

export const MAX_FINAL_BLOCKS = 30;
export const MAX_FINAL_BLOCK_QUESTIONS = 200;
export type FinalBlockEntry = { blockId: string; count: number; subject: string; blockTitle: string };
export type SimulatorRequirement = { subject: string; count: number; blockId?: string; blockTitle?: string; topic?: string; format?: string };

export function normalizeFinalBlockDistribution(value: unknown): FinalBlockEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_FINAL_BLOCKS) throw new Error(`Selecciona entre 1 y ${MAX_FINAL_BLOCKS} bloques.`);
  const seen = new Set<string>();
  const entries = value.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Revisa los bloques del examen final.");
    const data = item as Record<string, unknown>, blockId = typeof data.blockId === "string" ? data.blockId.trim() : "";
    const count = Number(data.count);
    if (!blockId || blockId.length > 100 || seen.has(blockId)) throw new Error("Cada bloque debe tener un identificador válido y aparecer una sola vez.");
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Cada bloque debe aportar entre 1 y 100 preguntas.");
    seen.add(blockId);
    return { blockId, count, subject: typeof data.subject === "string" ? data.subject.trim().slice(0, 180) : "", blockTitle: typeof data.blockTitle === "string" ? data.blockTitle.trim().slice(0, 180) : "" };
  });
  if (entries.reduce((sum, item) => sum + item.count, 0) > MAX_FINAL_BLOCK_QUESTIONS) throw new Error(`El examen por bloques admite hasta ${MAX_FINAL_BLOCK_QUESTIONS} preguntas en total.`);
  return entries;
}

export function simulatorRequirements(data: Record<string, unknown>): SimulatorRequirement[] {
  if (data.mode === "final" && data.selectionMode === "blocks") {
    const entries = normalizeFinalBlockDistribution(data.blockDistribution);
    if (entries.some(item => !item.subject)) throw new Error("Hay bloques sin materia; revisa la configuración del examen.");
    return entries;
  }
  const distribution = Array.isArray(data.distribution) ? data.distribution.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>, count = Number(value.count), subject = String(value.subject || "");
    return subject && Number.isInteger(count) && count > 0 ? [{ subject, count }] : [];
  }) : [];
  return distribution.length ? distribution : [{ subject: String(data.subject || "General"), count: Math.max(1, Number(data.count) || 20) }];
}

/** One shared bound query for publication counts and the actual student draw. */
export function simulatorQuestionQuery(data: Record<string, unknown>, requirement: SimulatorRequirement) {
  let sql = "kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?";
  const values: (string | number)[] = [String(data.area || ""), String(data.period || "2026-2027")];
  if (!["General", "23 materias"].includes(requirement.subject)) { sql += " AND json_extract(data_json,'$.subject')=?"; values.push(requirement.subject); }
  if (requirement.blockId) { sql += " AND json_extract(data_json,'$.importBlockId')=?"; values.push(requirement.blockId); }
  else if (requirement.topic) { sql += " AND json_extract(data_json,'$.topic')=?"; values.push(requirement.topic); }
  else { const topics = simulatorTopicQuery(data); sql += topics.sql; values.push(...topics.values); }
  const formats = academicFormatQuery(data); sql += formats.sql; values.push(...formats.values);
  if (requirement.format) { sql += " AND json_extract(data_json,'$.format')=?"; values.push(requirement.format); }
  return { sql, values };
}

export function matchesSimulatorRequirement(question: Record<string, unknown>, data: Record<string, unknown>, requirement: SimulatorRequirement) {
  if (question.area !== data.area || question.period !== data.period) return false;
  if (!["General", "23 materias"].includes(requirement.subject) && question.subject !== requirement.subject) return false;
  const formats = normalizedAcademicFormats(data.formats);
  if (formats.length && !formats.includes(String(question.format || ""))) return false;
  if (requirement.format && question.format !== requirement.format) return false;
  if (requirement.blockId) return question.importBlockId === requirement.blockId;
  if (requirement.topic) return question.topic === requirement.topic;
  const topics = simulatorTopicQuery(data).values;
  return !topics.length || topics.includes(String(question.topic || ""));
}

export function removeSubjectFromBlockDistribution(value: unknown, subject: string) {
  const entries = Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !sameSubject((item as Record<string, unknown>).subject, subject)) : [];
  return { entries, count: entries.reduce((sum, item) => sum + Number((item as Record<string, unknown>).count || 0), 0) };
}

export function assertSimulatorSessionSize(data: unknown) {
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 1_500_000) throw new Error("Este examen contiene demasiado texto. Reduce la cantidad de preguntas o divide los casos en varios exámenes.");
}
