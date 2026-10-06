import { assertActiveAdministrator } from "./security.ts";
import { LEGACY_MODULE_PERMISSIONS, PlanPolicyError, editableGroupOverrides, isPlanName, normalizedFeatureOverrides, normalizedReviewLimit, planCatalogFromRows, planTemplateId, type PlanCatalog } from "./plans.ts";

type Actor = { id: string; role: string; status: string };
type Stored = { id: string; kind: string; title: string; status: string; data_json: string };
const parse = (row: Stored) => ({ ...row, data: JSON.parse(row.data_json) as Record<string, unknown> });
export async function loadPlanCatalog(database: D1Database): Promise<PlanCatalog> {
  const rows = await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE kind='plan_template' AND status='published'").all<Stored>();
  return planCatalogFromRows(rows.results.map(parse));
}
export async function savePlanTemplate(database: D1Database, input: Record<string, unknown>, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  if (!isPlanName(input.plan)) throw new PlanPolicyError("Selecciona Bronce, Plata o Gold.");
  const plan = input.plan, id = planTemplateId(plan), overrides = normalizedFeatureOverrides(input.featureOverrides, true), reviewLimit = normalizedReviewLimit(input.reviewLimit);
  const old = await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE id=? AND kind='plan_template'").bind(id).first<Stored>();
  if (old && old.status !== "published") throw new PlanPolicyError("La configuración de este plan necesita revisión.", 409);
  const expected = old ? String(parse(old).data.revision || "initial") : "initial";
  if (input.revision !== expected) throw new PlanPolicyError("El plan cambió. Actualiza antes de guardar.", 409);
  const revision = crypto.randomUUID(), data = { plan, featureOverrides: overrides, reviewLimit, revision };
  const changed = old
    ? await database.prepare("UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='plan_template' AND status='published' AND data_json=?").bind(JSON.stringify(data), id, old.data_json).run()
    : await database.prepare("INSERT INTO records(id,kind,title,status,data_json,created_by) SELECT ?,'plan_template',?,'published',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE id=?)").bind(id, `Plan ${plan}`, JSON.stringify(data), actor.id, id).run();
  if (changed.meta.changes !== 1) throw new PlanPolicyError("Otro cambio modificó el plan. Actualiza y vuelve a intentarlo.", 409);
  return { id, plan, revision };
}
async function group(database: D1Database, id: string) {
  const row = await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE id=? AND kind='group'").bind(id).first<Stored>();
  if (!row) throw new PlanPolicyError("Grupo no encontrado.", 404);
  return { row, data: parse(row).data };
}
function stale(data: Record<string, unknown>, expected: unknown) {
  if (expected !== (data.accessRevision || "initial")) throw new PlanPolicyError("Los permisos del grupo cambiaron. Actualiza antes de guardar.", 409);
}
function applyOptions(data: Record<string, unknown>, input: Record<string, unknown>, mode: unknown) {
  if (mode !== "plan" && mode !== "custom") throw new PlanPolicyError("Elige opciones del plan o permisos personalizados.");
  if (mode === "plan") { data.permissions = []; data.featureOverrides = {}; delete data.reviewLimit; }
  else {
    data.featureOverrides = normalizedFeatureOverrides(input.featureOverrides, true);
    if (input.reviewLimit === null || input.reviewLimit === undefined) delete data.reviewLimit;
    else data.reviewLimit = normalizedReviewLimit(input.reviewLimit);
    // Broad older grants are represented in the editor as feature choices.
    // Preserve only older individual-content grants; an explicit denial wins.
    data.permissions = Array.isArray(data.permissions) ? data.permissions.filter(value => typeof value === "string" && !LEGACY_MODULE_PERMISSIONS.includes(value)) : [];
  }
  data.accessPolicyVersion = 1; data.accessRevision = crypto.randomUUID();
}
async function commitGroup(database: D1Database, row: Stored, data: Record<string, unknown>) {
  const changed = await database.prepare("UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='group' AND status=? AND data_json=?").bind(JSON.stringify(data), row.id, row.status, row.data_json).run();
  if (changed.meta.changes !== 1) throw new PlanPolicyError("El grupo cambió mientras guardabas. Actualiza y vuelve a intentarlo.", 409);
}
export async function saveGroupPermissions(database: D1Database, id: string, input: Record<string, unknown>, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const { row, data } = await group(database, id); stale(data, input.revision);
  applyOptions(data, input, input.permissionMode); await commitGroup(database, row, data);
  return { id, revision: String(data.accessRevision) };
}
export async function activateGroupPlan(database: D1Database, id: string, input: Record<string, unknown>, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  if (!isPlanName(input.plan)) throw new PlanPolicyError("Selecciona Bronce, Plata o Gold.");
  const days = input.days ?? 30;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 365) throw new PlanPolicyError("La vigencia debe ser un número entero de 1 a 365 días.");
  const { row, data } = await group(database, id);
  if (input.revision !== undefined) stale(data, input.revision);
  if (input.permissionMode !== undefined) applyOptions(data, input, input.permissionMode);
  else {
    // Compatibility with older group activation controls. Do not invent grants.
    if (input.permissions !== undefined) {
      if (!Array.isArray(input.permissions) || input.permissions.length > 100 || input.permissions.some(value => typeof value !== "string" || !LEGACY_MODULE_PERMISSIONS.includes(value))) throw new PlanPolicyError("Los permisos enviados no son válidos. Usa Planes y permisos.");
      data.featureOverrides = editableGroupOverrides({ permissions: input.permissions }); data.permissions = [];
    }
    data.accessPolicyVersion = 1; data.accessRevision = crypto.randomUUID();
  }
  const startsAt = new Date().toISOString(), endsAt = new Date(Date.now() + days * 86400000).toISOString();
  Object.assign(data, { plan: input.plan, planStatus: "active", startsAt, endsAt });
  await commitGroup(database, row, data);
  return { id, plan: input.plan, days, revision: String(data.accessRevision) };
}
