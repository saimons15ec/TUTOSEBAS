import { normalizedNotice, saveNotice, markNoticeRead } from '@/lib/notices-storage';
import { startPractice, savePracticeAnswer } from '@/lib/practice-storage';
import { publicPracticeData, type PracticeState } from '@/lib/practice-progress';
import { admin, bucket, context, email, parse, text, uid, type RecordRow } from "@/lib/uic";
import { saveAcademicMaterial } from "@/lib/academic-materials-storage";
import { appendWorkHistory, workHistory, type WorkEvent } from "@/lib/work-history";
import { createPeriod, activatePeriod } from "@/lib/periods-storage";
import { editStudent } from "@/lib/students-storage";
import { assertActiveStudent, assertTrustedMutation, canAccessPaymentRecord, canSubmitWorkForGroup, objectKeyMatches, publicIssue, publicNoticeData, readJsonObject, validPaymentAmount } from "@/lib/security";
import { enforceRateLimit, maybeRunSecurityMaintenance, verifiedRegisteredFile, writeAudit } from "@/lib/security-storage";
import { gradeSimulatorAttempt, prepareQuestionChoices, publicAttemptQuestions, recoverableSimulatorAttempt } from "@/lib/simulators";
import { previewQuestionBlock, validateBlockContext } from "@/lib/question-blocks";
import { approveQuestionBlockRecords, saveQuestionBlock } from "@/lib/question-block-storage";
import { assertSimulatorSessionSize, simulatorQuestionQuery } from "@/lib/final-exam-blocks";
import { AcademicSelectionError, normalizedAcademicFormats } from "@/lib/academic-selection";
import { resolveAcademicRequirements, validateAllSubjectCoverage } from "@/lib/academic-selection-storage";
import { resolveFinalExamBlocks } from "@/lib/final-exam-block-storage";
import { normalizedFormatSelection } from "@/lib/academic-format-distribution";
import { AdditionalResourceError, normalizedAdditionalResource, resourceCategory, resourceInCurrentPeriod, resourceSections } from "@/lib/additional-resources";
import { replaceAdditionalResourceContent, setAdditionalResourceReference, updateAdditionalResource } from "@/lib/additional-resources-storage";
import { archiveResourceSection, assertActiveResourceSection, moveResourceSection, resourceSectionGuard, restoreResourceSection, saveResourceSection } from "@/lib/resource-sections-storage";
import { canReadPublishedSupport } from "@/lib/content-access";
import { assertSupportContent } from "@/lib/courses";
import { assertCourseReady, moveCourseLesson, publishCourseLessons, saveCourseLesson, setCourseLessonProgress, setCourseLessonStatus } from "@/lib/courses-storage";
import { removeAcademicSubject, restoreAcademicSubject } from "@/lib/subjects-storage";
import { AcademicTopicError, academicScope, topicMatches } from "@/lib/academic-topics";
import { resolveAcademicTopic, saveAcademicTopic, synchronizeAcademicTopics } from "@/lib/academic-topics-storage";
import { canUsePlanFeature, contentPlanFeature, groupReviewLimit, type PlanCatalog } from "@/lib/plans";
import { activateGroupPlan, loadPlanCatalog, saveGroupPermissions, savePlanTemplate } from "@/lib/plans-storage";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
const unpack = (row: RecordRow) => { const { data_json, ...metadata } = row; return { ...metadata, data: parse<Record<string, unknown>>(data_json, {}) }; };
const defaultComplexiveSubjects = ["Fundamentos de Lengua y Literatura","Didáctica de la Lengua y la Literatura","Lectura y Escritura Académica"];
const questionFormats = ["Selección directa","Completar","Relacionar","Ordenar","Caso práctico"];

