import { bucket, context, parse, text } from "@/lib/uic";
import { assertActiveStudent, assertTrustedMutation, canAccessPaymentRecord, canSubmitWorkForGroup, inspectUpload, MAX_UPLOAD_BYTES, objectKeyMatches, publicIssue, readBoundedBytes, storedObjectKey, type UploadKind } from "@/lib/security";
import { enforceRateLimit, maybeRunSecurityMaintenance, registerFile, sha256Hex, verifiedRegisteredFile, writeAudit } from "@/lib/security-storage";

import { canReadPublishedSupport } from "@/lib/content-access";
import { loadPlanCatalog } from "@/lib/plans-storage";
import { loadResourceSections } from "@/lib/resource-sections-storage";
import { fileDisposition, fileViewKind, singleFileRange } from "@/lib/file-view";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
const uploadKinds = new Set<UploadKind>(["material", "review", "submission", "payment"]);

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    if (current.profile.status !== "active") return fail("Tu cuenta no está habilitada.", 403);
    await enforceRateLimit(current.database, current.profile.id, "files:write");
    await maybeRunSecurityMaintenance(current.database);

    const url = new URL(request.url);
    const rawKind = text(url.searchParams.get("kind"), 30);
    if (!uploadKinds.has(rawKind as UploadKind)) return fail("Tipo de archivo no permitido.", 403);
    const kind = rawKind as UploadKind;
    const fileName = text(url.searchParams.get("fileName"), 240);
    if (!fileName) return fail("Selecciona un archivo.");
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_UPLOAD_BYTES) return fail("El archivo supera 25 MB.", 413);

    const isAdmin = current.profile.role === "admin";
    if (["material", "review"].includes(kind) && !isAdmin) return fail("No tienes permiso para este archivo.", 403);
    if (isAdmin && !["material", "review"].includes(kind)) return fail("Tipo de archivo no permitido para el administrador.", 403);
    if (["submission", "payment"].includes(kind) && !current.profile.group_id) return fail("Debes pertenecer a un grupo.", 403);
    if (!isAdmin && !["submission", "payment"].includes(kind)) return fail("Tipo de archivo no permitido.", 403);
    if (kind === "payment" && current.profile.member_role !== "coordinator") return fail("Solo el coordinador puede cargar comprobantes.", 403);
    if (!isAdmin) {
      assertActiveStudent(current.profile.role, current.profile.status);
      const group = await current.database.prepare("SELECT data_json FROM records WHERE id=? AND kind='group' LIMIT 1").bind(current.profile.group_id).first<{ data_json: string }>();
      if (!group) return fail("Tu grupo no está disponible.", 403);
      if (kind === "submission" && !canSubmitWorkForGroup(parse<Record<string, unknown>>(group.data_json, {}), Date.now(), await loadPlanCatalog(current.database))) {
        return fail("Tu plan no incluye revisión de trabajos.", 403);
      }
    }

    const requestedGroup = text(url.searchParams.get("groupId"), 100);
    const groupId = kind === "material" ? "shared" : isAdmin ? requestedGroup : current.profile.group_id!;
    if (!groupId) return fail("Selecciona un grupo válido.");
    if (kind === "review") {
      const group = await current.database.prepare("SELECT id FROM records WHERE id=? AND kind='group' LIMIT 1").bind(groupId).first();
      if (!group) return fail("El grupo no existe.", 404);
    }

    const bytes = await readBoundedBytes(request);
    const inspected = inspectUpload(kind, fileName, bytes);
    const prefix = kind === "material" ? "materials" : `${kind}s`;
    const key = `${prefix}/${groupId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${inspected.safeName}`;
    await bucket().put(key, bytes.buffer, {
      httpMetadata: { contentType: inspected.contentType, contentDisposition: `attachment; filename="${inspected.safeName}"` },
      customMetadata: { uploadedBy: current.profile.id, originalName: fileName, validatedType: inspected.extension },
    });
    try {
      await registerFile(current.database, {
        objectKey: key,
        kind,
        groupId,
        ownerId: current.profile.id,
        originalName: fileName,
        storedName: inspected.safeName,
        contentType: inspected.contentType,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      });
      await writeAudit(current.database, {
        actorId: current.profile.id,
        actorRole: current.profile.role,
        action: "file_uploaded",
        targetKind: kind,
        targetId: key,
        metadata: { groupId, sizeBytes: bytes.byteLength, extension: inspected.extension },
      });
    } catch (error) {
      await Promise.allSettled([
        current.database.prepare("DELETE FROM file_objects WHERE object_key=?").bind(key).run(),
        bucket().delete(key),
      ]);
      throw error;
    }
    return Response.json({ key, fileName: inspected.safeName }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const issue = publicIssue(error, "No se pudo guardar el archivo.");
    return fail(issue.message, issue.status);
  }
}

