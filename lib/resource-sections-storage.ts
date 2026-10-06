import { ADDITIONAL_CATEGORIES, AdditionalResourceError, MAX_RESOURCE_SECTIONS, additionalCategory, defaultResourceSections, resourceSectionRecordId, resourceSections, type AdditionalResourceRow, type ResourceSection, type ResourceSectionMode } from "./additional-resources.ts";
import { assertActiveAdministrator } from "./security.ts";

type Stored = { id: string; kind: string; title: string; status: string; data_json: string };
type Actor = { id?: string; role: string; status: string };
const revision = () => crypto.randomUUID();
const unpack = (row: Stored): AdditionalResourceRow => ({ ...row, data: JSON.parse(row.data_json) });
const nameKey = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
const scoped = "kind='resource_section' AND json_extract(data_json,'$.period')=?";

export async function loadResourceSections(database: D1Database, period: string) {
  const rows = await database.prepare(`SELECT id,kind,title,status,data_json FROM records WHERE ${scoped}`).bind(period).all<Stored>();
  return { stored: rows.results, sections: resourceSections(rows.results.map(unpack), period, true) };
}

export async function assertActiveResourceSection(database: D1Database, sectionId: unknown, period: string, kind = "resource") {
  const id = additionalCategory(sectionId);
  const { sections } = await loadResourceSections(database, period);
  const section = sections.find(row => row.id === id && row.status === "published");
  if (!section) throw new AdditionalResourceError("Esa sección ya no está disponible. Actualiza y selecciona otra.", 409);
  if (kind === "course" && section.mode !== "courses") throw new AdditionalResourceError("Selecciona una sección de cursos para guardar las lecciones.");
  return section;
}

// Repeat the section check inside each content write, so a concurrently retired section cannot receive new content.
export function resourceSectionGuard(period: string, sectionId: string, kind = "resource") {
  const recordId = resourceSectionRecordId(period, sectionId);
  const fallback = defaultResourceSections().find(section => section.id === sectionId && (kind !== "course" || section.mode === "courses"));
  const mode = kind === "course" ? " AND json_extract(rs.data_json,'$.mode')='courses'" : "";
  return {
    sql: `(EXISTS(SELECT 1 FROM records rs WHERE rs.id=? AND rs.kind='resource_section' AND rs.status='published' AND json_extract(rs.data_json,'$.period')=?${mode})${fallback ? " OR NOT EXISTS(SELECT 1 FROM records WHERE id=?)" : ""})`,
    values: fallback ? [recordId, period, recordId] : [recordId, period],
  };
}

async function initialize(database: D1Database, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const defaults = defaultResourceSections().map(section => ({ rowId: resourceSectionRecordId(period, section.id), title: section.title, data: { period, sectionId: section.id, mode: section.mode, order: section.order, description: section.description, summary: section.summary, examples: section.examples, revision: "initial", nameKey: nameKey(section.title) } }));
  await database.prepare("INSERT INTO records(id,kind,title,status,data_json,created_by) SELECT json_extract(value,'$.rowId'),'resource_section',json_extract(value,'$.title'),'published',json_extract(value,'$.data'),? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO NOTHING").bind(actor.id || "administrator", JSON.stringify(defaults)).run();
  return loadResourceSections(database, period);
}

function stale(section: ResourceSection, expected: unknown) {
  if (expected !== section.revision) throw new AdditionalResourceError("La sección cambió. Actualiza antes de continuar.", 409);
}
function metadata(input: Record<string, unknown>) {
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (!title || title.length > 80 || /[\u0000-\u001f]/.test(title)) throw new AdditionalResourceError("Escribe un nombre de sección de hasta 80 caracteres.");
  const description = input.description === undefined ? "" : input.description;
  if (typeof description !== "string" || description.length > 600) throw new AdditionalResourceError("La descripción admite hasta 600 caracteres.");
  return { title, description: description.trim(), summary: description.trim().slice(0, 120), nameKey: nameKey(title) };
}
const modeExamples: Record<ResourceSectionMode, string> = { materials: "Documentos, infografías, audios, presentaciones y enlaces de consulta.", courses: "Cursos con lecciones, materiales de apoyo y avance personal.", apa: "Guías, citas, referencias, plantillas y listas de revisión." };