function secureShuffle<T>(values: T[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
    const target = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

async function verifiedUpload(database: D1Database, key: string, kind: "material" | "review" | "submission" | "payment", groupId: string, uploadedBy?: string) {
  if (!objectKeyMatches(key, kind, groupId)) return false;
  const registered = await verifiedRegisteredFile(database, key, kind, groupId, uploadedBy);
  if (registered === false) return false;
  const object = await bucket().head(key);
  return Boolean(object && (!uploadedBy || object.customMetadata?.uploadedBy === uploadedBy));
}

export async function GET() {
  try {
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    const { database, profile, user } = current;
    const periodRow = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title:string }>();
    const activePeriod = periodRow?.title || "2026-2027";
    if (profile.status !== "active") return Response.json({ authorized: false, accessMethod: user.method || "sites", profile, identity: user, records: [], profiles: [], activePeriod }, { headers: { "cache-control": "private, no-store" } });
    await enforceRateLimit(database, profile.id, "platform:read");
    const plans = await loadPlanCatalog(database);
    const recordResult = profile.role === "admin"
      ? await database.prepare("SELECT * FROM records ORDER BY updated_at DESC").all<RecordRow>()
      : await database.prepare("SELECT * FROM records WHERE (group_id IS NULL AND (status='published' OR (kind='question' AND status='approved'))) OR (group_id=? AND (kind='submission' OR (kind='payment' AND ?='coordinator') OR status='published' OR (kind='attempt' AND created_by=?))) OR (kind='group' AND id=?) OR (kind IN ('course_progress','practice_session') AND created_by=?) OR (kind='resource_section' AND json_extract(data_json,'$.period')=?) ORDER BY updated_at DESC").bind(profile.group_id ?? "none", profile.member_role, profile.id, profile.group_id ?? "none", profile.id, activePeriod).all<RecordRow>();
    const profiles = profile.role === "admin"
      ? (await database.prepare("SELECT * FROM profiles ORDER BY created_at DESC").all()).results
      : profile.group_id ? (await database.prepare("SELECT id,email,full_name,status,group_id,member_role FROM profiles WHERE group_id=? ORDER BY CASE member_role WHEN 'coordinator' THEN 0 ELSE 1 END,full_name").bind(profile.group_id).all()).results : [];
    let accessibleRecords = recordResult.results.map(unpack);
    if (profile.role !== "admin") {
      const group = accessibleRecords.find((row) => row.kind === "group" && row.id === profile.group_id);
      const groupData = group?.data ?? {};
      const sections = resourceSections(accessibleRecords, activePeriod);
      const candidateRecords = accessibleRecords;
      accessibleRecords = accessibleRecords.filter((row) => {
        if (row.kind === "resource_section") return row.data.period === activePeriod && ["published", "archived"].includes(row.status);
        if (row.kind === "plan_template") return false;
        if (row.kind === "practice_session") return row.created_by === profile.id;
        if (["question_block", "course_lesson", "course_progress"].includes(row.kind)) return false;
        const academicResource = row.kind === "resource" && ["complexive","final_degree"].includes(String(row.data.area ?? ""));
        if ((academicResource || ["question","simulator","subject","topic"].includes(row.kind)) && String(row.data.period ?? "") !== activePeriod) return false;
        if (["resource","course"].includes(row.kind)) {
          if (!profile.group_id || !canReadPublishedSupport(row, groupData, activePeriod, plans, sections)) return false;
          // Preserve legacy course records without advertising empty, synthetic outlines.
          return row.kind !== "course" || Boolean(row.data.fileKey || row.data.externalUrl) || candidateRecords.some(lesson => lesson.kind === "course_lesson" && lesson.status === "published" && lesson.data.period === activePeriod && lesson.data.courseId === row.id);
        }
        if (!['resource','course','question','simulator'].includes(row.kind)) return true;
        const feature = contentPlanFeature(row, sections);
        return Boolean(profile.group_id && feature && canUsePlanFeature(groupData, feature, plans, row.data.plan ?? (row.kind === "simulator" ? "Plata" : "Bronce"), row));
      });
      const allowedCourses = new Set(accessibleRecords.filter(row => row.kind === "course" && row.status === "published").map(row => row.id));
      const lessons = candidateRecords.filter(row => row.kind === "course_lesson" && row.status === "published" && row.data.period === activePeriod && allowedCourses.has(String(row.data.courseId)));
      const allowedLessons = new Map(lessons.map(row => [row.id, row]));
      const progress = candidateRecords.filter(row => row.kind === "course_progress" && row.created_by === profile.id && allowedLessons.get(String(row.data.lessonId))?.data.courseId === row.data.courseId);
      accessibleRecords.push(...lessons, ...progress);
      accessibleRecords = accessibleRecords.map((row) => {
        if (row.kind === "notice") return { ...row, data: publicNoticeData(row.data, profile.id) };
        if (row.kind === "practice_session") return { ...row, data: publicPracticeData(row.data as PracticeState) };
        const {subjectArchive:_subjectArchive,subjectRevision:_subjectRevision,subjectRemoval:_subjectRemoval,subjectRemovalHistory:_subjectRemovalHistory,...studentData}=row.data;
        void _subjectArchive;void _subjectRevision;void _subjectRemoval;void _subjectRemovalHistory;row={...row,data:studentData};
        if (row.kind === "resource") { const { materialVersions: _materialVersions, ...safeData } = row.data; void _materialVersions; return { ...row, data: safeData }; }
        if (row.kind !== "question") return row;
        const { correctIndex: _correctIndex, explanation: _explanation, ...safeData } = row.data;
        void _correctIndex;
        void _explanation;
        return { ...row, data: safeData };
      });
    }
    const records = accessibleRecords.filter((row) => row.kind !== "payment" || canAccessPaymentRecord(profile.role, profile.member_role));
    return Response.json({ authorized: true, accessMethod: user.method || "sites", identity: user, profile, records, profiles, activePeriod, plans }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { const issue = publicIssue(error, "No se pudo abrir la plataforma."); return fail(issue.message, issue.status); }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    const { database, profile } = current;
    if (profile.status !== "active") return fail("Tu cuenta todavía no está habilitada.", 403);
    const body = await readJsonObject(request);
    const action = text(body.action, 40);
    let planCatalogPromise: Promise<PlanCatalog> | undefined;
    const plans = () => planCatalogPromise ??= loadPlanCatalog(database);
    await enforceRateLimit(database, profile.id, "platform:all");
    await enforceRateLimit(database, profile.id, action || "platform:unknown");
    await maybeRunSecurityMaintenance(database);
    const audit = (eventAction: string, targetKind?: string | null, targetId?: string | null, metadata?: Record<string, string | number | boolean | null>) => writeAudit(database, {
      actorId: profile.id,
      actorRole: profile.role,
      action: eventAction,
      targetKind,
      targetId,
      metadata,
    });
    if (action === "create_period" || (action === "create_record" && body.kind === "period")) {
      admin(profile); const result = await createPeriod(database, { title: body.title, note: body.note ?? (body.data as Record<string, unknown> | undefined)?.note }, profile);
      await audit("period_created", "period", result.id); return Response.json({ ok: true, ...result });
    }
    if (action === "activate_period") {
      admin(profile); const result = await activatePeriod(database, body, profile);
      await audit("period_activated", "period", result.id, { period: result.period }); return Response.json({ ok: true, ...result });
    }
    const writablePeriodRow = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
    const writablePeriod = writablePeriodRow?.title || "2026-2027";
    const subjectExists = async (area: string, subject: string) => {
      const archived = await database.prepare("SELECT id FROM records WHERE kind='subject' AND status='archived' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? LIMIT 1").bind(subject, area, writablePeriod).first();
      if (archived) return false;
      if (area === "complexive" && defaultComplexiveSubjects.some((item) => item.toLocaleLowerCase("es") === subject.toLocaleLowerCase("es"))) return true;
      const managed = await database.prepare("SELECT id FROM records WHERE kind='subject' AND status='published' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? LIMIT 1").bind(subject, area, writablePeriod).first();
      if (managed) return true;
      const inUse = await database.prepare("SELECT id FROM records WHERE kind IN ('resource','question','simulator') AND status!='archived' AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? LIMIT 1").bind(subject, area, writablePeriod).first();
      return Boolean(inUse);
    };
    const linkedQuestionResource = async (area: string, subject: string, resourceId: string, requirePublished = false) => {
      if (!resourceId) return { row: null, data: null, error: "" };
      const row = await database.prepare("SELECT id,title,status,data_json FROM records WHERE id=? AND kind='resource' LIMIT 1").bind(resourceId).first<{ id: string; title: string; status: string; data_json: string }>();
      if (!row) return { row: null, data: null, error: "El material de origen ya no está disponible." };
      const resourceData = parse<Record<string, unknown>>(row.data_json, {});
      if (text(resourceData.area, 40) !== area || text(resourceData.subject, 180).toLocaleLowerCase("es") !== subject.toLocaleLowerCase("es")) return { row: null, data: null, error: "El material de origen debe pertenecer a la misma área y materia de la pregunta." };
      if (resourceData.period !== writablePeriod) return { row: null, data: null, error: "El material de origen debe pertenecer al periodo vigente." };
      if (requirePublished && row.status !== "published") return { row: null, data: null, error: "Publica el material de origen antes de aprobar esta pregunta." };
      return { row, data: resourceData, error: "" };
    };
    const normalizeSimulator = async (input: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; error?: string }> => {
      const data = { ...input };
      if (data.period && data.period !== writablePeriod) return { error: "Configura el simulador en el periodo vigente; el histórico se conserva." };
      const area = text(data.area, 40);
      const subject = text(data.subject, 180) || "General";
      const requestedMode = text(data.mode, 20);
      const mode = requestedMode === "final" || ["General", "23 materias"].includes(subject) ? "final" : "subject";
      if (!["final_degree", "complexive"].includes(area)) return { error: "Selecciona un área válida." };
      try { data.formats = normalizedAcademicFormats(data.formats); }
      catch (error) { return { error: error instanceof AcademicSelectionError ? error.message : "Revisa los formatos." }; }
      if (data.coverAllSubjects !== undefined && typeof data.coverAllSubjects !== "boolean") return { error: "Revisa la cobertura de materias." };

      const finish = () => { try { Object.assign(data, normalizedFormatSelection(data)); return { data }; } catch (error) { return { error: error instanceof AcademicSelectionError ? error.message : "Revisa el reparto por formatos." }; } };
      if (mode === "subject") {
        const count = Number(data.count);
        if (!(await subjectExists(area, subject))) return { error: "Selecciona una materia del catálogo." };
        if (!Number.isInteger(count) || count < 5 || count > 100) return { error: "El simulador por materia debe tener entre 5 y 100 preguntas." };
        const topics = data.topics === undefined ? [] : data.topics;
        if (!Array.isArray(topics) || topics.length > 30 || topics.some(topic => typeof topic !== "string" || !topic.trim() || topic.length > 180)) return { error: "Selecciona hasta 30 temas válidos." };
        data.topics = [...new Set(topics.map(topic => (topic as string).trim()))];
        if (data.topicCoverage !== undefined && !["balanced", "pool"].includes(String(data.topicCoverage))) return { error: "Selecciona reparto por temas o sorteo del banco completo." };
        data.topicCoverage = data.topicCoverage || "pool";
        data.coverAllSubjects = false;
        Object.assign(data, { area, mode, subject, count, distribution: [], blockDistribution: [], selectionMode: "subjects", period: text(data.period, 40) || writablePeriod });
        return finish();
      }
      if (data.selectionMode === "blocks") {
        const period = text(data.period, 40) || writablePeriod;
        let entries;
        try { entries = await resolveFinalExamBlocks(database, data.blockDistribution, area, period, area === "complexive" ? defaultComplexiveSubjects : []); }
        catch (error) { return { error: error instanceof Error ? error.message : "Revisa los bloques seleccionados." }; }
        Object.assign(data, { area, mode: "final", subject: "General", topics: [], selectionMode: "blocks", blockDistribution: entries, distribution: [], period, count: entries.reduce((sum, item) => sum + item.count, 0) });
        return finish();
      }
      if (data.selectionMode !== undefined && data.selectionMode !== "subjects") return { error: "Selecciona distribución por materias o por bloques." };
      const raw = Array.isArray(data.distribution) ? data.distribution : [];
      if (raw.length > 30) return { error: "El examen admite hasta 30 materias." };
      const distribution: Array<{ subject: string; count: number }> = [];
      const seen = new Set<string>();
      for (const item of raw) {
        if (!item || typeof item !== "object") return { error: "Revisa la distribución del examen final." };
        const entry = item as Record<string, unknown>;
        const itemSubject = text(entry.subject, 180);
        const itemCount = Number(entry.count);
        if (!itemSubject || seen.has(itemSubject.toLocaleLowerCase("es"))) return { error: "Cada materia debe aparecer una sola vez en el examen final." };
        if (!(await subjectExists(area, itemSubject))) return { error: `La materia ${itemSubject} no pertenece al catálogo.` };
        if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 100) return { error: "Cada materia del examen final debe aportar entre 1 y 100 preguntas." };
        seen.add(itemSubject.toLocaleLowerCase("es"));
        distribution.push({ subject: itemSubject, count: itemCount });
      }
      if (!distribution.length) return { error: "Selecciona al menos una materia para el examen final." };
      if (distribution.reduce((sum, item) => sum + item.count, 0) > 200) return { error: "El examen final admite hasta 200 preguntas en total." };
      Object.assign(data, { area, mode: "final", subject: "General", topics: [], selectionMode: "subjects", blockDistribution: [], distribution, count: distribution.reduce((sum, item) => sum + item.count, 0), period: text(data.period, 40) || writablePeriod });
      return finish();
    };
    const authorizeStudentRecord = async (recordId: string, kind: "question" | "simulator", data: Record<string, unknown>) => {
      if (profile.role !== "student" || !profile.group_id) return { error: "Solo una cuenta estudiantil activa puede realizar esta acción.", status: 403 };
      const periodRow = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title:string }>();
      const activePeriod = periodRow?.title || "2026-2027";
      if (text(data.period, 40) !== activePeriod) return { error: "Este contenido pertenece a un periodo histórico y no está disponible en el periodo vigente.", status: 403 };
      const group = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(profile.group_id).first<RecordRow>();
      if (!group) return { error: "Tu grupo no está disponible.", status: 403 };
      const groupData = parse<Record<string, unknown>>(group.data_json, {});
      const requiredPlan = text(data.plan, 20) || (kind === "simulator" ? "Plata" : "Bronce");
      const content = { id: recordId, kind, data }, feature = contentPlanFeature(content);
      if (!feature || !canUsePlanFeature(groupData, feature, await plans(), requiredPlan, content)) return { error: kind === "simulator" ? "Tu plan no incluye este simulador." : "Tu plan no incluye esta pregunta.", status: 403 };
      return { groupId: profile.group_id, activePeriod, error: "", status: 200 };
    };

    if (action === "sync_academic_topics" || action === "save_academic_topic") {
      admin(profile);
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      const period = active?.title || "2026-2027";
      if (action === "sync_academic_topics") {
        const result = await synchronizeAcademicTopics(database, period, profile.id);
        if (result.created || result.updated) await audit("academic_topics_organized", "topic", null, result);
        return Response.json({ ok: true, ...result });
      }
      const scope = academicScope({ area: body.area, subject: body.subject, period: body.period });
      if (scope.period !== period) return fail("Organiza los temas del periodo vigente; el historial se conserva.", 409);
      if (!(await subjectExists(scope.area, scope.subject))) return fail("Selecciona una materia activa del catálogo.");
      const result = await saveAcademicTopic(database, scope, { id: body.id, number: body.number, name: body.name }, profile.id);
      await audit("academic_topic_saved", "topic", result.topic.id, { area: scope.area, number: result.topic.number, updated: result.updated });
      return Response.json({ ok: true, id: result.topic.id, updated: result.updated });
    }

    if (action === "import_question_block") {
      admin(profile);
      const normalized = validateBlockContext(body.context);
      if (!normalized.context) return fail(normalized.errors.join(" "));
      const block = normalized.context;
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      if (block.period !== (active?.title || "2026-2027")) return fail("Importa el bloque en el periodo vigente. Los periodos anteriores conservan su historial.", 409);
      if (!(await subjectExists(block.area, block.subject))) return fail("Selecciona una materia activa del catálogo.");
      const linked = await linkedQuestionResource(block.area, block.subject, block.sourceResourceId);
      if (linked.error) return fail(linked.error);
      if (linked.data && text(linked.data.period, 40) !== block.period) return fail("El material de origen debe pertenecer al mismo periodo del bloque.");
      const preview = previewQuestionBlock(Array.isArray(body.questions) ? body.questions : [], block);
      if (preview.errors.length || preview.invalid) return fail([...preview.errors, ...preview.rows.flatMap(row => row.errors.map(error => `Fila ${row.row}: ${error}`))].slice(0, 8).join(" "));
      const topic = await resolveAcademicTopic(database, academicScope(block), block, profile.id);
      if (linked.data && !topicMatches(linked.data, topic)) return fail("El material de origen debe pertenecer al mismo tema del bloque.");
      Object.assign(block, { topicId: topic.id, topic: topic.title });
      const metadata: Record<string, string> = linked.row && linked.data ? {
        sourceMaterialTitle: linked.row.title, sourceMaterialType: text(linked.data.materialType, 40) || "Material", sourceMaterialTopic: text(linked.data.topic, 180),
        plan: text(linked.data.plan, 20) || block.plan,
      } : {};
      const result = await saveQuestionBlock(database, block, preview.questions, profile.id, metadata);
      if (result.conflict) return fail("Una pregunta ya fue registrada en esta materia y periodo. Actualiza el banco, vuelve a revisar la vista previa y omite las repetidas. No se guardó parte del bloque.", 409);
      await audit(result.reused ? "question_block_reused" : "question_block_imported", "question_block", result.blockId, { count: result.count, area: block.area });
      return Response.json({ ok: true, ...result });
    }

    if (action === "approve_question_block") {
      admin(profile);
      if (body.reviewed !== true) return fail("Confirma que revisaste todas las preguntas del bloque.");
      const id = text(body.id, 100);
      const block = await database.prepare("SELECT * FROM records WHERE id=? AND kind='question_block' AND status!='archived'").bind(id).first<RecordRow>();
      if (!block) return fail("Bloque no encontrado.", 404);
      const normalized = validateBlockContext({ ...parse<Record<string, unknown>>(block.data_json, {}), title: block.title, format: "Selección directa", source: "" });
      if (!normalized.context) return fail("Revisa la organización del bloque.");
      const blockContext = normalized.context;
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      if (blockContext.period !== (active?.title || "2026-2027") || !(await subjectExists(blockContext.area, blockContext.subject))) return fail("El bloque debe pertenecer a una materia activa y al periodo vigente.", 409);
      const result = await database.prepare("SELECT * FROM records WHERE kind='question' AND json_extract(data_json,'$.importBlockId')=?").bind(id).all<RecordRow>();
      if (!result.results.length || result.results.some(row => ["rewrite", "archived"].includes(row.status))) return fail("Hay preguntas para reformular o archivadas. Revisa y aprueba esas preguntas individualmente antes de aprobar el bloque.", 409);
      const preview = previewQuestionBlock(result.results.map(row => parse<Record<string, unknown>>(row.data_json, {})), blockContext);
      if (preview.invalid || preview.errors.length) return fail("Hay preguntas incompletas. Revisa alternativas, clave, contexto, explicación y fuente.");
      const resourceIds = [...new Set(result.results.map(row => text(parse<Record<string, unknown>>(row.data_json, {}).sourceResourceId, 100)).filter(Boolean))];
      for (const resourceId of resourceIds) {
        const linked = await linkedQuestionResource(blockContext.area, blockContext.subject, resourceId, true);
        if (linked.error) return fail(linked.error);
        if (text(linked.data?.period, 40) !== blockContext.period) return fail("El material de origen debe pertenecer al periodo del bloque.");
      }
      if (!(await approveQuestionBlockRecords(database, id))) return fail("El bloque cambió durante la revisión. Actualiza el banco y revisa sus preguntas y materiales antes de aprobarlo.", 409);
      await audit("question_block_approved", "question_block", id, { count: result.results.length });
      return Response.json({ ok: true, count: result.results.length });
    }

    if (action === "update_question") {
      admin(profile);
      const id = text(body.id, 100);
      const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='question' AND status!='archived'").bind(id).first<RecordRow>();
      if (!row) return fail("Pregunta no encontrada.", 404);
      const saved = parse<Record<string, unknown>>(row.data_json, {});
      const normalized = validateBlockContext({ ...saved, title: row.title, format: saved.format || "Selección directa", sourceResourceId: saved.sourceResourceId || "", source: saved.source || "", plan: saved.plan || "Bronce" });
      if (!normalized.context) return fail("Revisa materia, tema y periodo de esta pregunta.");
      const blockContext = normalized.context;
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      if (blockContext.period !== (active?.title || "2026-2027") || !(await subjectExists(blockContext.area, blockContext.subject))) return fail("Solo puedes editar preguntas de una materia activa del periodo vigente.", 409);
      const input = body.question && typeof body.question === "object" && !Array.isArray(body.question) ? body.question as Record<string, unknown> : {};
      const preview = previewQuestionBlock([{ ...input, importRow: saved.importRow || 1 }], blockContext);
      if (preview.invalid || preview.errors.length) return fail(preview.rows.flatMap(item => item.errors).join(" ") || "Revisa los campos de la pregunta.");
      const duplicate = await database.prepare("SELECT id,data_json FROM records WHERE id!=? AND kind='question' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.subject')=? AND json_extract(data_json,'$.period')=?").bind(id, blockContext.area, blockContext.subject, blockContext.period).all<{ id: string; data_json: string }>();
      if (previewQuestionBlock([preview.questions[0]], blockContext, duplicate.results.map(item => parse<Record<string, unknown>>(item.data_json, {}))).duplicates) return fail("Ya existe ese enunciado y contexto en la materia y periodo.", 409);
      const statements = [database.prepare("UPDATE records SET status='pending',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='question' AND status!='archived'").bind(JSON.stringify({ ...saved, ...preview.questions[0] }), id)];
      const blockId = text(saved.importBlockId, 100);
      if (blockId) statements.push(database.prepare("UPDATE records SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='question_block' AND status!='archived'").bind(blockId));
      await database.batch(statements);
      await audit("question_updated", "question", id);
      return Response.json({ ok: true, id });
    }

    if (action === "create_group") {
      admin(profile); const title = text(body.title, 100); const code = text(body.code, 24).toUpperCase(); if (!title || !code) return fail("Completa nombre y código.");
      const duplicate = await database.prepare("SELECT id FROM records WHERE kind='group' AND json_extract(data_json,'$.code')=? LIMIT 1").bind(code).first(); if (duplicate) return fail("Ese código ya existe.");
      const id = uid("grp"); await database.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'group',?,'active',?,?)").bind(id, title, JSON.stringify({ code, plan: "Sin plan", planStatus: "pending", startsAt: null, endsAt: null, permissions: [] }), profile.id).run(); await audit("group_created", "group", id); return Response.json({ ok: true, id });
    }

    if (action === "edit_student") {
      const result = await editStudent(database, body, profile);
      await audit("student_edited", "profile", result.id);
      return Response.json({ ok: true, ...result });
    }
    if (action === "invite_student") {
      admin(profile); const fullName = text(body.fullName, 120); const mail = email(body.email); const groupId = text(body.groupId, 100) || null; const memberRole = body.memberRole === "coordinator" ? "coordinator" : "member"; if (!fullName) return fail("Escribe el nombre.");
      const found = await database.prepare("SELECT id FROM profiles WHERE lower(email)=? LIMIT 1").bind(mail).first<{ id: string }>(); const id = found?.id ?? uid("usr");
      if (groupId) {
        const group = await database.prepare("SELECT id FROM records WHERE id=? AND kind='group'").bind(groupId).first(); if (!group) return fail("El grupo no existe.");
        const size = await database.prepare("SELECT COUNT(*) AS total FROM profiles WHERE group_id=? AND id!=?").bind(groupId, id).first<{ total: number }>(); if ((size?.total ?? 0) >= 3) return fail("El grupo ya tiene tres integrantes.");
        if (memberRole === "coordinator") { const coordinator = await database.prepare("SELECT id FROM profiles WHERE group_id=? AND member_role='coordinator' AND id!=? LIMIT 1").bind(groupId, id).first(); if (coordinator) return fail("Ese grupo ya tiene coordinador."); }
      }
      if (found) await database.prepare("UPDATE profiles SET full_name=?,identifier_last4=?,group_id=?,member_role=?,status=CASE WHEN status IN ('active','suspended') THEN status ELSE 'invited' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(fullName, text(body.identifierLast4, 4).replace(/\D/g, "") || null, groupId, memberRole, id).run();
      else await database.prepare("INSERT INTO profiles (id,email,full_name,role,status,identifier_last4,group_id,member_role) VALUES (?,?,?,'student','invited',?,?,?)").bind(id, mail, fullName, text(body.identifierLast4, 4).replace(/\D/g, "") || null, groupId, memberRole).run();
      await audit(found ? "student_updated" : "student_invited", "profile", id, { groupId, memberRole });
      return Response.json({ ok: true, id });
    }

    if (action === "set_user_status") { admin(profile); const status = text(body.status, 20); const id = text(body.id, 100); if (!["active","invited","pending","suspended"].includes(status)) return fail("Estado no válido."); await database.prepare("UPDATE profiles SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role!='admin'").bind(status, id).run(); if (status === "suspended") await database.prepare("DELETE FROM auth_sessions WHERE profile_id=?").bind(id).run(); await audit("student_status_changed", "profile", id, { status }); return Response.json({ ok: true }); }

    if (["save_plan_template", "save_group_permissions", "activate_plan"].includes(action)) {
      admin(profile);
      const id = text(body.id, 100);
      const result = action === "save_plan_template" ? await savePlanTemplate(database, body, profile) : action === "save_group_permissions" ? await saveGroupPermissions(database, id, body, profile) : await activateGroupPlan(database, id, body, profile);
      await audit(action, action === "save_plan_template" ? "plan_template" : "group", result.id);
      return Response.json({ ok: true, ...result });
    }

    if (["save_course_lesson", "set_course_lesson_status", "move_course_lesson", "set_course_lesson_progress", "publish_course_lessons"].includes(action)) {
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      const period = active?.title || "2026-2027", id = text(body.id, 100);
      const verifyFile = (key: string, own: boolean) => verifiedUpload(database, key, "material", "shared", own ? profile.id : undefined);
      let result;
      if (action === "set_course_lesson_progress") result = await setCourseLessonProgress(database, id, body.completed, period, profile, await plans());
      else {
        admin(profile);
        if (action === "save_course_lesson") result = await saveCourseLesson(database, text(body.courseId, 100), id, body.title, body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {}, period, profile, verifyFile);
        else if (action === "publish_course_lessons") result = await publishCourseLessons(database, text(body.courseId, 100), period, profile, verifyFile);
        else if (action === "set_course_lesson_status") result = await setCourseLessonStatus(database, id, text(body.status, 30), period, profile, verifyFile);
        else result = await moveCourseLesson(database, id, body.direction, period, profile);
      }
      await audit(action, action === "set_course_lesson_progress" ? "course_progress" : "course_lesson", result.id);
      return Response.json({ ok: true, ...result });
    }

    if (["save_resource_section", "move_resource_section", "archive_resource_section", "restore_resource_section"].includes(action)) {
      admin(profile);
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      const period = active?.title || "2026-2027";
      let result;
      if (action === "save_resource_section") result = await saveResourceSection(database, body, period, profile);
      else if (action === "move_resource_section") result = await moveResourceSection(database, body.sectionId, body.direction, body.revision, period, profile);
      else if (action === "archive_resource_section") result = await archiveResourceSection(database, body.sectionId, body.targetSectionId, body.revision, period, profile);
      else result = await restoreResourceSection(database, body.sectionId, body.revision, period, profile);
      await audit(action, "resource_section", result.id);
      return Response.json({ ok: true, ...result });
    }

    if (action === "save_academic_material") {
      admin(profile);
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      const result = await saveAcademicMaterial(database, body, active?.title || "2026-2027", profile, key => verifiedUpload(database, key, "material", "shared", profile.id));
      await audit("academic_material_updated", "resource", result.id, { questionsToReview: result.questionsToReview });
      return Response.json({ ok: true, ...result });
    }
    if (action === "update_additional_resource" || action === "set_additional_reference" || action === "replace_additional_content") {
      admin(profile);
      const id = text(body.id, 100);
      if (action === "set_additional_reference") {
        const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        const result = await setAdditionalResourceReference(database, id, body.category, active?.title || "2026-2027", profile);
        await audit("additional_reference_changed", "resource", id, { category: result.category });
        return Response.json({ ok: true, ...result });
      }
      const input = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {};
      if (action === "replace_additional_content") {
        const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        const result = await replaceAdditionalResourceContent(database, id, input, active?.title || "2026-2027", profile, key => verifiedUpload(database, key, "material", "shared", profile.id));
        await audit("additional_content_replaced", "resource", id);
        return Response.json({ ok: true, ...result });
      }
      const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
      const result = await updateAdditionalResource(database, id, body.title, input, profile, active?.title || "2026-2027");
      await audit("additional_resource_updated", "resource", id);
      return Response.json({ ok: true, ...result });
    }

    if (action === "create_record") {
      admin(profile);
      const allowed = ["resource","course","question","simulator","notice","subject"];
      const kind = text(body.kind, 30);
      if (!allowed.includes(kind)) return fail("Tipo de contenido no válido.");
      let title = text(body.title, 180);
      if (!title) return fail("Escribe un título.");
      const id = uid(kind);
      let sectionWrite: { period: string; category: string } | null = null;
      let status = text(body.status, 30) || "draft";
      let data = typeof body.data === "object" && body.data ? body.data as Record<string, unknown> : {};
      if (kind === "course" || (kind === "resource" && !["complexive","final_degree"].includes(String(data.area)))) {
        if (kind === "resource" && data.area && data.area !== "resources") return fail("Selecciona un área válida para el recurso.");
        const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        const period = active?.title || "2026-2027";
        await assertActiveResourceSection(database, data.category ?? (kind === "course" ? "courses" : "other"), period, kind);
        data = normalizedAdditionalResource(kind, data, period);
        sectionWrite = { period, category: String(data.category) };
        if (data.fileKey && !(await verifiedUpload(database, String(data.fileKey), "material", "shared", profile.id))) return fail("El archivo debe ser una carga válida de tu cuenta.");
        status = "draft";
      }
      if (kind === "notice") {
        const normalized=normalizedNotice(body.title,data);title=normalized.title;data=normalized.data;
        if(!["draft","published"].includes(status))return fail("Guarda el aviso como borrador o publicado.");
      }
      if (kind === "subject") {
        const area = text(data.area, 40);
        if (!["final_degree","complexive"].includes(area)) return fail("Selecciona un área académica válida.");
        data.area = area;
        if (data.period && data.period !== writablePeriod) return fail("Gestiona las materias del periodo vigente.", 409);
        data.period = writablePeriod; status = "published";
        const existing = await database.prepare("SELECT id,status FROM records WHERE kind='subject' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? LIMIT 1").bind(title, area, writablePeriod).first<{ id: string; status: string }>();
        if (existing?.status === "archived") return fail("La materia está archivada. Usa Restaurar en Gestionar materias.",409);
        if (existing || (area === "complexive" && defaultComplexiveSubjects.some((item) => item.toLocaleLowerCase("es") === title.toLocaleLowerCase("es")))) return fail("Esa materia ya existe.");
      }
      if (kind === "resource" && ["complexive","final_degree"].includes(text(data.area, 40))) {
        const materialTypes = ["Documento","Resumen","Infografía","Audio","Video","Presentación","Guía de estudio"];
        const materialType = text(data.materialType, 40);
        const subject = text(data.subject, 180);
        const topic = text(data.topic, 180);
        if (!materialTypes.includes(materialType)) return fail("Selecciona un tipo de material válido.");
        if (!subject || !topic) return fail("La materia y el tema son obligatorios.");
        if (!(await subjectExists(text(data.area, 40), subject))) return fail("Selecciona una materia del catálogo.");
        if (materialType === "Video") {
          const externalUrl = text(data.externalUrl, 1000);
          try {
            const parsed = new URL(externalUrl);
            if (!['http:','https:'].includes(parsed.protocol)) return fail("El enlace del video no es válido.");
            data.externalUrl = parsed.toString();
          } catch { return fail("El enlace del video no es válido."); }
        }
        if (materialType !== "Video") {
          const fileKey = text(data.fileKey, 400);
          if (!fileKey) return fail(materialType === "Audio" ? "Adjunta el archivo de audio." : "Adjunta el archivo del material.");
          if (!(await verifiedUpload(database, fileKey, "material", "shared", profile.id))) return fail("El archivo del material no tiene una referencia válida.");
          data.fileKey = fileKey;
        }
      }
      if (kind === "question") {
        const area = text(data.area, 40);
        const subject = text(data.subject, 180);
        const topic = text(data.topic, 180);
        const prompt = text(data.prompt, 2000);
        const source = text(data.source, 500);
        const explanation = text(data.explanation, 2000);
        const format = text(data.format, 60);
        const caseContext = text(data.caseContext, 4000);
        const sourceResourceId = text(data.sourceResourceId, 100);
        const options = Array.isArray(data.options) ? data.options.map((option) => text(option, 500)).filter(Boolean) : [];
        const correctIndex = data.correctIndex;
        if (!["final_degree","complexive"].includes(area)) return fail("Selecciona un área válida.");
        if (!(await subjectExists(area, subject))) return fail("Selecciona una materia del catálogo.");
        if (!questionFormats.includes(format)) return fail("Selecciona un formato válido para el área.");
        if (!subject || !topic || !prompt || !source || !explanation || options.length !== 4 || typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("Completa materia, tema, enunciado, cuatro alternativas, respuesta, explicación y fuente.");
        if (format === "Caso práctico" && !caseContext) return fail("Describe el contexto del caso práctico.");
        if (sourceResourceId) {
          const linked = await linkedQuestionResource(area, subject, sourceResourceId);
          if (linked.error || !linked.row || !linked.data) return fail(linked.error || "No se pudo validar el material de origen.");
          Object.assign(data, {
            sourceResourceId,
            sourceMaterialTitle: linked.row.title,
            sourceMaterialType: text(linked.data.materialType, 40) || "Material",
            sourceMaterialTopic: text(linked.data.topic, 180),
            period: text(linked.data.period, 40) || text(data.period, 40) || "2026-2027",
            plan: text(linked.data.plan, 20) || text(data.plan, 20) || "Bronce",
          });
        } else {
          delete data.sourceResourceId;
        }
      }
      if (kind === "simulator") {
        const normalized = await normalizeSimulator(data);
        if (normalized.error || !normalized.data) return fail(normalized.error || "Revisa la configuración del simulador.");
        Object.assign(data, normalized.data);
      }
      if ((kind === "resource" || kind === "question") && ["complexive","final_degree"].includes(String(data.area))) {
        const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        data.period = text(data.period, 40) || active?.title || "2026-2027";
        if (data.period !== (active?.title || "2026-2027")) return fail("Carga el contenido en el periodo vigente.", 409);
        const topic = await resolveAcademicTopic(database, academicScope(data), data, profile.id);
        if (kind === "question" && data.sourceResourceId) {
          const linked = await linkedQuestionResource(String(data.area), String(data.subject), String(data.sourceResourceId));
          if (linked.error || !linked.data || !topicMatches(linked.data, topic)) return fail(linked.error || "El material de origen debe pertenecer al mismo tema de la pregunta.");
        }
        Object.assign(data, { topicId: topic.id, topic: topic.title });
      }
      const groupId = kind === "notice" ? text(data.groupId, 100) || null : null;
      if (groupId) { const group = await database.prepare("SELECT id FROM records WHERE id=? AND kind='group'").bind(groupId).first(); if (!group) return fail("El grupo destinatario no existe."); }
      let sectionGuard = sectionWrite ? resourceSectionGuard(sectionWrite.period, sectionWrite.category, kind) : { sql: "1=1", values: [] };
      if (["resource", "course", "question", "simulator", "subject"].includes(kind)) {
        const periodGuard = writablePeriodRow ? "EXISTS(SELECT 1 FROM records WHERE kind='period' AND title=? AND json_extract(data_json,'$.current')=1)" : "NOT EXISTS(SELECT 1 FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1)";
        sectionGuard = { sql: `(${sectionGuard.sql}) AND (${periodGuard})`, values: [...sectionGuard.values, ...(writablePeriodRow ? [writablePeriod] : [])] };
      }
      if (kind === "subject") sectionGuard = { sql: `${sectionGuard.sql} AND NOT EXISTS(SELECT 1 FROM records WHERE kind='subject' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?)`, values: [...sectionGuard.values, title, String(data.area), writablePeriod] };
      if ((kind === "resource" || kind === "question" || (kind === "simulator" && data.mode === "subject")) && ["complexive","final_degree"].includes(String(data.area))) sectionGuard={sql:`${sectionGuard.sql} AND NOT EXISTS(SELECT 1 FROM records WHERE kind='subject' AND status='archived' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?)`,values:[...sectionGuard.values,String(data.subject),String(data.area),String(data.period)]};
      const created = await database.prepare(`INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) SELECT ?,?,?,?,?,?,? WHERE ${sectionGuard.sql}`).bind(id, kind, groupId, title, status, JSON.stringify(data), profile.id, ...sectionGuard.values).run();
      if (created.meta.changes !== 1) return fail("El catálogo o el periodo cambió antes de guardar. Actualiza y elige su destino.", 409);
      await audit("record_created", kind, id, { status });
      return Response.json({ ok: true, id });
    }

    if(action==="save_notice"||action==="set_notice_status"){const result=await saveNotice(database,body,profile,action==="set_notice_status");await audit(action,"notice",result.id);return Response.json({ok:true,...result});}

    if (action === "remove_subject" || action === "restore_subject") {
      admin(profile);
      const result=action==="remove_subject"?await removeAcademicSubject(database,body,writablePeriod,profile):await restoreAcademicSubject(database,body,writablePeriod,profile);
      await audit(action,"subject",result.id);return Response.json({ok:true,...result});
    }

    if (action === "update_simulator") {
      admin(profile);
      const id = text(body.id, 100);
      const title = text(body.title, 180);
      if (!title) return fail("Escribe un título.");
      const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='simulator'").bind(id).first<RecordRow>();
      if (!row) return fail("Simulador no encontrado.", 404);
      const input = typeof body.data === "object" && body.data ? body.data as Record<string, unknown> : {};
      const normalized = await normalizeSimulator({ ...parse<Record<string, unknown>>(row.data_json, {}), ...input });
      if (normalized.error || !normalized.data) return fail(normalized.error || "Revisa la configuración del simulador.");
      const updated=await database.prepare("UPDATE records SET title=?,status='draft',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='simulator' AND status=? AND data_json=?").bind(title,JSON.stringify(normalized.data),id,row.status,row.data_json).run();
      if(updated.meta.changes!==1)return fail("El simulador cambió. Actualiza antes de guardar.",409);
      await audit("simulator_updated", "simulator", id);
      return Response.json({ ok: true, id });
    }

    if (action === "update_status") {
      admin(profile);
      const status = text(body.status, 30);
      const id = text(body.id, 100);
      if (!["draft","pending","approved","published","rewrite","archived"].includes(status)) return fail("Estado no válido.");
      const row = await database.prepare("SELECT kind,title,status,data_json FROM records WHERE id=?").bind(id).first<{ kind: string; title: string; status: string; data_json: string }>();
      if (!row) return fail("Contenido no encontrado.", 404);
      if (row.kind === "notice") return fail("Edita o archiva el aviso desde Notificaciones.");
      if (row.kind === "subject") return fail("Gestiona o recupera la materia desde Gestionar materias.");
      if (row.kind === "period") return fail("Gestiona las convocatorias desde Periodos.");
      const scopedData = parse<Record<string, unknown>>(row.data_json, {});
      if ((["question", "simulator", "subject", "topic"].includes(row.kind) || (row.kind === "resource" && ["complexive", "final_degree"].includes(String(scopedData.area)))) && scopedData.period !== writablePeriod) return fail("Gestiona contenido del periodo vigente; el histórico se conserva.", 409);
      if (row.kind === "resource_section") return fail("Gestiona la sección desde Gestionar secciones.");
      if (row.kind === "plan_template") return fail("Gestiona los beneficios desde Planes y permisos.");
      let sectionPublicationGuard: { sql: string; values: string[] } = { sql: "1=1", values: [] };
      if (row.kind === "question_block") return fail("Usa la revisión del bloque para aprobarlo. Los bloques no se publican como contenido estudiantil.");
      if (["course_lesson", "course_progress"].includes(row.kind)) return fail("Gestiona las lecciones y el avance desde su curso.");
      if (row.kind === "course" || (row.kind === "resource" && parse<Record<string, unknown>>(row.data_json, {}).area === "resources")) {
        if (!["draft", "published", "archived"].includes(status)) return fail("Selecciona borrador, publicado o archivado.");
        if (row.status === "archived" && status === "published") return fail("Restaura como borrador y revisa antes de publicar.", 409);
      }
      if (row.kind === "question" && status === "approved") {
        const question = parse<Record<string, unknown>>(row.data_json, {});
        const area = text(question.area, 40);
        const subject = text(question.subject, 180);
        const format = text(question.format, 60);
        const options = Array.isArray(question.options) ? question.options.map((option) => text(option, 500)).filter(Boolean) : [];
        const correctIndex = question.correctIndex;
        if (!subject || !text(question.topic, 180)) return fail("La materia y el tema son obligatorios para aprobar la pregunta.");
        if (!(await subjectExists(area, subject))) return fail("La pregunta debe pertenecer a una materia del catálogo.");
        if (!questionFormats.includes(format)) return fail("El formato no es válido para el área seleccionada.");
        if (!text(question.prompt, 2000) || options.length !== 4 || typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("La pregunta debe tener un enunciado, cuatro alternativas y una sola respuesta correcta.");
        if (format === "Caso práctico" && !text(question.caseContext, 4000)) return fail("El caso práctico debe incluir el contexto que analizará el estudiante.");
        if (!text(question.explanation, 2000) || !text(question.source, 500)) return fail("La explicación y la fuente con página o sección son obligatorias para aprobar.");
        const sourceResourceId = text(question.sourceResourceId, 100);
        if (sourceResourceId) {
          const linked = await linkedQuestionResource(area, subject, sourceResourceId, true);
          if (linked.error) return fail(linked.error);
        }
      }
      if (row.kind === "resource" && status === "published") {
        const resource = parse<Record<string, unknown>>(row.data_json, {});
        const area = text(resource.area, 40);
        const materialType = text(resource.materialType, 40);
        if (["complexive","final_degree"].includes(area)) {
          if (materialType === "Video" && !text(resource.externalUrl, 1000)) return fail("Añade el enlace del video antes de publicarlo.");
          if (materialType !== "Video") {
            const fileKey = text(resource.fileKey, 400);
            if (!fileKey) return fail("Adjunta el archivo del material antes de publicarlo.");
            if (!(await verifiedUpload(database, fileKey, "material", "shared"))) return fail("El archivo del material no tiene una referencia válida.");
          }
        }
      }
      if ((row.kind === "course" || (row.kind === "resource" && parse<Record<string, unknown>>(row.data_json, {}).area === "resources")) && status === "published") {
        const resource = parse<Record<string, unknown>>(row.data_json, {});
        const active = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        const period = active?.title || "2026-2027";
        if (!resourceInCurrentPeriod(resource, period)) return fail("Publica contenido del periodo vigente; el historial se conserva.", 409);
        normalizedAdditionalResource(row.kind, resource, period);
        const category = resourceCategory({ id, kind: row.kind, title: row.title, status: row.status, data: resource }) || "other";
        await assertActiveResourceSection(database, category, period, row.kind);
        sectionPublicationGuard = resourceSectionGuard(period, category, row.kind);
        if (row.kind === "course") await assertCourseReady(database, { id, kind: row.kind, title: row.title, status: row.status, data: resource }, period, (key, own) => verifiedUpload(database, key, "material", "shared", own ? profile.id : undefined));
        else assertSupportContent(resource);
        if (resource.fileKey && !(await verifiedUpload(database, String(resource.fileKey), "material", "shared"))) return fail("El archivo del recurso no tiene una referencia válida.");
      }
      if (row.kind === "simulator" && status === "published") {
        let simulator = parse<Record<string, unknown>>(row.data_json, {});
        if (simulator.selectionMode === "blocks") {
          const normalized = await normalizeSimulator(simulator);
          if (normalized.error || !normalized.data) return fail(normalized.error || "Revisa los bloques del examen.");
          simulator = normalized.data;
        }
        let requirements;
        try { await validateAllSubjectCoverage(database, simulator, simulator.area === "complexive" ? defaultComplexiveSubjects : []); requirements = await resolveAcademicRequirements(database, simulator); }
        catch (error) { return fail(error instanceof AcademicSelectionError ? error.message : "No se pudo comprobar la cobertura del examen."); }
        for (const requirement of requirements) {
          const scope = simulatorQuestionQuery(simulator, requirement);
          const available = await database.prepare("SELECT COUNT(*) AS total FROM records WHERE " + scope.sql).bind(...scope.values).first<{ total: number }>();
          const label = requirement.blockTitle || requirement.topic || requirement.subject;
          if (Number(available?.total ?? 0) < requirement.count) return fail(`Faltan preguntas aprobadas en ${label}: necesitas ${requirement.count} y hay ${Number(available?.total ?? 0)}.`);
        }
      }
      const changed = await database.prepare(`UPDATE records SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind=? AND status=? AND data_json=? AND ${sectionPublicationGuard.sql}`).bind(status, id, row.kind, row.status, row.data_json, ...sectionPublicationGuard.values).run();
      if (changed.meta.changes !== 1) return fail("El contenido cambió mientras lo revisabas. Actualiza y vuelve a intentarlo.", 409);
      await audit("record_status_changed", row.kind, id, { status });
      return Response.json({ ok: true });
    }

    if (action === "submit_work") {
      assertActiveStudent(profile.role, profile.status);
      if (!profile.group_id) return fail("Debes pertenecer a un grupo.");
      const group = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(profile.group_id).first<RecordRow>();
      if (!group) return fail("El grupo no está disponible.");
      const groupData = parse<Record<string, unknown>>(group.data_json, {}), catalog = await plans();
      const workType = text(body.workType, 40);
      if (!['planning','case-study'].includes(workType)) return fail("Tipo de trabajo no válido.");
      if (!canSubmitWorkForGroup(groupData, Date.now(), catalog, workType)) return fail("Los permisos de tu grupo no incluyen este tipo de trabajo.", 403);
      const title = text(body.title, 180); if (!title) return fail("Escribe el nombre del trabajo.");
      const fileKey = text(body.fileKey, 400);
      if (!(await verifiedUpload(database, fileKey, "submission", profile.group_id, profile.id))) return fail("Adjunta un archivo válido del grupo.");
      const existing = await database.prepare("SELECT * FROM records WHERE kind='submission' AND group_id=? AND title=? AND json_extract(data_json,'$.workType')=? AND status NOT IN ('finalized','delivered') ORDER BY created_at DESC LIMIT 1").bind(profile.group_id, title, workType).first<RecordRow>();
      const previousData = existing ? parse<Record<string, unknown>>(existing.data_json, {}) : {}, revisions = existing ? Number(previousData.revisions ?? 0) + 1 : 0, maxRevisions = groupReviewLimit(groupData, catalog);
      if (existing && revisions > maxRevisions) return fail(`Tu plan admite hasta ${maxRevisions} corrección(es) por proyecto.`, 403);
      const submittedAt = new Date().toISOString(), workRevision = crypto.randomUUID();
      const payload = { workType, period: existing ? previousData.period || writablePeriod : writablePeriod, notes: text(body.notes, 1600), fileKey, fileName: text(body.fileName, 240) || null, submittedBy: profile.id, submittedByName: profile.full_name, revisions, reviewNotes: "", reviewFileKey: null, reviewFileName: null, submittedAt, workRevision };
      const event: WorkEvent = { id: crypto.randomUUID(), event: "submission", version: revisions + 1, at: submittedAt, author: profile.full_name, status: existing ? "new_version" : "received", fileKey, fileName: String(payload.fileName || "Archivo entregado"), notes: payload.notes };
      const history = appendWorkHistory(existing ? workHistory({ ...existing, data: previousData }) : [], event);
      if (existing) {
        const updated = await database.prepare("UPDATE records SET status='new_version',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='submission' AND status=? AND data_json=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='group' AND data_json=?)").bind(JSON.stringify({ ...previousData, ...payload, workHistory: history }), existing.id, existing.status, existing.data_json, group.id, group.data_json).run();
        if(updated.meta.changes!==1)return fail("La solicitud o los permisos cambiaron. Actualiza antes de enviar una versión.",409);
        await audit("work_resubmitted", "submission", existing.id, { revisions }); return Response.json({ ok: true, id: existing.id });
      }
      const id = uid("work"), created = await database.prepare("INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) SELECT ?,'submission',?,?,'received',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE kind='submission' AND group_id=? AND title=? AND json_extract(data_json,'$.workType')=? AND status NOT IN ('finalized','delivered')) AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='group' AND data_json=?)").bind(id, profile.group_id, title, JSON.stringify({...payload,workHistory:history}), profile.id, profile.group_id, title, workType, group.id, group.data_json).run();
      if(created.meta.changes!==1)return fail("La solicitud o los permisos cambiaron. Actualiza antes de enviar.",409);
      await audit("work_submitted", "submission", id); return Response.json({ ok: true, id });
    }

    if (action === "review_work") {
      admin(profile);const id=text(body.id,100),row=await database.prepare("SELECT * FROM records WHERE id=? AND kind='submission'").bind(id).first<RecordRow>();
      if(!row)return fail("Entrega no encontrada.",404);
      const data=parse<Record<string,unknown>>(row.data_json,{});
      if(body.revision!==(data.workRevision||row.updated_at))return fail("La versión cambió. Actualiza antes de revisar.",409);
      const status=text(body.status,30),notes=text(body.reviewNotes,3000),dueAt=text(body.dueAt,40),reviewFileKey=text(body.reviewFileKey,400);
      if(!["deadline_set","in_review","changes_requested","finalized","delivered"].includes(status))return fail("Estado de revisión no válido.");
      if(status==="changes_requested"&&!notes)return fail("Indica los ajustes que debe realizar el grupo.");
      if(dueAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)||!Number.isFinite(Date.parse(dueAt+"T00:00:00Z"))||new Date(dueAt+"T00:00:00Z").toISOString().slice(0,10)!==dueAt))return fail("Selecciona un plazo válido.");
      if(reviewFileKey&&(!row.group_id||!(await verifiedUpload(database,reviewFileKey,"review",row.group_id,profile.id))))return fail("El archivo de revisión no tiene una referencia válida.");
      const at=new Date().toISOString(),fileKey=reviewFileKey||String(data.reviewFileKey||""),fileName=reviewFileKey?text(body.reviewFileName,240)||"Archivo corregido":String(data.reviewFileName||"Archivo corregido");
      const history=appendWorkHistory(workHistory({...row,data}),{id:crypto.randomUUID(),event:"review",version:Number(data.revisions||0)+1,at,author:profile.full_name,status,fileKey,fileName,notes,dueAt});
      Object.assign(data,{reviewNotes:notes,dueAt:dueAt||null,reviewFileKey:fileKey||null,reviewFileName:fileKey?fileName:null,workHistory:history,workRevision:crypto.randomUUID()});
      const updated=await database.prepare("UPDATE records SET status=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='submission' AND status=? AND data_json=?").bind(status,JSON.stringify(data),id,row.status,row.data_json).run();
      if(updated.meta.changes!==1)return fail("La entrega cambió mientras revisabas. Actualiza y vuelve a guardar.",409);
      await audit("work_reviewed","submission",id,{status});return Response.json({ok:true});
    }

    if (action === "report_payment") { assertActiveStudent(profile.role, profile.status); if (!profile.group_id || profile.member_role !== "coordinator") return fail("Solo el coordinador puede reportar el pago.", 403); const plan = text(body.plan, 20); const amount = Number(body.amount); if (!["Bronce","Plata","Gold"].includes(plan) || !validPaymentAmount(amount)) return fail("Revisa el plan y el valor del pago."); const id = uid("pay"); const proofKey = text(body.proofKey, 400); if (!(await verifiedUpload(database, proofKey, "payment", profile.group_id, profile.id))) return fail("Adjunta un comprobante válido del grupo."); const data = { plan, amount, proofKey, proofFileName: text(body.proofFileName, 240) || null, submittedByName: profile.full_name, reviewNote: "" }; await database.prepare("INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'payment',?,?,'pending',?,?)").bind(id, profile.group_id, `Pago plan ${data.plan}`, JSON.stringify(data), profile.id).run(); await audit("payment_reported", "payment", id, { groupId: profile.group_id, plan }); return Response.json({ ok: true, id }); }

    if (action === "review_payment") {
      admin(profile);
      const id = text(body.id, 100);
      const status = text(body.status, 30);
      if (!["approved", "rejected"].includes(status)) return fail("Estado de pago no válido.");

      const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='payment'").bind(id).first<RecordRow>();
      if (!row) return fail("Pago no encontrado.", 404);
      if (row.status === status) return Response.json({ ok: true, status, alreadyReviewed: true });
      if (row.status !== "pending") return fail("Este pago ya fue revisado por el ADMIN.", 409);

      const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";
      if (reviewNote.length > 1000 || (status === "rejected" && !reviewNote)) return fail("Indica el motivo de rechazo, de hasta 1000 caracteres.");
      const reviewedAt = new Date().toISOString();
      const data = parse<Record<string, unknown>>(row.data_json, {});
      Object.assign(data, {
        reviewNote,
        reviewedAt,
        reviewedBy: profile.id,
        reviewedByName: profile.full_name,
      });

      if (status === "approved") {
        if (!row.group_id) return fail("El pago no está asociado a un grupo.");
        const plan = text(data.plan, 20);
        if (!["Bronce", "Plata", "Gold"].includes(plan)) return fail("El pago no tiene un plan válido.");
        const group = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(row.group_id).first<RecordRow>();
        if (!group) return fail("Grupo no encontrado.", 404);

        const groupData = parse<Record<string, unknown>>(group.data_json, {});
        const now = Date.now();
        const currentEndsAt = typeof groupData.endsAt === "string" ? Date.parse(groupData.endsAt) : Number.NaN;
        const hasUnusedDays = groupData.planStatus === "active" && Number.isFinite(currentEndsAt) && currentEndsAt > now;
        const ends = new Date(hasUnusedDays ? currentEndsAt : now);
        ends.setUTCDate(ends.getUTCDate() + 30);
        Object.assign(groupData, {
          plan,
          planStatus: "active",
          startsAt: hasUnusedDays && typeof groupData.startsAt === "string" ? groupData.startsAt : reviewedAt,
          endsAt: ends.toISOString(),
          lastApprovedPaymentId: row.id,
          accessRevision: crypto.randomUUID(),
        });

        await database.batch([
          database.prepare("UPDATE records SET status='approved',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='payment' AND status='pending'").bind(JSON.stringify(data), row.id),
          database.prepare("UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='group' AND COALESCE(json_extract(data_json,'$.lastApprovedPaymentId'),'')!=? AND EXISTS (SELECT 1 FROM records AS payment WHERE payment.id=? AND payment.kind='payment' AND payment.status='approved')").bind(JSON.stringify(groupData), group.id, row.id, row.id),
        ]);
      } else {
        await database.prepare("UPDATE records SET status='rejected',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='payment' AND status='pending'").bind(JSON.stringify(data), row.id).run();
      }

      const reviewed = await database.prepare("SELECT status FROM records WHERE id=? AND kind='payment'").bind(row.id).first<{ status: string }>();
      if (reviewed?.status !== status) return fail("El pago ya fue revisado con otro resultado. Actualiza la pantalla.", 409);
      await audit("payment_reviewed", "payment", row.id, { status, groupId: row.group_id });
      return Response.json({ ok: true, status });
    }

    if (action === "start_practice_session") {
      const result = await startPractice(database, body, profile);
      return Response.json({ ok: true, ...result }, { headers: { "cache-control": "private, no-store" } });
    }

    if (action === "check_practice_answer") {
      const questionId = text(body.questionId, 100);
      const selectedIndex = body.selectedIndex;
      if (typeof selectedIndex !== "number" || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return fail("Selecciona una alternativa válida.");
      const question = await database.prepare("SELECT * FROM records WHERE id=? AND kind='question' AND status='approved'").bind(questionId).first<RecordRow>();
      if (!question) return fail("La pregunta ya no está disponible.", 404);
      const questionData = parse<Record<string, unknown>>(question.data_json, {});
      const access = await authorizeStudentRecord(question.id, "question", questionData);
      if (access.error) return fail(access.error, access.status);
      const correctIndex = questionData.correctIndex;
      if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("La pregunta necesita revisión antes de utilizarse.", 409);
      const progress = body.practiceId !== undefined ? await savePracticeAnswer(database, text(body.practiceId, 100), questionId, selectedIndex, profile) : {};
      return Response.json({
        ok: true,
        ...progress,
        feedback: {
          correct: selectedIndex === correctIndex,
          correctIndex,
          explanation: text(questionData.explanation, 2000),
          source: text(questionData.source, 500),
        },
      }, { headers: { "cache-control": "private, no-store" } });
    }

    if (action === "start_simulator_attempt") {
      const simulatorId = text(body.simulatorId, 100);
      const clientAttemptId = text(body.clientAttemptId, 80);
      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(clientAttemptId)) return fail("No se pudo identificar el nuevo intento.");
      const simulator = await database.prepare("SELECT * FROM records WHERE id=? AND kind='simulator' AND status='published'").bind(simulatorId).first<RecordRow>();
      if (!simulator) return fail("El simulador no está disponible.", 404);
      const simulatorData = parse<Record<string, unknown>>(simulator.data_json, {});
      const access = await authorizeStudentRecord(simulator.id, "simulator", simulatorData);
      if (access.error || !access.groupId) return fail(access.error || "No se pudo validar tu grupo.", access.status);

      const activeSessions = await database.prepare("SELECT * FROM records WHERE kind='attempt_session' AND group_id=? AND created_by=? AND status='in_progress' AND json_extract(data_json,'$.simulatorId')=? ORDER BY updated_at DESC,created_at DESC").bind(access.groupId, profile.id, simulator.id).all<RecordRow>();
      let recovered: { id: string; startedAt: string; questions: ReturnType<typeof publicAttemptQuestions> } | null = null;
      for (const candidate of activeSessions.results) {
        const candidateData = parse<Record<string, unknown>>(candidate.data_json, {});
        const attempt = recoverableSimulatorAttempt(candidateData, simulator.id);
        if (!recovered && attempt) {
          recovered = { id: candidate.id, ...attempt };
          continue;
        }
        const expiresAt = Date.parse(text(candidateData.expiresAt, 40));
        const status = Number.isFinite(expiresAt) && expiresAt <= Date.now() ? "expired" : "abandoned";
        await database.prepare("UPDATE records SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='attempt_session' AND status='in_progress'").bind(status, candidate.id).run();
      }
      if (recovered) {
        await audit("simulator_attempt_resumed", "attempt_session", recovered.id, { simulatorId: simulator.id });
        return Response.json({ ok: true, resumed: true, attempt: recovered });
      }

      const area = text(simulatorData.area, 40);
      const period = text(simulatorData.period, 40);
      const subject = text(simulatorData.subject, 180) || "General";
      let configured = simulatorData;
      if (configured.selectionMode === "blocks") {
        const normalized = await normalizeSimulator(configured);
        if (normalized.error || !normalized.data) return fail(normalized.error || "Revisa los bloques del examen.", 409);
        configured = normalized.data;
      }
      const distribution = Array.isArray(configured.distribution) ? configured.distribution : [];
      let requirements;
      try { await validateAllSubjectCoverage(database, configured, area === "complexive" ? defaultComplexiveSubjects : []); requirements = await resolveAcademicRequirements(database, configured); }
      catch (error) { return fail(error instanceof AcademicSelectionError ? error.message : "No se pudo comprobar el banco del examen.", 409); }
      const selectedRows: RecordRow[] = [];
      for (const requirement of requirements) {
        const scope = simulatorQuestionQuery(configured, requirement);
        const result = await database.prepare("SELECT * FROM records WHERE " + scope.sql + " ORDER BY RANDOM() LIMIT ?").bind(...scope.values, requirement.count).all<RecordRow>();
        if (result.results.length !== requirement.count) return fail(`Faltan preguntas aprobadas en ${requirement.blockTitle || requirement.topic || requirement.subject}.`, 409);
        selectedRows.push(...result.results);
      }
      if (new Set(selectedRows.map(row => row.id)).size !== selectedRows.length) return fail("La configuración del examen repite preguntas. Revisa la distribución.", 409);

      const questions = secureShuffle(selectedRows).map((row) => {
        const question = parse<Record<string, unknown>>(row.data_json, {});
        const choices = prepareQuestionChoices(question, secureShuffle);
        if (!choices) throw new Error("Una pregunta aprobada necesita revisión antes de utilizarse.");
        return {
          questionId: row.id,
          subject: text(question.subject, 180),
          topic: text(question.topic, 180),
          format: text(question.format, 60),
          prompt: text(question.prompt, 2000),
          caseContext: text(question.caseContext, 4000) || null,
          sourceMaterialTitle: text(question.sourceMaterialTitle, 180) || null,
          sourceMaterialType: text(question.sourceMaterialType, 60) || null,
          options: choices.options,
          correctIndex: choices.correctIndex,
          explanation: text(question.explanation, 2000),
          source: text(question.source, 500),
        };
      });
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      const attemptId = `session-${clientAttemptId}`;
      const conflictingAttempt = await database.prepare("SELECT id FROM records WHERE id=? LIMIT 1").bind(attemptId).first<{ id: string }>();
      if (conflictingAttempt) return fail("No se pudo reutilizar este identificador. Reintenta para crear un intento nuevo.", 409);
      const sessionData = { clientAttemptId, simulatorId: simulator.id, simulatorTitle: simulator.title, area, subject, period, distribution, selectionMode: configured.selectionMode || "subjects", blockDistribution: configured.blockDistribution || [], topics: configured.topics || [], formats: configured.formats || [], formatCoverage: configured.formatCoverage || "pool", formatDistribution: configured.formatDistribution || [], resolvedFormatDistribution: Object.entries(questions.reduce<Record<string,number>>((totals,question)=>{totals[question.format]=(totals[question.format]||0)+1;return totals;},{})).map(([format,count])=>({format,count})), topicCoverage: configured.topicCoverage || "pool", topicDistribution: requirements.filter(item => item.topic), coverAllSubjects: configured.coverAllSubjects === true, passScore: Number(simulatorData.passScore ?? 14), questions, startedAt, expiresAt };
      try { assertSimulatorSessionSize(sessionData); }
      catch (error) { return fail(error instanceof Error ? error.message : "Reduce el tamaño del examen."); }
      await database.prepare("INSERT OR IGNORE INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'attempt_session',?,?,'in_progress',?,?)").bind(attemptId, access.groupId, simulator.title, JSON.stringify(sessionData), profile.id).run();
      const savedSession = await database.prepare("SELECT * FROM records WHERE id=? AND kind='attempt_session' AND created_by=?").bind(attemptId, profile.id).first<RecordRow>();
      if (!savedSession || savedSession.status !== "in_progress" || savedSession.group_id !== access.groupId) return fail("No se pudo preparar el intento.", 500);
      const savedSessionData = parse<Record<string, unknown>>(savedSession.data_json, {});
      const savedAttempt = recoverableSimulatorAttempt(savedSessionData, simulator.id);
      if (!savedAttempt) return fail("No se pudo validar el intento preparado.", 500);
      await audit("simulator_attempt_started", "attempt_session", savedSession.id, { simulatorId: simulator.id });
      return Response.json({ ok: true, resumed: false, attempt: { id: savedSession.id, ...savedAttempt } });
    }

    if (action === "finish_simulator_attempt") {
      const attemptId = text(body.attemptId, 100);
      const session = await database.prepare("SELECT * FROM records WHERE id=? AND kind='attempt_session' AND created_by=?").bind(attemptId, profile.id).first<RecordRow>();
      if (!session) return fail("El intento no existe o no te pertenece.", 404);
      const sessionData = parse<Record<string, unknown>>(session.data_json, {});
      const completedAttemptId = `attempt-${session.id}`;
      if (session.status === "completed") {
        const completed = await database.prepare("SELECT data_json FROM records WHERE id=? AND kind='attempt' AND created_by=?").bind(completedAttemptId, profile.id).first<{ data_json: string }>();
        if (!completed) return fail("El resultado del intento no está disponible.", 409);
        const completedData = parse<Record<string, unknown>>(completed.data_json, {});
        return Response.json({ ok: true, id: completedAttemptId, result: { correct: completedData.correct, total: completedData.total, score: completedData.score, passScore: completedData.passScore, passed: completedData.passed, completedAt: completedData.completedAt, review: completedData.review } });
      }
      if (session.status !== "in_progress") return fail("Este intento ya no está activo.", 409);
      const expiresAt = Date.parse(text(sessionData.expiresAt, 40));
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        await database.prepare("UPDATE records SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_progress'").bind(session.id).run();
        return fail("El intento venció. Inicia uno nuevo.", 409);
      }
      const simulatorId = text(sessionData.simulatorId, 100);
      const simulator = await database.prepare("SELECT * FROM records WHERE id=? AND kind='simulator' AND status='published'").bind(simulatorId).first<RecordRow>();
      if (!simulator) return fail("El simulador dejó de estar disponible.", 409);
      const simulatorData = parse<Record<string, unknown>>(simulator.data_json, {});
      const access = await authorizeStudentRecord(simulator.id, "simulator", simulatorData);
      if (access.error || access.groupId !== session.group_id) return fail(access.error || "El intento no pertenece a tu grupo actual.", access.status || 403);

      const grading = gradeSimulatorAttempt(sessionData.questions, body.answers, sessionData.passScore ?? simulatorData.passScore ?? 14);
      if (!grading.ok) return fail(grading.error, grading.status);
      const { review, correct, total, score, passScore, passed, answers } = grading;
      const completedAt = new Date().toISOString();
      const startedAt = text(sessionData.startedAt, 40);
      const startedTime = Date.parse(startedAt);
      const durationSeconds = Number.isFinite(startedTime) ? Math.max(0, Math.min(Math.round((Date.now() - startedTime) / 1000), 14400)) : 0;
      const attemptData = { simulatorId, simulatorTitle: simulator.title, area: text(sessionData.area, 40), subject: text(sessionData.subject, 180), period: text(sessionData.period, 40), distribution: sessionData.distribution, selectionMode: sessionData.selectionMode, blockDistribution: sessionData.blockDistribution, topicDistribution: sessionData.topicDistribution, formats: sessionData.formats, formatCoverage: sessionData.formatCoverage, formatDistribution: sessionData.resolvedFormatDistribution, configuredFormatDistribution: sessionData.formatDistribution, coverAllSubjects: sessionData.coverAllSubjects, correct, total, score, passScore, passed, answers, review, startedAt, completedAt, durationSeconds, studentName: profile.full_name, sessionId: session.id };
      const completedSessionData = { ...sessionData, completedAttemptId, completedAt };
      await database.batch([
        database.prepare("INSERT OR IGNORE INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'attempt',?,?,'completed',?,?)").bind(completedAttemptId, session.group_id, simulator.title, JSON.stringify(attemptData), profile.id),
        database.prepare("UPDATE records SET status='completed',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='attempt_session' AND status='in_progress'").bind(JSON.stringify(completedSessionData), session.id),
      ]);
      const saved = await database.prepare("SELECT data_json FROM records WHERE id=? AND kind='attempt' AND created_by=?").bind(completedAttemptId, profile.id).first<{ data_json: string }>();
      if (!saved) return fail("No se pudo guardar el resultado del intento.", 500);
      const savedData = parse<Record<string, unknown>>(saved.data_json, {});
      await audit("simulator_attempt_finished", "attempt", completedAttemptId, { simulatorId, score });
      return Response.json({ ok: true, id: completedAttemptId, result: { correct: savedData.correct, total: savedData.total, score: savedData.score, passScore: savedData.passScore, passed: savedData.passed, completedAt: savedData.completedAt, review: savedData.review } });
    }

    if (action === "save_attempt") return fail("Este formulario quedó desactualizado. Actualiza la página antes de iniciar el simulador.", 409);

    if(action==="mark_notice"){const result=await markNoticeRead(database,body,profile);return Response.json({ok:true,...result});}
    return fail("Acción no reconocida.");
  } catch (error) { if (error instanceof AcademicTopicError || error instanceof AdditionalResourceError) return fail(error.message, error.status); const issue = publicIssue(error, "No se pudo completar la solicitud."); return fail(issue.message, issue.status); }
}