export async function GET(request: Request) {
  try {
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    if (current.profile.status !== "active") return fail("Tu cuenta no está habilitada.", 403);
    await enforceRateLimit(current.database, current.profile.id, "files:read");
    const key = new URL(request.url).searchParams.get("key") ?? "";
    const parsedKey = storedObjectKey(key);
    if (!parsedKey) return fail("Archivo no válido.");
    const registered = await verifiedRegisteredFile(current.database, key, parsedKey.kind, parsedKey.groupId);
    if (!registered) return fail("El registro de seguridad del archivo no es válido.", 403);

    if (current.profile.role !== "admin") {
      if (!current.profile.group_id) return fail("No tienes permiso para abrir este archivo.", 403);
      if (parsedKey.kind === "payment" && !canAccessPaymentRecord(current.profile.role, current.profile.member_role)) return fail("Solo el coordinador puede abrir comprobantes de pago.", 403);
      if (parsedKey.kind === "material" && objectKeyMatches(key, "material", "shared")) {
        type Support = { id: string; kind: string; title: string; status: string; data_json: string };
        const linked = await current.database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE kind IN ('resource','course','course_lesson') AND status='published' AND json_extract(data_json,'$.fileKey')=?").bind(key).all<Support>();
        const group = await current.database.prepare("SELECT data_json FROM records WHERE id=? AND kind='group'").bind(current.profile.group_id).first<{ data_json: string }>();
        const period = await current.database.prepare("SELECT title FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1 LIMIT 1").first<{ title: string }>();
        const activePeriod = period?.title || "2026-2027";
        const groupData = group ? parse<Record<string, unknown>>(group.data_json, {}) : {};
        const [plans, { sections }] = await Promise.all([loadPlanCatalog(current.database), loadResourceSections(current.database, activePeriod)]);
        let allowed = false;
        for (const resource of linked.results) {
          const data = parse<Record<string, unknown>>(resource.data_json, {});
          if (resource.kind === "course_lesson") {
            if (data.period !== activePeriod) continue;
            const parent = await current.database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE id=? AND kind='course'").bind(String(data.courseId || "")).first<Support>();
            if (parent && canReadPublishedSupport({ ...parent, data: parse<Record<string, unknown>>(parent.data_json, {}) }, groupData, activePeriod, plans, sections)) { allowed = true; break; }
          } else if (canReadPublishedSupport({ ...resource, data }, groupData, activePeriod, plans, sections)) { allowed = true; break; }
        }
        if (!allowed) return fail("Tu plan no incluye este archivo.", 403);
      } else {
        if (parsedKey.groupId !== current.profile.group_id) return fail("No tienes permiso para abrir este archivo.", 403);
        const linked = await current.database.prepare(`
          SELECT id FROM records
          WHERE group_id=? AND (
            (kind='submission' AND (json_extract(data_json,'$.fileKey')=? OR json_extract(data_json,'$.reviewFileKey')=? OR EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(records.data_json,'$.workHistory'),'[]')) AS version WHERE json_extract(version.value,'$.fileKey')=? AND json_extract(version.value,'$.event')=?)))
            OR (kind='payment' AND json_extract(data_json,'$.proofKey')=?)
          ) LIMIT 1
        `).bind(current.profile.group_id, key, key, key, parsedKey.kind === "review" ? "review" : "submission", key).first();
        if (!linked) return fail("No tienes permiso para abrir este archivo.", 403);
      }
    }

    const inventory = await current.database.prepare("SELECT stored_name,content_type,size_bytes FROM file_objects WHERE object_key=? AND status='active' LIMIT 1").bind(key).first<{ stored_name: string; content_type: string; size_bytes: number }>();
    if (!inventory) return fail("El registro de seguridad del archivo no es válido.", 403);
    const view = new URL(request.url).searchParams.get("view"), inline = view === "inline", mode = fileViewKind(inventory.content_type);
    if (view && !["inline", "metadata"].includes(view)) return fail("Opción de consulta no válida.");
    if (view && !mode) return fail("Este formato se consulta descargando el archivo.", 415);
    if (view === "metadata") {
      const object = await bucket().head(key);
      if (!object) return fail("Archivo no encontrado.", 404);
      return Response.json({ kind: mode, contentType: inventory.content_type, size: inventory.size_bytes }, { headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    }
    let rangeHeader = request.headers.get("range");
    if (rangeHeader && request.headers.has("if-range")) {
      const object = await bucket().head(key);
      if (!object) return fail("Archivo no encontrado.", 404);
      if (request.headers.get("if-range") !== object.httpEtag) rangeHeader = null;
    }
    const range = singleFileRange(rangeHeader, inventory.size_bytes);
    if (range === "invalid") return new Response(null, { status: 416, headers: { "content-range": `bytes */${inventory.size_bytes}`, "cache-control": "private, no-store", "accept-ranges": "bytes" } });
    const object = await bucket().get(key, range ? { range } : undefined);
    if (!object) return fail("Archivo no encontrado.", 404);
    if (typeof object.size === "number" && object.size !== inventory.size_bytes) return fail("El archivo no coincide con su registro. Comunícalo al profesor.", 409);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", inventory.content_type);
    headers.set("content-disposition", fileDisposition(inventory.stored_name, inline));
    headers.set("accept-ranges", "bytes");
    headers.set("content-length", String(range ? range.length : inventory.size_bytes));
    if (range) headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${inventory.size_bytes}`);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { status: range ? 206 : 200, headers });
  } catch (error) {
    const issue = publicIssue(error, "No se pudo abrir el archivo.");
    return fail(issue.message, issue.status);
  }
}