export async function saveResourceSection(database: D1Database, input: Record<string, unknown>, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const clean = metadata(input), modeInput = input.mode ?? "materials";
  if (!["materials", "courses", "apa"].includes(String(modeInput))) throw new AdditionalResourceError("Selecciona el tipo de sección.");
  const { stored, sections } = await initialize(database, period, actor);
  const active = sections.filter(section => section.status === "published");
  const editing = input.sectionId !== undefined && input.sectionId !== "";
  const id = editing ? additionalCategory(input.sectionId) : `section_${crypto.randomUUID()}`;
  const previous = sections.find(section => section.id === id);
  if (editing && (!previous || previous.status !== "published")) throw new AdditionalResourceError("Restaura la sección antes de editarla.", 409);
  if (previous) stale(previous, input.revision);
  if (active.some(section => section.id !== id && nameKey(section.title) === clean.nameKey)) throw new AdditionalResourceError("Ya existe una sección con ese nombre.");
  if (!editing && active.length >= MAX_RESOURCE_SECTIONS) throw new AdditionalResourceError(`Puedes mantener hasta ${MAX_RESOURCE_SECTIONS} secciones activas.`);
  const mode = previous?.mode || modeInput as ResourceSectionMode;
  if (previous && input.mode !== undefined && input.mode !== previous.mode) throw new AdditionalResourceError("El tipo de una sección se conserva. Crea otra para una organización distinta.");
  const nextRevision = revision(), recordId = resourceSectionRecordId(period, id);
  const old = stored.find(row => row.id === recordId);
  const data = { ...(old ? JSON.parse(old.data_json) : {}), period, sectionId: id, mode, order: previous?.order || Math.max(0, ...active.map(section => section.order)) + 1, ...clean, examples: old ? JSON.parse(old.data_json).examples : modeExamples[mode], revision: nextRevision };
  const unique = `NOT EXISTS(SELECT 1 FROM records WHERE ${scoped} AND status='published' AND id!=? AND json_extract(data_json,'$.nameKey')=?)`;
  const result = old
    ? await database.prepare(`UPDATE records SET title=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='resource_section' AND status='published' AND data_json=? AND ${unique}`).bind(clean.title, JSON.stringify(data), recordId, old.data_json, period, recordId, clean.nameKey).run()
    : await database.prepare(`INSERT INTO records(id,kind,title,status,data_json,created_by) SELECT ?,'resource_section',?,'published',?,? WHERE ${unique} AND (SELECT COUNT(*) FROM records WHERE ${scoped} AND status='published')<?`).bind(recordId, clean.title, JSON.stringify(data), actor.id || "administrator", period, recordId, clean.nameKey, period, MAX_RESOURCE_SECTIONS).run();
  if (result.meta.changes !== 1) throw new AdditionalResourceError("Cambió el catálogo o el nombre ya está ocupado. Actualiza y vuelve a intentarlo.", 409);
  return { id: recordId, sectionId: id, revision: nextRevision };
}

export async function moveResourceSection(database: D1Database, idInput: unknown, direction: unknown, expected: unknown, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  if (direction !== "up" && direction !== "down") throw new AdditionalResourceError("Selecciona subir o bajar.");
  const id = additionalCategory(idInput), { stored, sections } = await initialize(database, period, actor), active = sections.filter(section => section.status === "published");
  const index = active.findIndex(section => section.id === id);
  if (index < 0) throw new AdditionalResourceError("Sección no disponible.", 404);
  stale(active[index], expected);
  const peer = active[index + (direction === "up" ? -1 : 1)];
  if (!peer) return { id: resourceSectionRecordId(period, id), sectionId: id, moved: false };
  const source = stored.find(row => row.id === resourceSectionRecordId(period, id))!, target = stored.find(row => row.id === resourceSectionRecordId(period, peer.id))!;
  const snapshot = JSON.stringify([source, target]);
  const result = await database.prepare("WITH checked AS MATERIALIZED(SELECT COUNT(*) AS total FROM json_each(?) e JOIN records r ON r.id=json_extract(e.value,'$.id') AND r.kind='resource_section' AND r.status='published' AND r.data_json=json_extract(e.value,'$.data_json')) UPDATE records SET data_json=json_set(data_json,'$.order',CASE WHEN id=? THEN ? ELSE ? END,'$.revision',?),updated_at=CURRENT_TIMESTAMP WHERE id IN (?,?) AND (SELECT total FROM checked)=2").bind(snapshot, source.id, peer.order, active[index].order, revision(), source.id, target.id).run();
  if (result.meta.changes !== 2) throw new AdditionalResourceError("El orden cambió. Actualiza y vuelve a intentarlo.", 409);
  return { id: source.id, sectionId: id, moved: true };
}

// This is the SQL counterpart of resourceCategory, including the legacy fallback for unknown resource categories.
const customGlob = `section_${[8, 4, 4, 4, 12].map(length => "[0-9a-f]".repeat(length)).join("-")}`;
const categoryField = "json_extract(data_json,'$.category')";
const referenceField = "json_extract(data_json,'$.additionalCategory')";
const known = ADDITIONAL_CATEGORIES.map(id => `'${id}'`).join(",");
const valid = (field: string) => `(${field} IN (${known}) OR ${field} GLOB '${customGlob}')`;
const categorySql = `CASE WHEN kind='course' THEN CASE WHEN ${categoryField} GLOB '${customGlob}' THEN ${categoryField} ELSE 'courses' END WHEN json_extract(data_json,'$.area') IN ('complexive','final_degree') THEN CASE WHEN ${valid(referenceField)} THEN ${referenceField} END WHEN json_extract(data_json,'$.area')='resources' THEN CASE WHEN ${valid(categoryField)} THEN ${categoryField} ELSE 'other' END END`;
const sourceScope = `kind IN ('resource','course') AND (json_extract(data_json,'$.period') IS NULL OR json_extract(data_json,'$.period')='' OR json_extract(data_json,'$.period')=0 OR json_extract(data_json,'$.period')=?) AND (${categorySql})=?`;

