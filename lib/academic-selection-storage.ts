import { AcademicSelectionError, missingExamSubjects, planTopicCoverage } from "./academic-selection.ts";
import { simulatorQuestionQuery, simulatorRequirements } from "./final-exam-blocks.ts";
import { sameSubject } from "./subjects.ts";
import { planFormatRequirements } from "./academic-format-distribution.ts";

export async function resolveAcademicRequirements(database: D1Database, data: Record<string, unknown>) {
  let requirements = simulatorRequirements(data);
  if (data.mode === "subject" && data.topicCoverage === "balanced") {
    const scope = simulatorQuestionQuery(data, requirements[0]);
    const bank = await database.prepare("SELECT COALESCE(json_extract(data_json,'$.topic'),'') AS topic,COUNT(*) AS count FROM records WHERE " + scope.sql + " GROUP BY json_extract(data_json,'$.topic') ORDER BY topic").bind(...scope.values).all<{ topic: string; count: number }>();
    requirements = planTopicCoverage(data, bank.results);
  }
  if (data.formatCoverage === undefined || data.formatCoverage === "pool") return requirements;
  const capacities: Record<string, number>[] = [];
  for (const requirement of requirements) {
    const scope = simulatorQuestionQuery(data, requirement);
    const bank = await database.prepare("SELECT COALESCE(json_extract(data_json,'$.format'),'') AS format,COUNT(*) AS count FROM records WHERE " + scope.sql + " GROUP BY json_extract(data_json,'$.format')").bind(...scope.values).all<{ format: string; count: number }>();
    capacities.push(Object.fromEntries(bank.results.map(item => [item.format, item.count])));
  }
  return planFormatRequirements(data, requirements, capacities);
}

export async function validateAllSubjectCoverage(database: D1Database, data: Record<string, unknown>, defaults: string[]) {
  if (data.mode !== "final" || data.coverAllSubjects !== true) return;
  const catalog = await database.prepare("SELECT title,status FROM records WHERE kind='subject' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?").bind(String(data.area || ""), String(data.period || "")).all<{ title: string; status: string }>();
  const used = await database.prepare("SELECT DISTINCT json_extract(data_json,'$.subject') AS subject FROM records WHERE kind IN ('resource','question','simulator') AND status!='archived' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?").bind(String(data.area || ""), String(data.period || "")).all<{ subject: string | null }>();
  const removed = catalog.results.filter(row => row.status === "archived").map(row => row.title);
  const subjects = [...new Set([...defaults, ...catalog.results.filter(row => row.status === "published").map(row => row.title), ...used.results.map(row => row.subject || "")].filter(subject => subject.trim() && !["general", "23 materias"].includes(subject.trim().toLocaleLowerCase("es")) && !removed.some(item => sameSubject(item, subject))))];
  const missing = missingExamSubjects(subjects, simulatorRequirements(data));
  if (missing.length) throw new AcademicSelectionError(`Faltan materias en el examen final: ${missing.join(", ")}. Incluye preguntas aprobadas de cada una o desactiva la cobertura completa para una evaluación parcial.`);
}
