import { Zip, ZipPassThrough } from "fflate";
import { PublicError, MAX_UPLOAD_BYTES } from "./security.ts";
import { sha256Hex } from "./security-storage.ts";

export async function privateBackupStream(database: D1Database, storage: R2Bucket) {
  // D1 batch keeps the academic tables in one snapshot. Session tokens and
  // provider passwords/keys are intentionally absent from a portable backup.
  const [profiles, records, files, audit, identities] = await database.batch<Record<string, unknown>>([
    database.prepare("SELECT * FROM profiles ORDER BY id"),
    database.prepare("SELECT * FROM records ORDER BY id"),
    database.prepare("SELECT * FROM file_objects ORDER BY object_key"),
    database.prepare("SELECT * FROM security_audit ORDER BY created_at DESC LIMIT 5000"),
    database.prepare("SELECT * FROM auth_identities ORDER BY profile_id"),
  ]);
  const objects: Array<{ key: string; size: number }> = []; let cursor: string | undefined;
  do {
    const page = await storage.list({ cursor, limit: 1000 });
    objects.push(...page.objects.map(object => ({ key: object.key, size: object.size })));
    cursor = page.truncated ? page.cursor : undefined;
    if (objects.length > 5000 || (cursor && objects.length >= 5000)) throw new PublicError("El inventario supera esta descarga. Usa un respaldo externo por lotes.", 409);
  } while (cursor);
  if (objects.some(object => object.size > MAX_UPLOAD_BYTES)) throw new PublicError("Un archivo supera el límite de respaldo por archivo. Usa la copia externa de R2.", 409);
  const inventory = new Map(objects.map(object => [object.key, object]));
  for (const row of files.results) if (row.status === "active" && !inventory.has(String(row.object_key))) throw new PublicError("Falta un archivo activo en R2. Revisa el inventario antes de respaldar.", 409);
  const generatedAt = new Date().toISOString();
  const backup = { format: "tutosebas-logical-backup", schemaVersion: 3, generatedAt,
    profiles: profiles.results, records: records.results, fileObjects: files.results, securityAudit: audit.results, authIdentities: identities.results,
    counts: { profiles: profiles.results.length, records: records.results.length, fileObjects: files.results.length, auditEvents: audit.results.length, authIdentities: identities.results.length, r2Objects: objects.length } };
  const recorded = new Map(files.results.map(row => [String(row.object_key), row]));
  const encode = (data: unknown) => new TextEncoder().encode(JSON.stringify(data, null, 2));
  async function* chunks() {
    const pending: Uint8Array[] = []; let issue: Error | undefined;
    const zip = new Zip((error, data) => { if (error) issue = error; else pending.push(data); });
    const manifest: Array<{ key: string; path: string; size: number; sha256: string; registered: boolean }> = [];
    function put(path: string, bytes: Uint8Array) {
      const entry = new ZipPassThrough(path); zip.add(entry);
      for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) entry.push(bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.byteLength)), false);
      entry.push(new Uint8Array(), true);
    }
    put("backup.json", encode(backup)); while (pending.length) yield pending.shift()!;
    for (const [index, item] of objects.entries()) {
      const object = await storage.get(item.key);
      if (!object) throw new Error("Un archivo desapareció durante el respaldo.");
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (bytes.byteLength !== item.size || bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("Un archivo cambió durante el respaldo.");
      const sha256 = await sha256Hex(bytes); const registered = recorded.get(item.key);
      if (registered && (sha256 !== registered.sha256 || bytes.byteLength !== registered.size_bytes)) throw new Error("La integridad de un archivo no coincide con su registro.");
      const path = `objects/${String(index + 1).padStart(6, "0")}-${sha256.slice(0, 16)}.bin`;
      manifest.push({ key: item.key, path, size: bytes.byteLength, sha256, registered: Boolean(registered) });
      put(path, bytes); if (issue) throw issue; while (pending.length) yield pending.shift()!;
    }
    put("manifest.json", encode({ format: "tutosebas-private-backup", schemaVersion: 1, generatedAt, objects: manifest }));
    zip.end(); if (issue) throw issue; while (pending.length) yield pending.shift()!;
  }
  const iterator = chunks();
  return { counts: backup.counts, generatedAt, stream: new ReadableStream<Uint8Array>({
    async pull(controller) { try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(next.value); } catch (error) { controller.error(error); } },
    async cancel() { await iterator.return(undefined); },
  }) };
}
