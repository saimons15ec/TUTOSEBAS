import { admin, bucket, context, email, parse, text, uid, type RecordRow } from "@/lib/uic";
import { assertTrustedMutation, objectKeyMatches, publicIssue, readJsonObject } from "@/lib/security";
import { enforceRateLimit, maybeRunSecurityMaintenance, verifiedRegisteredFile, writeAudit } from "@/lib/security-storage";
import { gradeSimulatorAttempt, publicAttemptQuestions } from "@/lib/simulators";
import { removeSubjectFromDistribution, sameSubject } from "@/lib/subjects";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
const unpack = (row: RecordRow) => ({ ...row, data: parse<Record<string, unknown>>(row.data_json, {}) });
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
    if (profile.status !== "active") return Response.json({ authorized: false, profile, identity: user, records: [], profiles: [], activePeriod });
    const recordResult = profile.role === "admin"
      ? await database.prepare("SELECT * FROM records ORDER BY updated_at DESC").all<RecordRow>()
      : await database.prepare("SELECT * FROM records WHERE (group_id IS NULL AND (status='published' OR (kind='question' AND status='approved'))) OR (group_id=? AND (kind IN ('submission','payment') OR status='published' OR (kind='attempt' AND created_by=?))) OR (kind='group' AND id=?) ORDER BY updated_at DESC").bind(profile.group_id ?? "none", profile.id, profile.group_id ?? "none").all<RecordRow>();
    const profiles = profile.role === "admin"
      ? (await database.prepare("SELECT * FROM profiles ORDER BY created_at DESC").all()).results
      : profile.group_id ? (await database.prepare("SELECT id,email,full_name,status,group_id,member_role FROM profiles WHERE group_id=? ORDER BY CASE member_role WHEN 'coordinator' THEN 0 ELSE 1 END,full_name").bind(profile.group_id).all()).results : [];
    let accessibleRecords = recordResult.results.map(unpack);
    if (profile.role !== "admin") {
      const group = accessibleRecords.find((row) => row.kind === "group" && row.id === profile.group_id);
      const groupData = group?.data ?? {};
      const permissions = Array.isArray(groupData.permissions) ? groupData.permissions.map(String) : [];
      const endsAt = typeof groupData.endsAt === "string" ? Date.parse(groupData.endsAt) : Number.NaN;
      const planActive = groupData.planStatus === "active" && (Number.isNaN(endsAt) || endsAt > Date.now());
      const ranks: Record<string, number> = { "Sin plan": 0, Bronce: 1, Plata: 2, Gold: 3 };
      const currentRank = ranks[String(groupData.plan ?? "Sin plan")] ?? 0;
      accessibleRecords = accessibleRecords.filter((row) => {
        const academicResource = row.kind === "resource" && ["complexive","final_degree"].includes(String(row.data.area ?? ""));
        if ((academicResource || ["question","simulator","subject"].includes(row.kind)) && String(row.data.period ?? "") !== activePeriod) return false;
        if (!['resource','course','question','simulator'].includes(row.kind)) return true;
        const requiredRank = ranks[String(row.data.plan ?? "Bronce")] ?? 1;
        const manuallyAllowed = permissions.includes("all") || permissions.includes(row.id) || permissions.includes(row.kind) || permissions.includes(String(row.data.area ?? ""));
        return manuallyAllowed || (planActive && currentRank >= requiredRank);
      });
      accessibleRecords = accessibleRecords.map((row) => {
        if (row.kind !== "question") return row;
        const { correctIndex: _correctIndex, explanation: _explanation, ...safeData } = row.data;
        void _correctIndex;
        void _explanation;
        return { ...row, data: safeData };
      });
    }
    return Response.json({ authorized: true, identity: user, profile, records: accessibleRecords, profiles, activePeriod });
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
    const subjectExists = async (area: string, subject: string) => {
      const archived = await database.prepare("SELECT id FROM records WHERE kind='subject' AND status='archived' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? LIMIT 1").bind(subject, area).first();
      if (archived) return false;
      if (area === "complexive" && defaultComplexiveSubjects.some((item) => item.toLocaleLowerCase("es") === subject.toLocaleLowerCase("es"))) return true;
      const managed = await database.prepare("SELECT id FROM records WHERE kind='subject' AND status='published' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? LIMIT 1").bind(subject, area).first();
      if (managed) return true;
      const inUse = await database.prepare("SELECT id FROM records WHERE kind IN ('resource','question','simulator') AND status!='archived' AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.area')=? LIMIT 1").bind(subject, area).first();
      return Boolean(inUse);
    };
    const linkedQuestionResource = async (area: string, subject: string, resourceId: string, requirePublished = false) => {
      if (!resourceId) return { row: null, data: null, error: "" };
      const row = await database.prepare("SELECT id,title,status,data_json FROM records WHERE id=? AND kind='resource' LIMIT 1").bind(resourceId).first<{ id: string; title: string; status: string; data_json: string }>();
      if (!row) return { row: null, data: null, error: "El material de origen ya no está disponible." };
      const resourceData = parse<Record<string, unknown>>(row.data_json, {});
      if (text(resourceData.area, 40) !== area || text(resourceData.subject, 180).toLocaleLowerCase("es") !== subject.toLocaleLowerCase("es")) return { row: null, data: null, error: "El material de origen debe pertenecer a la misma área y materia de la pregunta." };
      if (requirePublished && row.status !== "published") return { row: null, data: null, error: "Publica el material de origen antes de aprobar esta pregunta." };
      return { row, data: resourceData, error: "" };
    };
    const normalizeSimulator = async (input: Record<string, unknown>) => {
      const data = { ...input };
      const area = text(data.area, 40);
      const subject = text(data.subject, 180) || "General";
      const requestedMode = text(data.mode, 20);
      const mode = requestedMode === "final" || ["General", "23 materias"].includes(subject) ? "final" : "subject";
      if (!["final_degree", "complexive"].includes(area)) return { error: "Selecciona un área válida." };
      if (mode === "subject") {
        const count = Number(data.count);
        if (!(await subjectExists(area, subject))) return { error: "Selecciona una materia del catálogo." };
        if (!Number.isInteger(count) || count < 5 || count > 15) return { error: "El simulador por materia debe tener entre 5 y 15 preguntas." };
        Object.assign(data, { area, mode, subject, count, distribution: [], period: text(data.period, 40) || "2026-2027" });
        return { data };
      }
      const raw = Array.isArray(data.distribution) ? data.distribution : [];
      const distribution: Array<{ subject: string; count: number }> = [];
      const seen = new Set<string>();
      for (const item of raw) {
        if (!item || typeof item !== "object") return { error: "Revisa la distribución del examen final." };
        const entry = item as Record<string, unknown>;
        const itemSubject = text(entry.subject, 180);
        const itemCount = Number(entry.count);
        if (!itemSubject || seen.has(itemSubject.toLocaleLowerCase("es"))) return { error: "Cada materia debe aparecer una sola vez en el examen final." };
        if (!(await subjectExists(area, itemSubject))) return { error: `La materia ${itemSubject} no pertenece al catálogo.` };
        if (!Number.isInteger(itemCount) || itemCount < 5 || itemCount > 15) return { error: "Cada materia del examen final debe aportar entre 5 y 15 preguntas." };
        seen.add(itemSubject.toLocaleLowerCase("es"));
        distribution.push({ subject: itemSubject, count: itemCount });
      }
      if (!distribution.length) return { error: "Selecciona al menos una materia para el examen final." };
      Object.assign(data, { area, mode: "final", subject: "General", distribution, count: distribution.reduce((sum, item) => sum + item.count, 0), period: text(data.period, 40) || "2026-2027" });
      return { data };
    };
    const authorizeStudentRecord = async (recordId: string, kind: "question" | "simulator", data: Record<string, unknown>) => {
      if (profile.role !== "student" || !profile.group_id) return { error: "Solo una cuenta estudiantil activa puede realizar esta acción.", status: 403 };
      const periodRow = await database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title:string }>();
      const activePeriod = periodRow?.title || "2026-2027";
      if (text(data.period, 40) !== activePeriod) return { error: "Este contenido pertenece a un periodo histórico y no está disponible en el periodo vigente.", status: 403 };
      const group = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(profile.group_id).first<RecordRow>();
      if (!group) return { error: "Tu grupo no está disponible.", status: 403 };
      const groupData = parse<Record<string, unknown>>(group.data_json, {});
      const permissions = Array.isArray(groupData.permissions) ? groupData.permissions.map(String) : [];
      const ranks: Record<string, number> = { "Sin plan": 0, Bronce: 1, Plata: 2, Gold: 3 };
      const endsAt = typeof groupData.endsAt === "string" ? Date.parse(groupData.endsAt) : Number.NaN;
      const planActive = groupData.planStatus === "active" && (Number.isNaN(endsAt) || endsAt > Date.now());
      const requiredPlan = text(data.plan, 20) || (kind === "simulator" ? "Plata" : "Bronce");
      const planAllowed = planActive && (ranks[String(groupData.plan ?? "Sin plan")] ?? 0) >= (ranks[requiredPlan] ?? 1);
      const manuallyAllowed = permissions.includes("all") || permissions.includes(recordId) || permissions.includes(kind) || permissions.includes(text(data.area, 40));
      if (!planAllowed && !manuallyAllowed) return { error: kind === "simulator" ? "Tu plan no incluye este simulador." : "Tu plan no incluye esta pregunta.", status: 403 };
      return { groupId: profile.group_id, activePeriod, error: "", status: 200 };
    };

    if (action === "create_group") {
      admin(profile); const title = text(body.title, 100); const code = text(body.code, 24).toUpperCase(); if (!title || !code) return fail("Completa nombre y código.");
      const duplicate = await database.prepare("SELECT id FROM records WHERE kind='group' AND json_extract(data_json,'$.code')=? LIMIT 1").bind(code).first(); if (duplicate) return fail("Ese código ya existe.");
      const id = uid("grp"); await database.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'group',?,'active',?,?)").bind(id, title, JSON.stringify({ code, plan: "Sin plan", planStatus: "pending", startsAt: null, endsAt: null, permissions: [] }), profile.id).run(); await audit("group_created", "group", id); return Response.json({ ok: true, id });
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

    if (action === "set_user_status") { admin(profile); const status = text(body.status, 20); const id = text(body.id, 100); if (!["active","invited","pending","suspended"].includes(status)) return fail("Estado no válido."); await database.prepare("UPDATE profiles SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role!='admin'").bind(status, id).run(); await audit("student_status_changed", "profile", id, { status }); return Response.json({ ok: true }); }

    if (action === "activate_plan") {
      admin(profile); const id = text(body.id, 100); const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(id).first<RecordRow>(); if (!row) return fail("Grupo no encontrado."); const plan = text(body.plan, 20); if (!["Bronce","Plata","Gold"].includes(plan)) return fail("Plan no válido."); const data = parse<Record<string, unknown>>(row.data_json, {}); const startsAt = new Date().toISOString(); const ends = new Date(); const days = Math.max(1, Math.min(Number(body.days) || 30, 365)); ends.setUTCDate(ends.getUTCDate() + days); Object.assign(data, { plan, planStatus: "active", startsAt, endsAt: ends.toISOString(), permissions: Array.isArray(body.permissions) ? body.permissions.map((item) => text(item, 100)).filter(Boolean).slice(0, 100) : data.permissions ?? [] }); await database.prepare("UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(data), id).run(); await audit("plan_activated", "group", id, { plan, days }); return Response.json({ ok: true });
    }

    if (action === "create_record") {
      admin(profile);
      const allowed = ["resource","course","question","simulator","notice","period","subject"];
      const kind = text(body.kind, 30);
      if (!allowed.includes(kind)) return fail("Tipo de contenido no válido.");
      const title = text(body.title, 180);
      if (!title) return fail("Escribe un título.");
      const id = uid(kind);
      const status = text(body.status, 30) || "draft";
      const data = typeof body.data === "object" && body.data ? body.data as Record<string, unknown> : {};
      if (kind === "subject") {
        const area = text(data.area, 40);
        if (!["final_degree","complexive"].includes(area)) return fail("Selecciona un área académica válida.");
        data.area = area;
        data.period = text(data.period, 40) || "2026-2027";
        const existing = await database.prepare("SELECT id,status FROM records WHERE kind='subject' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=? LIMIT 1").bind(title, area).first<{ id: string; status: string }>();
        if (existing?.status === "archived") {
          await database.prepare("UPDATE records SET title=?,status='published',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='subject'").bind(title, JSON.stringify(data), existing.id).run();
          await audit("subject_reactivated", "subject", existing.id, { area, subject: title });
          return Response.json({ ok: true, id: existing.id, reactivated: true });
        }
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
        const correctIndex = Number(data.correctIndex);
        if (!["final_degree","complexive"].includes(area)) return fail("Selecciona un área válida.");
        if (!(await subjectExists(area, subject))) return fail("Selecciona una materia del catálogo.");
        if (!questionFormats.includes(format) || (area !== "complexive" && format === "Caso práctico")) return fail("Selecciona un formato válido para el área.");
        if (!subject || !topic || !prompt || !source || !explanation || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("Completa materia, tema, enunciado, cuatro alternativas, respuesta, explicación y fuente.");
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
      const groupId = kind === "notice" ? text(data.groupId, 100) || null : null;
      if (groupId) { const group = await database.prepare("SELECT id FROM records WHERE id=? AND kind='group'").bind(groupId).first(); if (!group) return fail("El grupo destinatario no existe."); }
      await database.prepare("INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,?,?,?,?,?,?)").bind(id, kind, groupId, title, status, JSON.stringify(data), profile.id).run();
      await audit("record_created", kind, id, { status });
      return Response.json({ ok: true, id });
    }

    if (action === "remove_subject") {
      admin(profile);
      const area = text(body.area, 40);
      const subject = text(body.subject, 180);
      const period = text(body.period, 40) || "2026-2027";
      if (!["final_degree","complexive"].includes(area)) return fail("Selecciona un área académica válida.");
      if (!subject || ["general","23 materias"].includes(subject.toLocaleLowerCase("es"))) return fail("Selecciona una materia válida.");

      const subjectRows = await database.prepare("SELECT id,status FROM records WHERE kind='subject' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=?").bind(subject, area).all<{ id: string; status: string }>();
      const contentCount = await database.prepare("SELECT COUNT(*) AS total FROM records WHERE kind IN ('resource','question','simulator') AND status!='archived' AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.area')=?").bind(subject, area).first<{ total: number }>();
      const finalSimulators = await database.prepare("SELECT id,data_json FROM records WHERE kind='simulator' AND status!='archived' AND json_extract(data_json,'$.area')=?").bind(area).all<{ id: string; data_json: string }>();
      const statements: D1PreparedStatement[] = [];

      if (subjectRows.results.length) {
        statements.push(database.prepare("UPDATE records SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE kind='subject' AND lower(title)=lower(?) AND json_extract(data_json,'$.area')=?").bind(subject, area));
      } else {
        const subjectId = uid("subject");
        statements.push(database.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'subject',?,'archived',?,?)").bind(subjectId, subject, JSON.stringify({ area, period, removedAt: new Date().toISOString() }), profile.id));
      }
      statements.push(database.prepare("UPDATE records SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE kind IN ('resource','question','simulator') AND status!='archived' AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.area')=?").bind(subject, area));

      let adjustedFinals = 0;
      for (const simulator of finalSimulators.results) {
        const data = parse<Record<string, unknown>>(simulator.data_json, {});
        if (sameSubject(data.subject, subject)) continue;
        const adjusted = removeSubjectFromDistribution(data.distribution, subject);
        if (!adjusted.changed) continue;
        adjustedFinals += 1;
        Object.assign(data, { distribution: adjusted.distribution, count: adjusted.count });
        statements.push(database.prepare("UPDATE records SET status=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='simulator'").bind(adjusted.distribution.length ? "draft" : "archived", JSON.stringify(data), simulator.id));
      }

      await database.batch(statements);
      await audit("subject_removed", "subject", subject, { area, archivedContent: Number(contentCount?.total ?? 0), adjustedFinals });
      return Response.json({ ok: true, archivedContent: Number(contentCount?.total ?? 0), adjustedFinals });
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
      await database.prepare("UPDATE records SET title=?,status='draft',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(title, JSON.stringify(normalized.data), id).run();
      await audit("simulator_updated", "simulator", id);
      return Response.json({ ok: true, id });
    }

    if (action === "update_status") {
      admin(profile);
      const status = text(body.status, 30);
      const id = text(body.id, 100);
      if (!["draft","pending","approved","published","rewrite","archived"].includes(status)) return fail("Estado no válido.");
      const row = await database.prepare("SELECT kind,data_json FROM records WHERE id=?").bind(id).first<{ kind: string; data_json: string }>();
      if (!row) return fail("Contenido no encontrado.", 404);
      if (row.kind === "question" && status === "approved") {
        const question = parse<Record<string, unknown>>(row.data_json, {});
        const area = text(question.area, 40);
        const subject = text(question.subject, 180);
        const format = text(question.format, 60);
        const options = Array.isArray(question.options) ? question.options.map((option) => text(option, 500)).filter(Boolean) : [];
        const correctIndex = Number(question.correctIndex);
        if (!subject || !text(question.topic, 180)) return fail("La materia y el tema son obligatorios para aprobar la pregunta.");
        if (!(await subjectExists(area, subject))) return fail("La pregunta debe pertenecer a una materia del catálogo.");
        if (!questionFormats.includes(format) || (area !== "complexive" && format === "Caso práctico")) return fail("El formato no es válido para el área seleccionada.");
        if (!text(question.prompt, 2000) || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("La pregunta debe tener un enunciado, cuatro alternativas y una sola respuesta correcta.");
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
      if (row.kind === "simulator" && status === "published") {
        const simulator = parse<Record<string, unknown>>(row.data_json, {});
        const area = text(simulator.area, 40);
        const simulatorPeriod = text(simulator.period, 40) || "2026-2027";
        const distribution = Array.isArray(simulator.distribution) ? simulator.distribution.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          const subject = text(entry.subject, 180);
          const count = Number(entry.count);
          return subject && Number.isInteger(count) && count > 0 ? [{ subject, count }] : [];
        }) : [];
        const requirements = distribution.length ? distribution : [{ subject: text(simulator.subject, 180) || "General", count: Math.max(1, Number(simulator.count) || 20) }];
        for (const requirement of requirements) {
          const available = ["General", "23 materias"].includes(requirement.subject)
            ? await database.prepare("SELECT COUNT(*) AS total FROM records WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=?").bind(area, simulatorPeriod).first<{ total: number }>()
            : await database.prepare("SELECT COUNT(*) AS total FROM records WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.subject')=? AND json_extract(data_json,'$.period')=?").bind(area, requirement.subject, simulatorPeriod).first<{ total: number }>();
          if (Number(available?.total ?? 0) < requirement.count) return fail(`Faltan preguntas aprobadas en ${requirement.subject}: necesitas ${requirement.count} y hay ${Number(available?.total ?? 0)}.`);
        }
      }
      await database.prepare("UPDATE records SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, id).run();
      await audit("record_status_changed", row.kind, id, { status });
      return Response.json({ ok: true });
    }

    if (action === "submit_work") {
      if (!profile.group_id) return fail("Debes pertenecer a un grupo."); const group = await database.prepare("SELECT * FROM records WHERE id=? AND kind='group'").bind(profile.group_id).first<RecordRow>(); if (!group) return fail("El grupo no está disponible."); const groupData = parse<Record<string, unknown>>(group.data_json, {}); const permissions = Array.isArray(groupData.permissions) ? groupData.permissions.map(String) : []; const expires = typeof groupData.endsAt === "string" ? Date.parse(groupData.endsAt) : Number.NaN; const activePlan = groupData.planStatus === "active" && (Number.isNaN(expires) || expires > Date.now()); const plan = String(groupData.plan ?? "Sin plan"); if (!(permissions.includes("all") || permissions.includes("submission") || (activePlan && ["Plata","Gold"].includes(plan)))) return fail("Tu plan no incluye revisión de trabajos.", 403); const title = text(body.title, 180); if (!title) return fail("Escribe el nombre del trabajo."); const workType = text(body.workType, 40); if (!['planning','case-study'].includes(workType)) return fail("Tipo de trabajo no válido."); const fileKey = text(body.fileKey, 400); if (!(await verifiedUpload(database, fileKey, "submission", profile.group_id, profile.id))) return fail("Adjunta un archivo válido del grupo."); const existing = await database.prepare("SELECT * FROM records WHERE kind='submission' AND group_id=? AND title=? AND status NOT IN ('finalized','delivered') ORDER BY created_at DESC LIMIT 1").bind(profile.group_id, title).first<RecordRow>(); const previousData = existing ? parse<Record<string, unknown>>(existing.data_json, {}) : {}; const revisions = existing ? Number(previousData.revisions ?? 0) + 1 : 0; const maxRevisions = permissions.includes("all") ? 99 : plan === "Gold" ? 3 : 1; if (existing && revisions > maxRevisions) return fail(`Tu plan admite hasta ${maxRevisions} corrección(es) por proyecto.`, 403); const payload = { workType, notes: text(body.notes, 1600), fileKey, fileName: text(body.fileName, 240) || null, submittedBy: profile.id, submittedByName: profile.full_name, revisions, reviewNotes: existing ? previousData.reviewNotes ?? "" : "" };
      if (existing) { const previous = parse<Record<string, unknown>>(existing.data_json, {}); await database.prepare("UPDATE records SET status='new_version',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ ...previous, ...payload }), existing.id).run(); await audit("work_resubmitted", "submission", existing.id, { revisions }); return Response.json({ ok: true, id: existing.id }); }
      const id = uid("work"); await database.prepare("INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'submission',?,?,'received',?,?)").bind(id, profile.group_id, title, JSON.stringify(payload), profile.id).run(); await audit("work_submitted", "submission", id); return Response.json({ ok: true, id });
    }

    if (action === "review_work") { admin(profile); const id = text(body.id, 100); const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='submission'").bind(id).first<RecordRow>(); if (!row) return fail("Entrega no encontrada."); const status = text(body.status, 30); if (!["deadline_set","in_review","changes_requested","finalized","delivered"].includes(status)) return fail("Estado de revisión no válido."); const reviewFileKey = text(body.reviewFileKey, 400); if (reviewFileKey && (!row.group_id || !(await verifiedUpload(database, reviewFileKey, "review", row.group_id, profile.id)))) return fail("El archivo de revisión no tiene una referencia válida."); const data = parse<Record<string, unknown>>(row.data_json, {}); Object.assign(data, { reviewNotes: text(body.reviewNotes, 3000), dueAt: text(body.dueAt, 40) || null, reviewFileKey: reviewFileKey || (data.reviewFileKey ?? null), reviewFileName: text(body.reviewFileName, 240) || (data.reviewFileName ?? null) }); await database.prepare("UPDATE records SET status=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, JSON.stringify(data), id).run(); await audit("work_reviewed", "submission", id, { status }); return Response.json({ ok: true }); }

    if (action === "report_payment") { if (!profile.group_id || profile.member_role !== "coordinator") return fail("Solo el coordinador puede reportar el pago.", 403); const plan = text(body.plan, 20); const amount = Number(body.amount); if (!["Bronce","Plata","Gold"].includes(plan) || !Number.isFinite(amount) || amount <= 0) return fail("Revisa el plan y el valor del pago."); const id = uid("pay"); const proofKey = text(body.proofKey, 400); if (!(await verifiedUpload(database, proofKey, "payment", profile.group_id, profile.id))) return fail("Adjunta un comprobante válido del grupo."); const data = { plan, amount, proofKey, proofFileName: text(body.proofFileName, 240) || null, submittedByName: profile.full_name, reviewNote: "" }; await database.prepare("INSERT INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'payment',?,?,'pending',?,?)").bind(id, profile.group_id, `Pago plan ${data.plan}`, JSON.stringify(data), profile.id).run(); await audit("payment_reported", "payment", id, { groupId: profile.group_id, plan }); return Response.json({ ok: true, id }); }

    if (action === "review_payment") {
      admin(profile);
      const id = text(body.id, 100);
      const status = text(body.status, 30);
      if (!["approved", "rejected"].includes(status)) return fail("Estado de pago no válido.");

      const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='payment'").bind(id).first<RecordRow>();
      if (!row) return fail("Pago no encontrado.", 404);
      if (row.status === status) return Response.json({ ok: true, status, alreadyReviewed: true });
      if (row.status !== "pending") return fail("Este pago ya fue revisado por el ADMIN.", 409);

      const reviewedAt = new Date().toISOString();
      const data = parse<Record<string, unknown>>(row.data_json, {});
      Object.assign(data, {
        reviewNote: text(body.reviewNote, 1000),
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

    if (action === "check_practice_answer") {
      const questionId = text(body.questionId, 100);
      const selectedIndex = Number(body.selectedIndex);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return fail("Selecciona una alternativa válida.");
      const question = await database.prepare("SELECT * FROM records WHERE id=? AND kind='question' AND status='approved'").bind(questionId).first<RecordRow>();
      if (!question) return fail("La pregunta ya no está disponible.", 404);
      const questionData = parse<Record<string, unknown>>(question.data_json, {});
      const access = await authorizeStudentRecord(question.id, "question", questionData);
      if (access.error) return fail(access.error, access.status);
      const correctIndex = Number(questionData.correctIndex);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return fail("La pregunta necesita revisión antes de utilizarse.", 409);
      return Response.json({
        ok: true,
        feedback: {
          correct: selectedIndex === correctIndex,
          correctIndex,
          explanation: text(questionData.explanation, 2000),
          source: text(questionData.source, 500),
        },
      });
    }

    if (action === "start_simulator_attempt") {
      const simulatorId = text(body.simulatorId, 100);
      const clientAttemptId = text(body.clientAttemptId, 100);
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(clientAttemptId)) return fail("No se pudo identificar el nuevo intento.");
      const simulator = await database.prepare("SELECT * FROM records WHERE id=? AND kind='simulator' AND status='published'").bind(simulatorId).first<RecordRow>();
      if (!simulator) return fail("El simulador no está disponible.", 404);
      const simulatorData = parse<Record<string, unknown>>(simulator.data_json, {});
      const access = await authorizeStudentRecord(simulator.id, "simulator", simulatorData);
      if (access.error || !access.groupId) return fail(access.error || "No se pudo validar tu grupo.", access.status);

      const existing = await database.prepare("SELECT * FROM records WHERE kind='attempt_session' AND created_by=? AND json_extract(data_json,'$.clientAttemptId')=? ORDER BY created_at DESC LIMIT 1").bind(profile.id, clientAttemptId).first<RecordRow>();
      if (existing) {
        const existingData = parse<Record<string, unknown>>(existing.data_json, {});
        const expiresAt = Date.parse(text(existingData.expiresAt, 40));
        if (existing.status === "in_progress" && text(existingData.simulatorId, 100) === simulator.id && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          return Response.json({ ok: true, attempt: { id: existing.id, startedAt: text(existingData.startedAt, 40), questions: publicAttemptQuestions(existingData) } });
        }
        if (existing.status === "in_progress") await database.prepare("UPDATE records SET status='abandoned',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_progress'").bind(existing.id).run();
      }

      const area = text(simulatorData.area, 40);
      const period = text(simulatorData.period, 40);
      const subject = text(simulatorData.subject, 180) || "General";
      const distribution = Array.isArray(simulatorData.distribution) ? simulatorData.distribution.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        const itemSubject = text(entry.subject, 180);
        const count = Number(entry.count);
        return itemSubject && Number.isInteger(count) && count > 0 ? [{ subject: itemSubject, count }] : [];
      }) : [];
      const requirements = distribution.length ? distribution : [{ subject, count: Math.max(1, Number(simulatorData.count) || 20) }];
      const selectedRows: RecordRow[] = [];
      for (const requirement of requirements) {
        const result = ["General", "23 materias"].includes(requirement.subject)
          ? await database.prepare("SELECT * FROM records WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? ORDER BY RANDOM() LIMIT ?").bind(area, period, requirement.count).all<RecordRow>()
          : await database.prepare("SELECT * FROM records WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.subject')=? AND json_extract(data_json,'$.period')=? ORDER BY RANDOM() LIMIT ?").bind(area, requirement.subject, period, requirement.count).all<RecordRow>();
        if (result.results.length !== requirement.count) return fail(`Faltan preguntas aprobadas en ${requirement.subject}.`, 409);
        selectedRows.push(...result.results);
      }

      const questions = secureShuffle(selectedRows).map((row) => {
        const question = parse<Record<string, unknown>>(row.data_json, {});
        const options = Array.isArray(question.options) ? question.options.map((option) => text(option, 500)).filter(Boolean) : [];
        const originalCorrectIndex = Number(question.correctIndex);
        if (options.length !== 4 || !Number.isInteger(originalCorrectIndex) || originalCorrectIndex < 0 || originalCorrectIndex > 3) throw new Error("Una pregunta aprobada necesita revisión antes de utilizarse.");
        const shuffledOptions = secureShuffle(options.map((label, originalIndex) => ({ label, originalIndex })));
        return {
          questionId: row.id,
          subject: text(question.subject, 180),
          topic: text(question.topic, 180),
          format: text(question.format, 60),
          prompt: text(question.prompt, 2000),
          caseContext: text(question.caseContext, 4000) || null,
          sourceMaterialTitle: text(question.sourceMaterialTitle, 180) || null,
          sourceMaterialType: text(question.sourceMaterialType, 60) || null,
          options: shuffledOptions.map((option) => option.label),
          correctIndex: shuffledOptions.findIndex((option) => option.originalIndex === originalCorrectIndex),
          explanation: text(question.explanation, 2000),
          source: text(question.source, 500),
        };
      });
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      const attemptId = `session-${clientAttemptId}`;
      const sessionData = { clientAttemptId, simulatorId: simulator.id, simulatorTitle: simulator.title, area, subject, period, distribution, passScore: Number(simulatorData.passScore ?? 14), questions, startedAt, expiresAt };
      await database.prepare("INSERT OR IGNORE INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,'attempt_session',?,?,'in_progress',?,?)").bind(attemptId, access.groupId, simulator.title, JSON.stringify(sessionData), profile.id).run();
      const savedSession = await database.prepare("SELECT * FROM records WHERE id=? AND kind='attempt_session' AND created_by=?").bind(attemptId, profile.id).first<RecordRow>();
      if (!savedSession) return fail("No se pudo preparar el intento.", 500);
      const savedSessionData = parse<Record<string, unknown>>(savedSession.data_json, {});
      await audit("simulator_attempt_started", "attempt_session", savedSession.id, { simulatorId: simulator.id });
      return Response.json({ ok: true, attempt: { id: savedSession.id, startedAt: text(savedSessionData.startedAt, 40), questions: publicAttemptQuestions(savedSessionData) } });
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
      const attemptData = { simulatorId, simulatorTitle: simulator.title, area: text(sessionData.area, 40), subject: text(sessionData.subject, 180), period: text(sessionData.period, 40), distribution: sessionData.distribution, correct, total, score, passScore, passed, answers, review, startedAt, completedAt, durationSeconds, studentName: profile.full_name, sessionId: session.id };
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

    if (action === "mark_notice") { const id = text(body.id, 100); const row = await database.prepare("SELECT * FROM records WHERE id=? AND kind='notice'").bind(id).first<RecordRow>(); if (!row) return fail("Aviso no encontrado.", 404); if (profile.role !== "admin" && (row.status !== "published" || (row.group_id && row.group_id !== profile.group_id))) return fail("No tienes permiso para este aviso.", 403); const data = parse<Record<string, unknown>>(row.data_json, {}); const readBy = Array.isArray(data.readBy) ? data.readBy.map(String) : []; if (!readBy.includes(profile.id)) readBy.push(profile.id); data.readBy = readBy.slice(-5000); await database.prepare("UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(data), id).run(); return Response.json({ ok: true }); }
    return fail("Acción no reconocida.");
  } catch (error) { const issue = publicIssue(error, "No se pudo completar la solicitud."); return fail(issue.message, issue.status); }
}
