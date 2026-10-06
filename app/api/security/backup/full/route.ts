import { admin, bucket, context } from "@/lib/uic";
import { publicIssue } from "@/lib/security";
import { enforceRateLimit, writeAudit } from "@/lib/security-storage";
import { privateBackupStream } from "@/lib/private-backup";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const current = await context();
    if (!current) return Response.json({ error: "Debes iniciar sesión." }, { status: 401, headers: { "cache-control": "no-store" } });
    admin(current.profile); await enforceRateLimit(current.database, current.profile.id, "security:backup");
    const backup = await privateBackupStream(current.database, bucket());
    await writeAudit(current.database, { actorId: current.profile.id, actorRole: current.profile.role, action: "private_backup_requested", targetKind: "security_backup", metadata: backup.counts });
    return new Response(backup.stream, { headers: { "cache-control": "private, no-store", "content-type": "application/zip", "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename="tutosebas-respaldo-privado-${backup.generatedAt.slice(0, 10)}.zip"` } });
  } catch (error) { const issue = publicIssue(error, "No se pudo preparar el respaldo completo."); return Response.json({ error: issue.message }, { status: issue.status, headers: { "cache-control": "no-store" } }); }
}