export async function archiveResourceSection(database: D1Database, idInput: unknown, targetInput: unknown, expected: unknown, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const id = additionalCategory(idInput), { stored, sections } = await initialize(database, period, actor), active = sections.filter(section => section.status === "published");
  const section = active.find(row => row.id === id);
  if (!section) throw new AdditionalResourceError("Sección no disponible.", 404);
  stale(section, expected);
  if (active.length <= 1) throw new AdditionalResourceError("Conserva al menos una sección. Puedes crear otra antes de quitar esta.");
  const contents = await database.prepare(`SELECT id,kind,title,status,data_json FROM records WHERE ${sourceScope}`).bind(period, id).all<Stored>();
  const targetId = targetInput === undefined || targetInput === null || targetInput === "" ? null : additionalCategory(targetInput);
  if (targetId === id) throw new AdditionalResourceError("Selecciona una sección distinta como destino.");
  const target = targetId ? active.find(row => row.id === targetId) : null;
  if (targetId && !target) throw new AdditionalResourceError("El destino ya no está disponible.", 409);
  if (contents.results.length && !target) throw new AdditionalResourceError("Esta sección contiene materiales. Elige dónde conservarlos.");
  if (contents.results.some(row => row.kind === "course") && target?.mode !== "courses") throw new AdditionalResourceError("Los cursos deben moverse a otra sección de cursos para conservar sus lecciones.");
  const source = stored.find(row => row.id === resourceSectionRecordId(period, id))!;
  const destination = target && stored.find(row => row.id === resourceSectionRecordId(period, target.id))!;
  const data = { ...JSON.parse(source.data_json), revision: revision(), retiredTo: targetId };
  const targetGuard = destination ? "EXISTS(SELECT 1 FROM records WHERE id=? AND kind='resource_section' AND status='published' AND data_json=?)" : "1=1";
  const targetValues = destination ? [destination.id, destination.data_json] : [];
  const snapshot = JSON.stringify(contents.results);
  if (new TextEncoder().encode(snapshot).byteLength > 900_000) throw new AdditionalResourceError("Mueve algunos materiales desde Opciones antes de quitar una sección tan grande.");
  const result = await database.prepare(`WITH matched AS MATERIALIZED(SELECT COUNT(*) AS total FROM json_each(?) e JOIN records r ON r.id=json_extract(e.value,'$.id') AND r.kind=json_extract(e.value,'$.kind') AND r.status=json_extract(e.value,'$.status') AND r.data_json=json_extract(e.value,'$.data_json')),reviewed AS MATERIALIZED(SELECT 1 WHERE (SELECT total FROM matched)=? AND (SELECT COUNT(*) FROM records WHERE ${sourceScope})=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='resource_section' AND status='published' AND data_json=?) AND ${targetGuard} AND (SELECT COUNT(*) FROM records WHERE ${scoped} AND status='published')>1) UPDATE records SET status=CASE WHEN id=? THEN 'archived' ELSE status END,data_json=CASE WHEN id=? THEN ? WHEN kind='resource' AND json_extract(data_json,'$.area') IN ('complexive','final_degree') THEN json_set(data_json,'$.additionalCategory',?) ELSE json_set(data_json,'$.category',?) END,updated_at=CURRENT_TIMESTAMP WHERE (id=? OR (${sourceScope})) AND EXISTS(SELECT 1 FROM reviewed)`).bind(snapshot, contents.results.length, period, id, contents.results.length, source.id, source.data_json, ...targetValues, period, source.id, source.id, JSON.stringify(data), targetId, targetId, source.id, period, id).run();
  if (result.meta.changes !== contents.results.length + 1) throw new AdditionalResourceError("La sección o sus materiales cambiaron. No se movió contenido; actualiza y vuelve a intentarlo.", 409);
  return { id: source.id, sectionId: id, targetSectionId: targetId, moved: contents.results.length, revision: data.revision };
}

export async function restoreResourceSection(database: D1Database, idInput: unknown, expected: unknown, period: string, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const id = additionalCategory(idInput), { stored, sections } = await initialize(database, period, actor), section = sections.find(row => row.id === id);
  if (!section || section.status !== "archived") throw new AdditionalResourceError("Selecciona una sección retirada.");
  stale(section, expected);
  const source = stored.find(row => row.id === resourceSectionRecordId(period, id))!;
  const data = { ...JSON.parse(source.data_json), revision: revision() };
  const result = await database.prepare(`UPDATE records SET status='published',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='resource_section' AND status='archived' AND data_json=? AND (SELECT COUNT(*) FROM records WHERE ${scoped} AND status='published')<? AND NOT EXISTS(SELECT 1 FROM records WHERE ${scoped} AND status='published' AND json_extract(data_json,'$.nameKey')=?)`).bind(JSON.stringify(data), source.id, source.data_json, period, MAX_RESOURCE_SECTIONS, period, nameKey(section.title)).run();
  if (result.meta.changes !== 1) throw new AdditionalResourceError("No se pudo restaurar: revisa el límite de secciones, nombres repetidos o cambios recientes.", 409);
  return { id: source.id, sectionId: id, revision: data.revision };
}
