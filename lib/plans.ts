export const PLAN_NAMES = ["Bronce", "Plata", "Gold"] as const;
export type PlanName = typeof PLAN_NAMES[number];
export type FeatureOverride = "allow" | "deny";
export const PLAN_FEATURES = [
  { id: "complexive.materials", group: "Complexivos", label: "Materiales por materia y tema", minimum: "Bronce" },
  { id: "complexive.practice", group: "Complexivos", label: "Práctica por tema y formato", minimum: "Bronce" },
  { id: "complexive.simulator", group: "Complexivos", label: "Simuladores por materia", minimum: "Plata" },
  { id: "complexive.final_exam", group: "Complexivos", label: "Examen final combinado", minimum: "Plata" },
  { id: "final_degree.materials", group: "Fin de Carrera", label: "Materiales por materia y tema", minimum: "Bronce" },
  { id: "final_degree.practice", group: "Fin de Carrera", label: "Práctica por tema y formato", minimum: "Bronce" },
  { id: "final_degree.simulator", group: "Fin de Carrera", label: "Simuladores por materia", minimum: "Gold" },
  { id: "final_degree.final_exam", group: "Fin de Carrera", label: "Examen final combinado", minimum: "Gold" },
  { id: "resources.planning", group: "Recursos y cursos", label: "Planificaciones", minimum: "Bronce" },
  { id: "resources.curriculum", group: "Recursos y cursos", label: "Currículos", minimum: "Bronce" },
  { id: "resources.library", group: "Recursos y cursos", label: "Biblioteca y secciones de materiales", minimum: "Bronce" },
  { id: "resources.apa", group: "Recursos y cursos", label: "Normas APA y sus materiales", minimum: "Plata" },
  { id: "resources.courses", group: "Recursos y cursos", label: "Cursos, lecciones y avance", minimum: "Gold" },
  { id: "apa.reviewer", group: "Recursos y cursos", label: "Revisor orientativo de referencias APA", minimum: "Gold" },
  { id: "work.planning", group: "Trabajos UIC", label: "Entregar planificaciones para revisión", minimum: "Plata" },
  { id: "work.case_study", group: "Trabajos UIC", label: "Entregar estudios de caso para revisión", minimum: "Plata" },
] as const;
export type PlanFeature = typeof PLAN_FEATURES[number]["id"];
export type FeatureOverrides = Partial<Record<PlanFeature, FeatureOverride>>;
export type PlanTemplate = { plan: PlanName; featureOverrides: FeatureOverrides; reviewLimit: number; revision: string };
export type PlanCatalog = Record<PlanName, PlanTemplate>;
export type SectionMode = { id: string; mode: string };
export type PolicyContent = { id: string; kind: string; data: Record<string, unknown> };
export class PlanPolicyError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }

