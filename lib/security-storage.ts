import { PublicError, type UploadKind } from "./security.ts";

export type AuditEvent = {
  actorId?: string | null;
  actorRole: string;
  action: string;
  targetKind?: string | null;
  targetId?: string | null;
  outcome?: "success" | "denied" | "failure";
  metadata?: Record<string, string | number | boolean | null>;
};

export type RateLimitPolicy = { limit: number; windowSeconds: number };

const RATE_POLICIES: Record<string, RateLimitPolicy> = {
  "platform:read": { limit: 180, windowSeconds: 300 },
  "files:read": { limit: 180, windowSeconds: 300 },
  "files:write": { limit: 20, windowSeconds: 3600 },
  "security:backup": { limit: 3, windowSeconds: 3600 },
  "security:reconcile-files": { limit: 5, windowSeconds: 3600 },
  report_payment: { limit: 5, windowSeconds: 3600 },
  submit_work: { limit: 10, windowSeconds: 3600 },
  start_simulator_attempt: { limit: 30, windowSeconds: 600 },
  finish_simulator_attempt: { limit: 30, windowSeconds: 600 },
  check_practice_answer: { limit: 240, windowSeconds: 300 },
};

export function rateLimitPolicy(scope: string): RateLimitPolicy {
  return RATE_POLICIES[scope] ?? { limit: 120, windowSeconds: 300 };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(database: D1Database, subjectId: string, scope: string) {
  const policy = rateLimitPolicy(scope);
  const windowStart = Math.floor(Date.now() / 1000 / policy.windowSeconds) * policy.windowSeconds;
  const key = await digest(`${subjectId}:${scope}:${windowStart}`);
  const row = await database.prepare(`
    INSERT INTO rate_limits (key,subject_id,scope,window_start,count,updated_at)
    VALUES (?,?,?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET count=count+1,updated_at=CURRENT_TIMESTAMP
    RETURNING count
  `).bind(key, subjectId, scope, windowStart).first<{ count: number }>();
  if (Number(row?.count ?? policy.limit + 1) > policy.limit) {
    throw new PublicError("Has realizado demasiadas solicitudes. Espera unos minutos e inténtalo nuevamente.", 429);
  }
  return { ...policy, count: Number(row?.count ?? 1), windowStart };
}

function auditMetadata(metadata: AuditEvent["metadata"]) {
  if (!metadata) return "{}";
  const safe = Object.fromEntries(Object.entries(metadata).slice(0, 20).map(([key, value]) => [key.slice(0, 80), typeof value === "string" ? value.slice(0, 500) : value]));
  return JSON.stringify(safe).slice(0, 8000);
}

export async function writeAudit(database: D1Database, event: AuditEvent) {
  await database.prepare(`
    INSERT INTO security_audit (id,actor_id,actor_role,action,target_kind,target_id,outcome,metadata_json)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    `audit_${crypto.randomUUID()}`,
    event.actorId ?? null,
    event.actorRole.slice(0, 30),
    event.action.slice(0, 80),
    event.targetKind?.slice(0, 80) ?? null,
    event.targetId?.slice(0, 160) ?? null,
    event.outcome ?? "success",
    auditMetadata(event.metadata),
  ).run();
}

export async function registerFile(database: D1Database, input: {
  objectKey: string;
  kind: UploadKind;
  groupId: string;
  ownerId: string;
  originalName: string;
  storedName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}) {
  await database.prepare(`
    INSERT INTO file_objects (object_key,kind,group_id,owner_id,original_name,stored_name,content_type,size_bytes,sha256,status)
    VALUES (?,?,?,?,?,?,?,?,?,'active')
  `).bind(input.objectKey, input.kind, input.groupId, input.ownerId, input.originalName, input.storedName, input.contentType, input.sizeBytes, input.sha256).run();
}

export async function verifiedRegisteredFile(database: D1Database, key: string, kind: UploadKind, groupId: string, ownerId?: string) {
  const row = await database.prepare("SELECT kind,group_id,owner_id,status FROM file_objects WHERE object_key=? LIMIT 1").bind(key).first<{ kind: string; group_id: string | null; owner_id: string; status: string }>();
  if (!row) return null;
  return row.status === "active" && row.kind === kind && row.group_id === groupId && (!ownerId || row.owner_id === ownerId);
}

export async function maybeRunSecurityMaintenance(database: D1Database) {
  const sample = crypto.getRandomValues(new Uint8Array(1))[0];
  if (sample !== 0) return;
  await database.batch([
    database.prepare("DELETE FROM rate_limits WHERE updated_at < datetime('now','-7 days')"),
    database.prepare("DELETE FROM security_audit WHERE created_at < datetime('now','-365 days')"),
  ]);
}
