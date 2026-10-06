import { assertActiveStudent, PublicError } from "./security.ts";
import { canUsePlanFeature, contentPlanFeature, planCatalogFromRows } from "./plans.ts";
import { sha256Hex } from "./security-storage.ts";
import { publicPracticeData, type PracticeState } from "./practice-progress.ts";

type Actor = { id: string; role: string; status: string; group_id?: string | null };
type Stored = { id: string; kind: string; status: string; title: string; group_id: string | null; created_by: string; created_at: string; updated_at: string; data_json: string };
const decode = (row: Stored) => JSON.parse(row.data_json) as Record<string, unknown>;
const hash = (value: string) => sha256Hex(new TextEncoder().encode(value));
const identifier = (input: unknown) => typeof input === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(input);
const publicRow = (row: Stored) => { const { data_json, ...metadata } = row; return { ...metadata, data: publicPracticeData(JSON.parse(data_json) as PracticeState) }; };
async function questions(database: D1Database, ids: string[]) {
  return (await database.prepare(`SELECT * FROM records WHERE kind='question' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<Stored>()).results;
}
async function access(database: D1Database, actor: Actor, rows: Stored[]) {
  assertActiveStudent(actor.role, actor.status); if (!actor.group_id) throw new PublicError("Debes pertenecer a un grupo para guardar tu práctica.", 403);
  const period = await database.prepare("SELECT id,title,data_json FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ id: string; title: string; data_json: string }>();
  const activePeriod = period?.title || "2026-2027", group = await database.prepare("SELECT * FROM records WHERE kind='group' AND id=?").bind(actor.group_id).first<Stored>();
  if (!group || group.status !== "active") throw new PublicError("Tu grupo no está habilitado.", 403);
  const templates = (await database.prepare("SELECT * FROM records WHERE kind='plan_template' AND status='published'").all<Stored>()).results;
  const catalog = planCatalogFromRows(templates.map(row => ({ ...row, data: decode(row) }))), groupData = decode(group), first = rows[0] && decode(rows[0]);
  for (const row of rows) {
    const data = decode(row), feature = contentPlanFeature({ id: row.id, kind: "question", data });
    if (row.status !== "approved" || data.period !== activePeriod || !feature || !canUsePlanFeature(groupData, feature, catalog, data.plan || "Bronce", { id: row.id, kind: "question", data })) throw new PublicError("Una pregunta de esta práctica ya no está disponible para tu cuenta.", 403);
    if (!first || data.area !== first.area || data.subject !== first.subject || data.period !== first.period) throw new PublicError("La práctica debe usar preguntas de una misma área, materia y periodo.");
    if (!Array.isArray(data.options) || data.options.length !== 4 || !Number.isInteger(Number(data.correctIndex)) || Number(data.correctIndex) < 0 || Number(data.correctIndex) > 3) throw new PublicError("Una pregunta necesita revisión antes de practicar.", 409);
  }
  const sql = `EXISTS(SELECT 1 FROM profiles WHERE id=? AND role='student' AND status='active' AND group_id=?) AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='group' AND status='active' AND data_json=?) AND ${period ? "EXISTS(SELECT 1 FROM records WHERE id=? AND kind='period' AND title=? AND data_json=? AND json_extract(data_json,'$.current')=1)" : "NOT EXISTS(SELECT 1 FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1)"} AND (SELECT COUNT(*) FROM records WHERE kind='plan_template' AND status='published')=? AND NOT EXISTS(SELECT 1 FROM json_each(?) AS expected LEFT JOIN records AS template ON template.id=json_extract(expected.value,'$.id') AND template.kind='plan_template' WHERE template.id IS NULL OR template.status!='published' OR template.data_json!=json_extract(expected.value,'$.data_json')) AND NOT EXISTS(SELECT 1 FROM json_each(?) AS expected LEFT JOIN records AS question ON question.id=json_extract(expected.value,'$.id') AND question.kind='question' WHERE question.id IS NULL OR question.status!='approved' OR question.data_json!=json_extract(expected.value,'$.data_json'))`;
  const values = [actor.id, actor.group_id, group.id, group.data_json, ...(period ? [period.id, period.title, period.data_json] : []), templates.length, JSON.stringify(templates.map(row => ({ id: row.id, data_json: row.data_json }))), JSON.stringify(rows.map(row => ({ id: row.id, data_json: row.data_json })))];
  return { sql, values, activePeriod, scope: first! };
}
async function session(database: D1Database, id: string, actor: Actor) {
  const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='practice_session' AND created_by=? AND group_id=?").bind(id, actor.id, actor.group_id || "none").first<Stored>();
  if (!row) throw new PublicError("No tienes acceso a esta práctica.", 403);
  return { row, data: JSON.parse(row.data_json) as PracticeState };
}
export async function startPractice(database: D1Database, input: Record<string, unknown>, actor: Actor) {
  assertActiveStudent(actor.role, actor.status);
  if (typeof input.clientPracticeId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.clientPracticeId)) throw new PublicError("No se pudo identificar la práctica.");
  if (!Array.isArray(input.questionIds) || input.questionIds.length < 1 || input.questionIds.length > 100 || input.questionIds.some(id => !identifier(id)) || new Set(input.questionIds).size !== input.questionIds.length) throw new PublicError("Selecciona entre 1 y 100 preguntas distintas.");
  const ids = input.questionIds as string[], rows = await questions(database, ids);
  if (rows.length !== ids.length) throw new PublicError("Una pregunta ya no está disponible.", 404);
  const guard = await access(database, actor, rows), id = `practice-${(await hash(`${actor.id}\n${input.clientPracticeId}`)).slice(0, 40)}`;
  const data: PracticeState = { area: String(guard.scope.area), subject: String(guard.scope.subject), period: guard.activePeriod, startedAt: new Date().toISOString(), completedAt: null, questions: [], answers: [] };
  for (const questionId of ids) { const row = rows.find(item => item.id === questionId)!, q = decode(row); data.questions.push({ id: questionId, topic: String(q.topic || "Sin tema"), topicId: String(q.topicId || ""), format: String(q.format || "Selección directa"), revision: await hash(row.data_json) }); }
  await database.prepare(`INSERT INTO records(id,kind,title,status,data_json,group_id,created_by) SELECT ?,'practice_session',?,'in_progress',?,?,? WHERE ${guard.sql} ON CONFLICT(id) DO NOTHING`).bind(id, `Práctica · ${data.subject}`, JSON.stringify(data), actor.group_id!, actor.id, ...guard.values).run();
  const saved = await session(database, id, actor).catch(() => { throw new PublicError("La práctica o sus permisos cambiaron. Actualiza y vuelve a empezar.", 409); });
  if (JSON.stringify(saved.data.questions.map(q => q.id)) !== JSON.stringify(ids)) throw new PublicError("Esta práctica corresponde a otra selección. Empieza una nueva.", 409);
  return { practice: { id, status: saved.row.status }, progress: publicRow(saved.row) };
}
export async function savePracticeAnswer(database: D1Database, id: string, questionId: string, selectedIndex: number, actor: Actor, retry = 0): Promise<{ progress: ReturnType<typeof publicRow> }> {
  assertActiveStudent(actor.role, actor.status);
  if (!identifier(id) || !identifier(questionId)) throw new PublicError("Práctica no válida.");
  const saved = await session(database, id, actor), rows = await questions(database, saved.data.questions.map(q => q.id));
  if (rows.length !== saved.data.questions.length) throw new PublicError("Una pregunta de esta práctica ya no está disponible.", 409);
  const guard = await access(database, actor, rows);
  for (const q of saved.data.questions) if (q.revision !== await hash(rows.find(row => row.id === q.id)!.data_json)) throw new PublicError("Las preguntas cambiaron. Empieza una nueva práctica; tu avance anterior se conserva.", 409);
  const question = rows.find(row => row.id === questionId); if (!question) throw new PublicError("La pregunta no pertenece a esta práctica.", 403);
  const old = saved.data.answers.find(answer => answer.questionId === questionId);
  if (old) { if (old.selectedIndex !== selectedIndex) throw new PublicError("Esta respuesta ya se guardó. Repite la práctica para cambiarla.", 409); return { progress: publicRow(saved.row) }; }
  if (saved.row.status !== "in_progress") throw new PublicError("Esta práctica ya se completó.", 409);
  saved.data.answers.push({ questionId, selectedIndex, correct: selectedIndex === Number(decode(question).correctIndex), answeredAt: new Date().toISOString() });
  const completed = saved.data.answers.length === saved.data.questions.length; if (completed) saved.data.completedAt = new Date().toISOString();
  const changed = await database.prepare(`UPDATE records SET status=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='practice_session' AND status='in_progress' AND data_json=? AND ${guard.sql}`).bind(completed ? "completed" : "in_progress", JSON.stringify(saved.data), id, saved.row.data_json, ...guard.values).run();
  if (changed.meta.changes !== 1) { if (retry < 2) return savePracticeAnswer(database, id, questionId, selectedIndex, actor, retry + 1); throw new PublicError("La práctica cambió mientras guardabas. Vuelve a comprobar la respuesta.", 409); }
  return { progress: publicRow((await session(database, id, actor)).row) };
}