export const planRank = (value: unknown) => ({ Bronce: 1, Plata: 2, Gold: 3 })[String(value) as PlanName] || 0;
export const isPlanName = (value: unknown): value is PlanName => typeof value === "string" && (PLAN_NAMES as readonly string[]).includes(value);
export function isPlanActive(status: unknown, endsAt: unknown, now = Date.now()) {
  if (status !== "active" || typeof endsAt !== "string") return false;
  const expiresAt = Date.parse(endsAt); return Number.isFinite(expiresAt) && expiresAt > now;
}
export const defaultPlanCatalog = (): PlanCatalog => Object.fromEntries(PLAN_NAMES.map(plan => [plan, { plan, featureOverrides: {}, reviewLimit: plan === "Gold" ? 3 : 1, revision: "initial" }])) as PlanCatalog;
export const planTemplateId = (plan: PlanName) => `plan-template:${plan.toLowerCase()}`;
export const isPlanFeature = (value: string): value is PlanFeature => PLAN_FEATURES.some(feature => feature.id === value);
export function normalizedFeatureOverrides(input: unknown, strict = false): FeatureOverrides {
  if (!input || typeof input !== "object" || Array.isArray(input)) { if (strict) throw new PlanPolicyError("Selecciona las opciones de acceso."); return {}; }
  const result: FeatureOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isPlanFeature(key) || typeof value !== "string" || !["allow", "deny", "default"].includes(value)) { if (strict) throw new PlanPolicyError("Hay una opción de acceso no válida."); continue; }
    if (value === "allow" || value === "deny") result[key] = value;
  }
  return result;
}
export function normalizedReviewLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) throw new PlanPolicyError("Elige de 0 a 100 correcciones por proyecto.");
  return value;
}
export function planCatalogFromRows(rows: { id: string; kind: string; status: string; data: Record<string, unknown> }[]) {
  const catalog = defaultPlanCatalog();
  for (const row of rows) {
    const plan = row.data.plan;
    if (row.kind !== "plan_template" || row.status !== "published" || !isPlanName(plan) || row.id !== planTemplateId(plan)) continue;
    catalog[plan] = { plan, featureOverrides: normalizedFeatureOverrides(row.data.featureOverrides), reviewLimit: typeof row.data.reviewLimit === "number" && Number.isInteger(row.data.reviewLimit) && row.data.reviewLimit >= 0 && row.data.reviewLimit <= 100 ? row.data.reviewLimit : catalog[plan].reviewLimit, revision: String(row.data.revision || "initial") };
  }
  return catalog;
}
export function defaultFeatureEnabled(plan: unknown, feature: PlanFeature) {
  return planRank(plan) >= planRank(PLAN_FEATURES.find(option => option.id === feature)!.minimum);
}
export function sectionPlanFeature(section: SectionMode): PlanFeature {
  if (section.mode === "courses") return "resources.courses";
  if (section.mode === "apa") return "resources.apa";
  if (section.id === "planning") return "resources.planning";
  if (section.id === "curriculum") return "resources.curriculum";
  return "resources.library";
}
export function contentPlanFeature(row: PolicyContent, sections: SectionMode[] = []): PlanFeature | null {
  if (row.kind === "course") return "resources.courses";
  const area = row.data.area;
  if (area === "complexive" || area === "final_degree") {
    if (row.kind === "resource") return `${area}.materials`;
    if (row.kind === "question") return `${area}.practice`;
    if (row.kind === "simulator") return `${area}.${row.data.mode === "final" || row.data.type === "final" || ["general", "diagnostic"].includes(String(row.data.type)) ? "final_exam" : "simulator"}`;
  }
  if (row.kind === "resource" && area === "resources") {
    const category = String(row.data.category || "other"), section = sections.find(item => item.id === category);
    return sectionPlanFeature(section || { id: category, mode: category === "apa" ? "apa" : category === "courses" ? "courses" : "materials" });
  }
  return null;
}
const permissions = (group: Record<string, unknown>) => Array.isArray(group.permissions) ? group.permissions.filter((value): value is string => typeof value === "string") : [];
export const LEGACY_MODULE_PERMISSIONS = ["all", "resource", "question", "simulator", "course", "complexive", "final_degree", "resources", "submission"];
export function legacyFeatureAllowed(group: Record<string, unknown>, feature: PlanFeature, row?: PolicyContent) {
  const granted = permissions(group), area = feature.split(".")[0];
  if (granted.includes("all") || (row && [row.id, row.kind, String(row.data.area || "")].some(key => key && granted.includes(key)))) return true;
  if (["complexive", "final_degree"].includes(area)) return granted.includes(area) || granted.includes(feature.endsWith("materials") ? "resource" : feature.endsWith("practice") ? "question" : "simulator");
  if (feature.startsWith("work.")) return granted.includes("submission");
  if (feature === "resources.courses") return granted.includes("course") || granted.includes("resources");
  if (feature === "apa.reviewer") return granted.includes("resources") || granted.includes("apa.reviewer");
  return feature.startsWith("resources.") && (granted.includes("resource") || granted.includes("resources"));
}
export function editableGroupOverrides(group: Record<string, unknown>): FeatureOverrides {
  const overrides = Object.fromEntries(PLAN_FEATURES.filter(feature => legacyFeatureAllowed(group, feature.id)).map(feature => [feature.id, "allow"])) as FeatureOverrides;
  return { ...overrides, ...normalizedFeatureOverrides(group.featureOverrides) };
}
// Explicit group choices win over the plan template; an explicit denial wins
// over old broad grants. New managed permissions expire with the group plan.
export function canUsePlanFeature(group: Record<string, unknown>, feature: PlanFeature, catalog: PlanCatalog = defaultPlanCatalog(), requiredPlan?: unknown, row?: PolicyContent, now = Date.now()) {
  const active = isPlanActive(group.planStatus, group.endsAt, now), template = isPlanName(group.plan) ? catalog[group.plan] : null;
  if (group.accessPolicyVersion === 1 && !active) return false;
  const individual = normalizedFeatureOverrides(group.featureOverrides)[feature];
  if (individual) return individual === "allow" && active;
  const global = template?.featureOverrides[feature];
  if (global) return global === "allow" && active;
  if (legacyFeatureAllowed(group, feature, row)) return true;
  return active && defaultFeatureEnabled(group.plan, feature) && (requiredPlan === undefined || planRank(group.plan) >= (planRank(requiredPlan) || 1));
}
export function groupReviewLimit(group: Record<string, unknown>, catalog: PlanCatalog = defaultPlanCatalog()) {
  if (typeof group.reviewLimit === "number" && Number.isInteger(group.reviewLimit) && group.reviewLimit >= 0 && group.reviewLimit <= 100) return group.reviewLimit;
  const template = isPlanName(group.plan) ? catalog[group.plan] : null;
  if (group.accessPolicyVersion !== 1 && permissions(group).includes("all") && template?.revision === "initial") return 99;
  return template?.reviewLimit ?? 1;
}
