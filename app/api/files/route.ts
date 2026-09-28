import { bucket, context, parse, text } from "@/lib/uic";
import { assertTrustedMutation, canAccessPaymentRecord, inspectUpload, MAX_UPLOAD_BYTES, objectKeyMatches, publicIssue, readBoundedBytes, storedObjectKey, type UploadKind } from "@/lib/security";
import { enforceRateLimit, maybeRunSecurityMaintenance, registerFile, sha256Hex, verifiedRegisteredFile, writeAudit } from "@/lib/security-storage";

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
        const resource = await current.database.prepare("SELECT id,kind,status,data_json FROM records WHERE status='published' AND json_extract(data_json,'$.fileKey')=? LIMIT 1").bind(key).first<{ id: string; kind: string; status: string; data_json: string }>();
        if (!resource) return fail("No tienes permiso para abrir este archivo.", 403);
        const group = await current.database.prepare("SELECT data_json FROM records WHERE id=? AND kind='group'").bind(current.profile.group_id).first<{ data_json: string }>();
        const resourceData = parse<Record<string, unknown>>(resource.data_json, {});
        const groupData = group ? parse<Record<string, unknown>>(group.data_json, {}) : {};
        const permissions = Array.isArray(groupData.permissions) ? groupData.permissions.map(String) : [];
        const ranks: Record<string, number> = { "Sin plan": 0, Bronce: 1, Plata: 2, Gold: 3 };
        const expires = typeof groupData.endsAt === "string" ? Date.parse(groupData.endsAt) : Number.NaN;
        const planActive = groupData.planStatus === "active" && (Number.isNaN(expires) || expires > Date.now());
        const allowed = permissions.includes("all") || permissions.includes(resource.id) || permissions.includes(resource.kind) || permissions.includes(String(resourceData.area ?? "")) || (planActive && (ranks[String(groupData.plan ?? "Sin plan")] ?? 0) >= (ranks[String(resourceData.plan ?? "Bronce")] ?? 1));
        if (!allowed) return fail("Tu plan no incluye este archivo.", 403);
      } else {
        if (parsedKey.groupId !== current.profile.group_id) return fail("No tienes permiso para abrir este archivo.", 403);
        const linked = await current.database.prepare(`
          SELECT id FROM records
          WHERE group_id=? AND (
            (kind='submission' AND (json_extract(data_json,'$.fileKey')=? OR json_extract(data_json,'$.reviewFileKey')=?))
            OR (kind='payment' AND json_extract(data_json,'$.proofKey')=?)
          ) LIMIT 1
        `).bind(current.profile.group_id, key, key, key).first();
        if (!linked) return fail("No tienes permiso para abrir este archivo.", 403);
      }
    }

    const object = await bucket().get(key);
    if (!object) return fail("Archivo no encontrado.", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    const issue = publicIssue(error, "No se pudo abrir el archivo.");
    return fail(issue.message, issue.status);
  }
}
