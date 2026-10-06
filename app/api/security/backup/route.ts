import { admin, bucket, context } from "@/lib/uic";
import { publicIssue } from "@/lib/security";
import { enforceRateLimit, writeAudit } from "@/lib/security-storage";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  try {
    const current = await context();
    if (!current) return fail("Debes iniciar sesión.", 401);
    admin(current.profile);
    await enforceRateLimit(current.database, current.profile.id, "security:backup");

    const [profiles, records, files, audit, identities] = await Promise.all([
      current.database.prepare("SELECT * FROM profiles ORDER BY created_at").all(),
      current.database.prepare("SELECT * FROM records ORDER BY created_at").all(),
      current.database.prepare("SELECT * FROM file_objects ORDER BY created_at").all(),
      current.database.prepare("SELECT * FROM security_audit ORDER BY created_at DESC LIMIT 5000").all(),
      current.database.prepare("SELECT * FROM auth_identities ORDER BY profile_id").all(),
    ]);

    const r2Objects: Array<{ key: string; size: number; etag: string; uploaded: string }> = [];
    let cursor: string | undefined;
    let truncated = false;
    do {
      const page = await bucket().list({ limit: 1000, cursor });
      r2Objects.push(...page.objects.map((object) => ({
        key: object.key,
        size: object.size,
        etag: object.etag,
        uploaded: object.uploaded.toISOString(),
      })));
      cursor = page.truncated ? page.cursor : undefined;
      truncated = page.truncated;
    } while (cursor && r2Objects.length < 5000);

    const generatedAt = new Date().toISOString();
    const payload = {
      format: "tutosebas-logical-backup",
      schemaVersion: 3,
      generatedAt,
      warning: "Este respaldo lógico contiene D1 y el inventario de R2. Conserva además una copia externa de los archivos binarios de R2.",
      counts: {
        profiles: profiles.results.length,
        records: records.results.length,
        fileObjects: files.results.length,
        auditEvents: audit.results.length,
        r2Objects: r2Objects.length,
        authIdentities: identities.results.length,
      },
      r2InventoryTruncated: Boolean(truncated && r2Objects.length >= 5000),
      profiles: profiles.results,
      records: records.results,
      fileObjects: files.results,
      securityAudit: audit.results,
      authIdentities: identities.results,
      r2Objects,
    };

    await writeAudit(current.database, {
      actorId: current.profile.id,
      actorRole: current.profile.role,
      action: "logical_backup_downloaded",
      targetKind: "security_backup",
      metadata: payload.counts,
    });

    const stamp = generatedAt.slice(0, 10);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="tutosebas-respaldo-${stamp}.json"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const issue = publicIssue(error, "No se pudo generar el respaldo lógico.");
    return fail(issue.message, issue.status);
  }
}
