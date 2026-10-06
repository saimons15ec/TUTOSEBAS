import { AdditionalResourceError, additionalCategory, isAcademicResource, normalizedAdditionalResource, normalizedResourceMetadata, resourceInCurrentPeriod, type AdditionalResourceRow } from "./additional-resources.ts";
import { assertActiveAdministrator } from "./security.ts";
import { assertActiveResourceSection, resourceSectionGuard } from "./resource-sections-storage.ts";

type Stored = { id: string; kind: string; title: string; status: string; data_json: string };
async function existing(database: D1Database, id: string) {
  const row = await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE id=? AND kind IN ('resource','course')").bind(id).first<Stored>();
  if (!row) throw new AdditionalResourceError("Recurso no encontrado.", 404);
  return { row, resource: { ...row, data: JSON.parse(row.data_json) } as AdditionalResourceRow };
}
export async function updateAdditionalResource(database: D1Database, id: string, titleInput: unknown, input: Record<string, unknown>, actor: { role: string; status: string }, period?: string) {
  assertActiveAdministrator(actor.role, actor.status);
  const { row, resource } = await existing(database, id);
  if (isAcademicResource(resource) || (row.kind === "resource" && resource.data.area !== "resources")) throw new AdditionalResourceError("Edita este material desde su materia; aquí puedes cambiar su referencia de apoyo.");
  if (row.status === "archived") throw new AdditionalResourceError("Restaura el recurso antes de editarlo.", 409);
  if (period && !resourceInCurrentPeriod(resource.data, period)) throw new AdditionalResourceError("Los recursos históricos se conservan en su periodo.", 409);
  const title = typeof titleInput === "string" ? titleInput.trim().slice(0, 180) : "";
  if (!title) throw new AdditionalResourceError("Escribe un título.");
  const metadata = normalizedResourceMetadata(row.kind, { ...resource.data, ...input });
  if (period) await assertActiveResourceSection(database, input.category ?? metadata.category, period, row.kind);
  const guard = period ? resourceSectionGuard(period, metadata.category, row.kind) : { sql: "1=1", values: [] };
  // Change only editable metadata. Attachments, period and course data remain on their original record.
  const result = await database.prepare(`UPDATE records SET title=?,status='draft',data_json=json_set(data_json,'$.category',?,'$.plan',?,'$.description',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind=? AND title=? AND status=? AND data_json=? AND ${guard.sql}`).bind(title, metadata.category, metadata.plan, metadata.description, id, row.kind, row.title, row.status, row.data_json, ...guard.values).run();
  if (result.meta.changes !== 1) throw new AdditionalResourceError("El recurso cambió mientras lo editabas. Actualiza y vuelve a intentarlo.", 409);
  return { id, status: "draft" };
}
export async function setAdditionalResourceReference(database: D1Database, id: string, categoryInput: unknown, period: string, actor: { role: string; status: string }) {
  assertActiveAdministrator(actor.role, actor.status);
  const { row, resource } = await existing(database, id);
  if (!isAcademicResource(resource) || row.status === "archived" || resource.data.period !== period) throw new AdditionalResourceError("Selecciona un material activo de una materia del periodo vigente.");
  const category = categoryInput === null ? null : additionalCategory(categoryInput);
  if (category) await assertActiveResourceSection(database, category, period);
  const guard = category ? resourceSectionGuard(period, category) : { sql: "1=1", values: [] };
  const sql = category === null ? "json_remove(data_json,'$.additionalCategory')" : "json_set(data_json,'$.additionalCategory',?)";
  const values = category === null ? [] : [category];
  const result = await database.prepare(`UPDATE records SET data_json=${sql},updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='resource' AND status=? AND data_json=? AND ${guard.sql}`).bind(...values, id, row.status, row.data_json, ...guard.values).run();
  if (result.meta.changes !== 1) throw new AdditionalResourceError("El material cambió. Actualiza y vuelve a intentarlo.", 409);
  return { id, category };
}
export async function replaceAdditionalResourceContent(database: D1Database, id: string, input: Record<string, unknown>, period: string, actor: { role: string; status: string }, verifyFile: (key: string) => Promise<boolean>) {
  assertActiveAdministrator(actor.role, actor.status);
  const { row, resource } = await existing(database, id);
  if (isAcademicResource(resource) || (row.kind === "resource" && resource.data.area !== "resources")) throw new AdditionalResourceError("Edita el material desde su materia.");
  if (row.status === "archived" || !resourceInCurrentPeriod(resource.data, period)) throw new AdditionalResourceError("Restaura el recurso o selecciona uno del periodo vigente.", 409);
  const content = normalizedAdditionalResource(row.kind, { ...resource.data, materialType: input.materialType, fileKey: input.fileKey, fileName: input.fileName, externalUrl: input.externalUrl }, String(resource.data.period || period));
  await assertActiveResourceSection(database, content.category, period, row.kind);
  const guard = resourceSectionGuard(period, content.category, row.kind);
  if (!content.fileKey && !content.externalUrl) throw new AdditionalResourceError("Selecciona el nuevo archivo o enlace.");
  if (content.fileKey && !(await verifyFile(content.fileKey))) throw new AdditionalResourceError("El archivo debe ser una carga válida de tu cuenta.");
  const data = { ...resource.data, materialType: content.materialType, fileKey: content.fileKey, fileName: content.fileName, externalUrl: content.externalUrl };
  const result = await database.prepare(`UPDATE records SET status='draft',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind=? AND status=? AND data_json=? AND ${guard.sql}`).bind(JSON.stringify(data), id, row.kind, row.status, row.data_json, ...guard.values).run();
  if (result.meta.changes !== 1) throw new AdditionalResourceError("El recurso cambió. Actualiza y vuelve a intentarlo.", 409);
  return { id, status: "draft" };
}
