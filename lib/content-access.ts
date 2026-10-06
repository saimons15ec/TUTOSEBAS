import { resourceInCurrentPeriod, type AdditionalResourceRow } from "./additional-resources.ts";
import { canUsePlanFeature, contentPlanFeature, type PlanCatalog, type SectionMode } from "./plans.ts";

export function canReadPublishedSupport(row: AdditionalResourceRow, group: Record<string, unknown>, period: string, catalog?: PlanCatalog, sections: SectionMode[] = []) {
  if (!["resource", "course"].includes(row.kind) || row.status !== "published" || !resourceInCurrentPeriod(row.data, period)) return false;
  if (row.kind === "resource" && ["complexive", "final_degree"].includes(String(row.data.area)) && row.data.period !== period) return false;
  const feature = contentPlanFeature(row, sections);
  return feature !== null && canUsePlanFeature(group, feature, catalog, row.data.plan || "Bronce", row);
}
