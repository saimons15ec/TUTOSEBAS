import assert from "node:assert/strict";
import test from "node:test";
import { assertTrustedMutation, inspectUpload, objectKeyMatches, PublicError, publicIssue, readBoundedBytes, readJsonObject, resolveProfileAccess, storedObjectKey } from "../lib/security.ts";
import { enforceRateLimit, rateLimitPolicy, sha256Hex, verifiedRegisteredFile } from "../lib/security-storage.ts";
import { removeSubjectFromDistribution, sameSubject, subjectKey } from "../lib/subjects.ts";
import nextConfig from "../next.config.ts";

const encoder = new TextEncoder();
const objectKey = "submissions/grp_demo/2026-09/123e4567-e89b-42d3-a456-426614174000-trabajo.pdf";

test("accepts same-origin mutations and rejects cross-site requests", () => {
  const trusted = new Request("https://example.test/api/platform", { method: "POST", headers: { origin: "https://example.test", "sec-fetch-site": "same-origin" } });
  assert.doesNotThrow(() => assertTrustedMutation(trusted));

  const hostile = new Request("https://example.test/api/platform", { method: "POST", headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site" } });
  assert.throws(() => assertTrustedMutation(hostile), (error) => error instanceof PublicError && error.status === 403);
});

test("accepts only bounded JSON objects", async () => {
  const valid = new Request("https://example.test/api/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) });
  assert.deepEqual(await readJsonObject(valid), { action: "test" });

  const wrongType = new Request("https://example.test/api/platform", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  await assert.rejects(readJsonObject(wrongType), (error) => error instanceof PublicError && error.status === 415);

  const tooLarge = new Request("https://example.test/api/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(200) }) });
  await assert.rejects(readJsonObject(tooLarge, 32), (error) => error instanceof PublicError && error.status === 413);
});

test("stops streaming uploads when the real body exceeds the limit", async () => {
  const request = new Request("https://example.test/api/files", { method: "POST", body: "x".repeat(64) });
  await assert.rejects(readBoundedBytes(request, 32), (error) => error instanceof PublicError && error.status === 413);
  const valid = new Request("https://example.test/api/files", { method: "POST", body: "safe" });
  assert.equal(new TextDecoder().decode(await readBoundedBytes(valid, 32)), "safe");
});

test("checks object keys by exact type and group", () => {
  assert.deepEqual(storedObjectKey(objectKey), { kind: "submission", groupId: "grp_demo" });
  assert.equal(objectKeyMatches(objectKey, "submission", "grp_demo"), true);
  assert.equal(objectKeyMatches(objectKey, "submission", "grp_other"), false);
  assert.equal(storedObjectKey("submissions/grp_demo/../../secret"), null);
});

test("requires an active exact registry entry before serving a file", async () => {
  let row: { kind: string; group_id: string; owner_id: string; status: string } | null = null;
  const database = {
    prepare: () => ({
      bind: () => ({ first: async () => row }),
    }),
  } as unknown as D1Database;

  assert.equal(await verifiedRegisteredFile(database, objectKey, "submission", "grp_demo"), null);
  row = { kind: "submission", group_id: "grp_demo", owner_id: "profile-1", status: "active" };
  assert.equal(await verifiedRegisteredFile(database, objectKey, "submission", "grp_demo"), true);
  assert.equal(await verifiedRegisteredFile(database, objectKey, "submission", "grp_other"), false);
  row.status = "archived";
  assert.equal(await verifiedRegisteredFile(database, objectKey, "submission", "grp_demo"), false);
});

test("validates file signatures and blocks active content", () => {
  const pdf = encoder.encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
  assert.equal(inspectUpload("submission", "Trabajo Final.PDF", pdf).contentType, "application/pdf");

  const activePdf = encoder.encode("%PDF-1.7\n1 0 obj\n<< /OpenAction 2 0 R /JavaScript 3 0 R >>\n%%EOF");
  assert.throws(() => inspectUpload("submission", "trabajo.pdf", activePdf), PublicError);

  const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  assert.throws(() => inspectUpload("submission", "engaño.pdf", executable), PublicError);
});

test("rejects Office macros and embedded objects", () => {
  const safeDocx = encoder.encode("PK\u0003\u0004[Content_Types].xml word/document.xml");
  assert.equal(inspectUpload("submission", "trabajo.docx", safeDocx).extension, ".docx");

  const macroDocx = encoder.encode("PK\u0003\u0004[Content_Types].xml word/document.xml word/vbaProject.bin");
  assert.throws(() => inspectUpload("submission", "trabajo.docx", macroDocx), PublicError);
  assert.throws(() => inspectUpload("payment", "comprobante.docx", safeDocx), PublicError);
});

test("does not expose unexpected internal errors", () => {
  assert.deepEqual(publicIssue(new PublicError("Dato inválido.", 422), "Error genérico."), { message: "Dato inválido.", status: 422 });
  const original = console.error;
  console.error = () => undefined;
  try {
    assert.deepEqual(publicIssue(new Error("SQL secret detail"), "Error genérico."), { message: "Error genérico.", status: 500 });
  } finally {
    console.error = original;
  }
});

test("activates configured administrators even when their test profile was pending", () => {
  const admins = new Set(["principal@example.com"]);
  assert.deepEqual(resolveProfileAccess(admins, "principal@example.com", "pending"), { role: "admin", status: "active" });
  assert.deepEqual(resolveProfileAccess(admins, "student@example.com", "invited"), { role: "student", status: "active" });
  assert.deepEqual(resolveProfileAccess(admins, "student@example.com", "pending"), { role: "student", status: "pending" });
});

test("applies security headers to the exact root route", async () => {
  const routes = await nextConfig.headers?.();
  assert.ok(Array.isArray(routes));
  const root = routes.find((route) => route.source === "/");
  assert.ok(root);
  const names = new Set(root.headers.map((header) => header.key.toLowerCase()));
  for (const required of ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) {
    assert.equal(names.has(required), true, `missing ${required}`);
  }
});

test("uses stricter distributed limits for sensitive actions", () => {
  assert.deepEqual(rateLimitPolicy("report_payment"), { limit: 5, windowSeconds: 3600 });
  assert.deepEqual(rateLimitPolicy("files:write"), { limit: 20, windowSeconds: 3600 });
  assert.deepEqual(rateLimitPolicy("security:reconcile-files"), { limit: 5, windowSeconds: 3600 });
  assert.deepEqual(rateLimitPolicy("ordinary_action"), { limit: 120, windowSeconds: 300 });
});

test("rejects requests beyond a distributed rate-limit window", async () => {
  let count = 0;
  const database = {
    prepare: () => ({
      bind: () => ({ first: async () => ({ count: ++count }) }),
    }),
  } as unknown as D1Database;

  for (let index = 0; index < 5; index += 1) await enforceRateLimit(database, "profile-1", "report_payment");
  await assert.rejects(
    () => enforceRateLimit(database, "profile-1", "report_payment"),
    (error: unknown) => error instanceof PublicError && error.status === 429,
  );
});

test("generates a stable SHA-256 fingerprint for uploaded bytes", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode("TUTOSEBAS")), "962a6220ad1467ee458c3650ee760e39a8f9a7c6a48693c6e7df55d171cb27a1");
});

test("matches subjects consistently and removes them from final-exam distributions", () => {
  assert.equal(subjectKey("  Lengua Y Literatura "), "lengua y literatura");
  assert.equal(sameSubject("Fundamentos de Lengua", "fundamentos de lengua"), true);
  const result = removeSubjectFromDistribution([
    { subject: "Fundamentos de Lengua", count: 7 },
    { subject: "Didáctica", count: 5 },
  ], "fundamentos de lengua");
  assert.deepEqual(result, { changed: true, distribution: [{ subject: "Didáctica", count: 5 }], count: 5 });
});
