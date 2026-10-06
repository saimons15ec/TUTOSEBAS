import { AdditionalResourceError, normalizedAdditionalResource, resourceInCurrentPeriod, type AdditionalResourceRow } from "./additional-resources.ts";
import { assertSupportContent, MAX_COURSE_LESSONS, normalizedCourseLesson } from "./courses.ts";
import { canReadPublishedSupport } from "./content-access.ts";
import { assertActiveAdministrator, assertActiveStudent } from "./security.ts";
import { type PlanCatalog } from "./plans.ts";

type Stored = { id: string; kind: string; title: string; status: string; data_json: string; created_by: string };
type Actor = { id: string; role: string; status: string; group_id?: string | null };
type VerifyFile = (key: string, ownUpload: boolean) => Promise<boolean>;
const decode = (row: Stored): AdditionalResourceRow & { data_json: string } => ({ ...row, data: JSON.parse(row.data_json) });
export async function getCourse(database: D1Database, id: string) {
  const stored = await database.prepare("SELECT id,kind,title,status,data_json,created_by FROM records WHERE id=? AND kind='course'").bind(id).first<Stored>();
  if (!stored) throw new AdditionalResourceError("Curso no encontrado.", 404);
  return { stored, course: decode(stored) };
}
async function writableCourse(database: D1Database, id: string, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const result = await getCourse(database, id);
  if (result.course.status === "archived" || !resourceInCurrentPeriod(result.course.data, period)) throw new AdditionalResourceError("Restaura el curso o selecciona uno del periodo vigente.", 409);
  return result;
}
async function getLesson(database: D1Database, id: string, courseId?: string) {
  const stored = await database.prepare("SELECT id,kind,title,status,data_json,created_by FROM records WHERE id=? AND kind='course_lesson'").bind(id).first<Stored>();
  if (!stored || (courseId && decode(stored).data.courseId !== courseId)) throw new AdditionalResourceError("Lección no encontrada en este curso.", 404);
  return { stored, lesson: decode(stored) };
}
export async function storedCourseLessons(database: D1Database, courseId: string) {
  const rows = await database.prepare("SELECT id,kind,title,status,data_json,created_by FROM records WHERE kind='course_lesson' AND json_extract(data_json,'$.courseId')=? ORDER BY json_extract(data_json,'$.order'),id").bind(courseId).all<Stored>();
  return rows.results.map(decode);
}
async function verifyContent(data: Record<string, unknown>, verifyFile: VerifyFile, own: boolean) {
  assertSupportContent(data);
  if (data.fileKey && !(await verifyFile(String(data.fileKey), own))) throw new AdditionalResourceError(own ? "El archivo debe ser una carga válida de tu cuenta." : "El archivo no tiene una referencia válida.");
}
export async function saveCourseLesson(database: D1Database, courseId: string, id: string, titleInput: unknown, input: Record<string, unknown>, period: string, actor: Actor, verifyFile: VerifyFile) {
  await writableCourse(database, courseId, period, actor);
  const title = typeof titleInput === "string" ? titleInput.trim().slice(0, 180) : "";
  if (!title) throw new AdditionalResourceError("Escribe el título de la lección.");
  const old = id ? await getLesson(database, id, courseId) : null;
  if (old && old.lesson.data.period !== period) throw new AdditionalResourceError("Las lecciones históricas se conservan en su periodo.", 409);
  if (old?.lesson.status === "archived") throw new AdditionalResourceError("Restaura la lección antes de editarla.", 409);
  if (old && input.revision !== old.lesson.data.revision) throw new AdditionalResourceError("La lección cambió. Actualiza antes de editarla.", 409);
  const data = { ...normalizedCourseLesson(input, courseId, period), revision: crypto.randomUUID() };
  await verifyContent(data, verifyFile, data.fileKey !== old?.lesson.data.fileKey);
  const others = (await storedCourseLessons(database, courseId)).filter(row => row.status !== "archived" && row.id !== id && row.data.period === period);
  if (others.length >= MAX_COURSE_LESSONS) throw new AdditionalResourceError("Cada curso admite hasta 100 lecciones activas.");
  if (others.some(row => row.data.order === data.order)) throw new AdditionalResourceError("Ese orden está ocupado. Usa otro número o mueve la lección con las flechas.");
  const lessonId = old?.stored.id || `lesson-${crypto.randomUUID()}`;
  const uniqueOrder = "NOT EXISTS (SELECT id FROM records WHERE kind='course_lesson' AND id!=? AND status!='archived' AND json_extract(data_json,'$.courseId')=? AND json_extract(data_json,'$.period')=? AND json_extract(data_json,'$.order')=?)";
  const changed = old
    ? await database.prepare("UPDATE records SET title=?,status='draft',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='course_lesson' AND data_json=? AND status=? AND " + uniqueOrder).bind(title, JSON.stringify(data), lessonId, old.stored.data_json, old.stored.status, lessonId, courseId, period, data.order).run()
    : await database.prepare("INSERT INTO records(id,kind,title,status,data_json,created_by) SELECT ?,'course_lesson',?,'draft',?,? WHERE " + uniqueOrder + " AND (SELECT COUNT(*) FROM records WHERE kind='course_lesson' AND status!='archived' AND json_extract(data_json,'$.courseId')=? AND json_extract(data_json,'$.period')=?)<100").bind(lessonId, title, JSON.stringify(data), actor.id, lessonId, courseId, period, data.order, courseId, period).run();
  if (changed.meta.changes !== 1) throw new AdditionalResourceError("El curso cambió mientras guardabas. Actualiza y vuelve a intentarlo.", 409);
  return { id: lessonId, status: "draft" };
}
export async function setCourseLessonStatus(database: D1Database, id: string, status: string, period: string, actor: Actor, verifyFile: VerifyFile) {
  assertActiveAdministrator(actor.role, actor.status);
  if (!["draft", "published", "archived"].includes(status)) throw new AdditionalResourceError("Selecciona borrador, publicado o archivado.");
  const { stored, lesson } = await getLesson(database, id);
  await writableCourse(database, String(lesson.data.courseId), period, actor);
  if (lesson.data.period !== period) throw new AdditionalResourceError("Las lecciones históricas se conservan en su periodo.", 409);
  if (lesson.status === "archived" && status !== "draft") throw new AdditionalResourceError("Restaura la lección como borrador antes de publicarla.", 409);
  if (status !== "archived") {
    const active = (await storedCourseLessons(database, String(lesson.data.courseId))).filter(row => row.id !== id && row.status !== "archived" && row.data.period === period);
    if (active.some(row => row.data.order === lesson.data.order)) throw new AdditionalResourceError("El orden está ocupado. Cambia el orden de la otra lección antes de restaurar.", 409);
    if (active.length >= MAX_COURSE_LESSONS) throw new AdditionalResourceError("Cada curso admite hasta 100 lecciones activas.");
  }
  if (status === "published") { normalizedCourseLesson(lesson.data, String(lesson.data.courseId), period); await verifyContent(lesson.data, verifyFile, false); }
  const changed = await database.prepare("UPDATE records SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='course_lesson' AND status=? AND data_json=?").bind(status, id, stored.status, stored.data_json).run();
  if (changed.meta.changes !== 1) throw new AdditionalResourceError("La lección cambió. Actualiza y vuelve a intentarlo.", 409);
  return { id, status };
}
export async function moveCourseLesson(database: D1Database, id: string, direction: unknown, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  if (direction !== "up" && direction !== "down") throw new AdditionalResourceError("Selecciona una dirección válida.");
  const { stored, lesson } = await getLesson(database, id);
  await writableCourse(database, String(lesson.data.courseId), period, actor);
  if (lesson.data.period !== period) throw new AdditionalResourceError("Las lecciones históricas se conservan en su periodo.", 409);
  const lessons = (await storedCourseLessons(database, String(lesson.data.courseId))).filter(row => row.status !== "archived" && row.data.period === period);
  const index = lessons.findIndex(row => row.id === id), other = lessons[index + (direction === "up" ? -1 : 1)];
  if (index < 0 || !other) throw new AdditionalResourceError("La lección ya está en ese extremo del curso.");
  const changed = await database.prepare("WITH checked AS MATERIALIZED (SELECT id FROM records WHERE kind='course_lesson' AND ((id=? AND data_json=? AND status=?) OR (id=? AND data_json=? AND status=?))) UPDATE records SET data_json=json_set(data_json,'$.order',CASE id WHEN ? THEN ? ELSE ? END),updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM checked) AND (SELECT COUNT(*) FROM checked)=2").bind(id, stored.data_json, lesson.status, other.id, other.data_json, other.status, id, Number(other.data.order), Number(lesson.data.order)).run();
  if (changed.meta.changes !== 2) throw new AdditionalResourceError("El orden cambió. Actualiza y vuelve a intentarlo.", 409);
  return { id };
}
export async function assertCourseReady(database: D1Database, course: AdditionalResourceRow, period: string, verifyFile: VerifyFile) {
  if (!resourceInCurrentPeriod(course.data, period)) throw new AdditionalResourceError("Publica un curso del periodo vigente.", 409);
  normalizedAdditionalResource("course", course.data, period);
  const published = (await storedCourseLessons(database, course.id)).filter(row => row.status === "published" && row.data.period === period);
  if (!course.data.fileKey && !course.data.externalUrl && !published.length) throw new AdditionalResourceError("Añade y publica al menos una lección o un archivo/enlace de apoyo antes de publicar el curso.");
  if (course.data.fileKey && !(await verifyFile(String(course.data.fileKey), false))) throw new AdditionalResourceError("El archivo de apoyo del curso no es válido.");
  for (const lesson of published) { normalizedCourseLesson(lesson.data, course.id, period); await verifyContent(lesson.data, verifyFile, false); }
}
export async function publishCourseLessons(database: D1Database, courseId: string, period: string, actor: Actor, verifyFile: VerifyFile) {
  await writableCourse(database, courseId, period, actor);
  const drafts = (await storedCourseLessons(database, courseId)).filter(row => row.status === "draft" && row.data.period === period);
  if (!drafts.length) return { id: courseId, published: 0 };
  for (const lesson of drafts) { normalizedCourseLesson(lesson.data, courseId, period); await verifyContent(lesson.data, verifyFile, false); }
  const snapshot = JSON.stringify(drafts.map(row => ({ id: row.id, dataJson: row.data_json })));
  // The validated snapshot is published atomically, or remains entirely draft.
  const changed = await database.prepare("WITH reviewed AS MATERIALIZED (SELECT r.id FROM records r JOIN json_each(?) s ON r.id=json_extract(s.value,'$.id') WHERE r.kind='course_lesson' AND r.status='draft' AND json_extract(r.data_json,'$.courseId')=? AND json_extract(r.data_json,'$.period')=? AND r.data_json=json_extract(s.value,'$.dataJson')) UPDATE records SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM reviewed) AND (SELECT COUNT(*) FROM reviewed)=?").bind(snapshot, courseId, period, drafts.length).run();
  if (changed.meta.changes !== drafts.length) throw new AdditionalResourceError("Las lecciones cambiaron durante la revisión. Actualiza y vuelve a publicar.", 409);
  return { id: courseId, published: drafts.length };
}
export async function setCourseLessonProgress(database: D1Database, id: string, completed: unknown, period: string, actor: Actor, catalog?: PlanCatalog) {
  assertActiveStudent(actor.role, actor.status);
  if (!actor.group_id || typeof completed !== "boolean") throw new AdditionalResourceError("Selecciona una lección y un estado válido.", 403);
  const { lesson } = await getLesson(database, id), { course } = await getCourse(database, String(lesson.data.courseId));
  const group = await database.prepare("SELECT data_json FROM records WHERE kind='group' AND id=?").bind(actor.group_id).first<{ data_json: string }>();
  if (!group || lesson.status !== "published" || lesson.data.period !== period || !canReadPublishedSupport(course, JSON.parse(group.data_json), period, catalog)) throw new AdditionalResourceError("Tu cuenta no tiene acceso a esta lección publicada.", 403);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${actor.id}\n${id}`));
  const progressId = `cprogress-${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
  const data = { courseId: course.id, lessonId: id, lessonRevision: lesson.data.revision, completed, completedAt: completed ? new Date().toISOString() : null };
  await database.prepare("INSERT INTO records(id,kind,group_id,title,status,data_json,created_by) VALUES(?,'course_progress',?,?,'private',?,?) ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,data_json=excluded.data_json,updated_at=CURRENT_TIMESTAMP WHERE records.kind='course_progress' AND records.created_by=excluded.created_by").bind(progressId, actor.group_id, lesson.title, JSON.stringify(data), actor.id).run();
  return { id: progressId, completed };
}
