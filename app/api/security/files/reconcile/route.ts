import { admin, bucket, context, text } from "@/lib/uic";
import { assertTrustedMutation, inspectUpload, MAX_UPLOAD_BYTES, PublicError, publicIssue, storedObjectKey, type UploadKind } from "@/lib/security";
import { enforceRateLimit, sha256Hex, writeAudit } from "@/lib/security-storage";

export const dynamic = "force-dynamic";

type LinkedRecord = { created_by: string; group_id: string | null };

const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

function linkQuery(kind: UploadKind) {
  if (kind === "material") return "SELECT created_by,group_id FROM records WHERE kind IN ('resource','course','course_lesson') AND json_extract(data_json,'$.fileKey')=? LIMIT 1";
  if (kind === "review") return "SELECT created_by,group_id FROM records WHERE kind='submission' AND (json_extract(data_json,'$.reviewFileKey')=? OR EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(records.data_json,'$.workHistory'),'[]')) AS version WHERE json_extract(version.value,'$.fileKey')=? AND json_extract(version.value,'$.event')='review')) LIMIT 1";
  if (kind === "submission") return "SELECT created_by,group_id FROM records WHERE kind='submission' AND (json_extract(data_json,'$.fileKey')=? OR EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(records.data_json,'$.workHistory'),'[]')) AS version WHERE json_extract(version.value,'$.fileKey')=? AND json_extract(version.value,'$.event')='submission')) LIMIT 1";
  return "SELECT created_by,group_id FROM records WHERE kind='payment' AND json_extract(data_json,'$.proofKey')=? LIMIT 1";
}

function storedName(key: string) {
  const last = key.split("/").at(-1) ?? "archivo";
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i, "").slice(0, 240) || "archivo";
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    admin(current.profile);
    await enforceRateLimit(current.database, current.profile.id, "security:reconcile-files");

    const storage = bucket();
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await storage.list({ limit: 1000, cursor });
      keys.push(...page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor && keys.length < 5000);

    let registered = 0;
    let existing = 0;
    let orphaned = 0;
    let invalid = 0;

    for (const key of keys) {
      const parsed = storedObjectKey(key);
      if (!parsed) {
        invalid += 1;
        continue;
      }
      const present = await current.database.prepare("SELECT object_key FROM file_objects WHERE object_key=? LIMIT 1").bind(key).first();
      if (present) {
        existing += 1;
        continue;
      }
      const linked = await current.database.prepare(linkQuery(parsed.kind)).bind(key, ...(["submission", "review"].includes(parsed.kind) ? [key] : [])).first<LinkedRecord>();
      if (!linked) {
        orphaned += 1;
        continue;
      }
      const object = await storage.get(key);
      if (!object || object.size > MAX_UPLOAD_BYTES) {
        invalid += 1;
        continue;
      }
      const bytes = new Uint8Array(await object.arrayBuffer());
      const fallbackName = storedName(key);
      const originalName = text(object.customMetadata?.originalName, 240) || fallbackName;
      let inspected: ReturnType<typeof inspectUpload>;
      try {
        inspected = inspectUpload(parsed.kind, fallbackName, bytes);
      } catch (error) {
        if (error instanceof PublicError) {
          invalid += 1;
          continue;
        }
        throw error;
      }
      const ownerId = text(object.customMetadata?.uploadedBy, 100) || linked.created_by;
      const owner = await current.database.prepare("SELECT id FROM profiles WHERE id=? LIMIT 1").bind(ownerId).first();
      if (!owner) {
        invalid += 1;
        continue;
      }
      await current.database.prepare(`
        INSERT OR IGNORE INTO file_objects (object_key,kind,group_id,owner_id,original_name,stored_name,content_type,size_bytes,sha256,status)
        VALUES (?,?,?,?,?,?,?,?,?,'active')
      `).bind(key, parsed.kind, parsed.groupId, ownerId, originalName, fallbackName, inspected.contentType, bytes.byteLength, await sha256Hex(bytes)).run();
      registered += 1;
    }

    const summary = { scanned: keys.length, registered, existing, orphaned, invalid };
    await writeAudit(current.database, {
      actorId: current.profile.id,
      actorRole: current.profile.role,
      action: "file_inventory_reconciled",
      targetKind: "file_inventory",
      metadata: summary,
    });
    return Response.json({ ok: true, ...summary }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const issue = publicIssue(error, "No se pudo reconciliar el inventario de archivos.");
    return fail(issue.message, issue.status);
  }
}
