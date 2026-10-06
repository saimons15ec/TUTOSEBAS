import { normalizeFinalBlockDistribution } from "./final-exam-blocks.ts";
import { sameSubject } from "./subjects.ts";

/** Resolve authoritative metadata in three queries, independent of block count. */
export async function resolveFinalExamBlocks(database: D1Database, value: unknown, area: string, period: string, defaultSubjects: string[]) {
  const entries = normalizeFinalBlockDistribution(value);
  const found = await database.prepare(`SELECT id,title,data_json FROM records WHERE kind='question_block' AND status!='archived' AND id IN (${entries.map(() => "?").join(",")})`).bind(...entries.map(item => item.blockId)).all<{ id: string; title: string; data_json: string }>();
  for (const entry of entries) {
    const block = found.results.find(row => row.id === entry.blockId);
    if (!block) throw new Error("Uno de los bloques ya no está disponible. Revisa la selección.");
    const data = JSON.parse(block.data_json) as Record<string, unknown>;
    if (data.area !== area || data.period !== period) throw new Error("Todos los bloques deben pertenecer al área y periodo del examen.");
    if (typeof data.subject !== "string" || !data.subject.trim()) throw new Error("Un bloque no tiene una materia válida.");
    entry.subject = data.subject; entry.blockTitle = block.title;
  }
  const subjects = [...new Set(entries.map(entry => entry.subject))];
  const catalog = await database.prepare("SELECT title,status FROM records WHERE kind='subject' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?").bind(area, period).all<{ title: string; status: string }>();
  const used = await database.prepare(`SELECT DISTINCT json_extract(data_json,'$.subject') AS subject FROM records WHERE kind IN ('resource','question','simulator') AND status!='archived' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? AND json_extract(data_json,'$.subject') IN (${subjects.map(() => "?").join(",")})`).bind(area, period, ...subjects).all<{ subject: string }>();
  for (const subject of subjects) {
    const matches = catalog.results.filter(row => sameSubject(row.title, subject));
    if (matches.some(row => row.status === "archived") || !(matches.some(row => row.status === "published") || defaultSubjects.some(item => sameSubject(item, subject)) || used.results.some(row => sameSubject(row.subject, subject)))) throw new Error("Un bloque pertenece a una materia quitada del catálogo.");
  }
  return entries;
}
