export const ADDITIONAL_CATEGORIES = ["planning", "curriculum", "courses", "apa", "other"] as const;
export type AdditionalCategory = string;
export type ResourceSectionMode = "materials" | "courses" | "apa";
export type ResourceSection = { id: string; title: string; summary: string; description: string; examples: string; mode: ResourceSectionMode; order: number; revision: string; status: "published" | "archived" };
export const MAX_RESOURCE_SECTIONS = 50;
export const ADDITIONAL_LABELS: Record<AdditionalCategory, string> = { planning: "Planificaciones", curriculum: "Currículos", courses: "Cursos por lecciones", apa: "Normas APA", other: "Biblioteca general" };
export const ADDITIONAL_SECTIONS: Record<AdditionalCategory, { summary: string; description: string; examples: string }> = {
  planning: { summary: "Formatos y modelos para planificar.", description: "Organiza las planificaciones y los modelos que sirven para preparar clases, unidades y evaluaciones.", examples: "Planificaciones, formatos, modelos de unidad y guías para evaluar." },
  curriculum: { summary: "Documentos y orientaciones curriculares.", description: "Reúne los documentos curriculares y las orientaciones sobre objetivos, destrezas e indicadores.", examples: "Currículos, objetivos, destrezas, criterios e indicadores de evaluación." },
  courses: { summary: "Lecciones ordenadas con avance personal.", description: "Un curso reúne lecciones que el estudiante sigue en orden y puede marcar como completadas.", examples: "Cursos de refuerzo, talleres y rutas de aprendizaje con documentos, audios o videos." },
  apa: { summary: "Citas, referencias y presentación de trabajos.", description: "Encuentra modelos y materiales para citar fuentes, escribir referencias y presentar trabajos académicos.", examples: "Guías APA, ejemplos de citas, plantillas y listas de revisión." },
  other: { summary: "Guías, resúmenes, infografías y audios.", description: "Guarda aquí los materiales de consulta y refuerzo que apoyan el estudio en distintas materias.", examples: "Resúmenes, infografías, audios, presentaciones y enlaces de consulta." },
};
export const RESOURCE_MATERIAL_TYPES = ["Documento", "Resumen", "Infografía", "Audio", "Video", "Presentación", "Guía de estudio"] as const;
export type AdditionalResourceRow = { id: string; kind: string; title: string; status: string; data: Record<string, unknown> };
export class AdditionalResourceError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }

export const isCustomResourceSection = (value: unknown): value is string => typeof value === "string" && /^section_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const isResourceSectionId = (value: unknown): value is string => typeof value === "string" && ((ADDITIONAL_CATEGORIES as readonly string[]).includes(value) || isCustomResourceSection(value));
export const resourceSectionRecordId = (period: string, sectionId: string) => `resource-section:${period}:${sectionId}`;
export const defaultResourceSections = (): ResourceSection[] => ADDITIONAL_CATEGORIES.map((id, index) => ({ id, title: ADDITIONAL_LABELS[id], ...ADDITIONAL_SECTIONS[id], mode: id === "courses" ? "courses" : id === "apa" ? "apa" : "materials", order: index + 1, revision: "initial", status: "published" }));
export function resourceSections(rows: AdditionalResourceRow[], period: string, includeArchived = false): ResourceSection[] {
  const sections = new Map(defaultResourceSections().map(section => [section.id, section]));
  for (const row of rows) {
    const id = row.data.sectionId;
    if (row.kind !== "resource_section" || row.data.period !== period || !isResourceSectionId(id) || row.id !== resourceSectionRecordId(period, id) || !["published", "archived"].includes(row.status)) continue;
    const fallback = sections.get(id);
    const mode = ["materials", "courses", "apa"].includes(String(row.data.mode)) ? row.data.mode as ResourceSectionMode : fallback?.mode || "materials";
    sections.set(id, { id, title: row.title, mode, description: String(row.data.description || ""), summary: String(row.data.summary || row.data.description || ""), examples: String(row.data.examples || "Archivos y enlaces de apoyo."), order: Number(row.data.order) || fallback?.order || 1000, revision: String(row.data.revision || "initial"), status: row.status as ResourceSection["status"] });
  }
  return [...sections.values()].filter(section => includeArchived || section.status !== "archived").sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es") || a.id.localeCompare(b.id));
}

export function additionalCategory(value: unknown): AdditionalCategory {
  if (!isResourceSectionId(value)) throw new AdditionalResourceError("Selecciona una sección válida de Recursos y cursos.");
  return value;
}
export function isAcademicResource(row: AdditionalResourceRow) { return row.kind === "resource" && ["complexive", "final_degree"].includes(String(row.data.area)); }
export function resourceInCurrentPeriod(data: Record<string, unknown>, period: string) { return !data.period || data.period === period; }
export function resourceCategory(row: AdditionalResourceRow): AdditionalCategory | null {
  if (row.kind === "course") return isCustomResourceSection(row.data.category) ? row.data.category : "courses";
  if (row.kind !== "resource") return null;
  if (isAcademicResource(row)) return isResourceSectionId(row.data.additionalCategory) ? row.data.additionalCategory : null;
  if (row.data.area !== "resources") return null;
  return isResourceSectionId(row.data.category) ? row.data.category : "other";
}
export function additionalResourceCatalog<T extends AdditionalResourceRow>(rows: T[], period: string, archived = false): T[] {
  const seen = new Set<string>();
  return rows.filter(row => { if (seen.has(row.id) || !resourceCategory(row) || (!archived && row.status === "archived") || !resourceInCurrentPeriod(row.data, period)) return false; seen.add(row.id); return true; });
}
const searchKey = (value: unknown) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
export function filterAdditionalResources<T extends AdditionalResourceRow>(rows: T[], query: string, materialType: string, related: AdditionalResourceRow[] = [], sections: ResourceSection[] = defaultResourceSections()) {
  const key = searchKey(query).trim();
  return rows.filter(row => {
    const lessons = row.kind === "course" ? related.filter(item => item.kind === "course_lesson" && item.status !== "archived" && item.data.courseId === row.id) : [];
    const contexts = [row, ...lessons];
    return (!materialType || contexts.some(item => String(item.data.materialType || "Documento") === materialType && (item.kind !== "course" || item.data.fileKey || item.data.externalUrl || !lessons.length))) && (!key || contexts.some(item => searchKey([item.title, item.data.description, item.data.subject, item.data.topic, sections.find(section => section.id === resourceCategory(row))?.title].join(" ")).includes(key)));
  });
}
function bounded(value: unknown, limit: number) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
export function normalizedResourceMetadata(kind: string, input: Record<string, unknown>) {
  if (!["resource", "course"].includes(kind)) throw new AdditionalResourceError("Selecciona un recurso o curso.");
  const category = kind === "course" ? isCustomResourceSection(input.category) ? input.category : "courses" : additionalCategory(input.category ?? "other");
  const plan = input.plan ?? "Bronce";
  if (!["Bronce", "Plata", "Gold"].includes(String(plan))) throw new AdditionalResourceError("Selecciona un plan válido.");
  return { category, plan: String(plan), description: bounded(input.description, 4000) };
}
export function normalizedAdditionalResource(kind: string, input: Record<string, unknown>, period: string) {
  const metadata = normalizedResourceMetadata(kind, input), materialType = input.materialType ?? "Documento";
  if (!RESOURCE_MATERIAL_TYPES.includes(materialType as typeof RESOURCE_MATERIAL_TYPES[number])) throw new AdditionalResourceError("Selecciona un tipo de material válido.");
  const rawUrl = bounded(input.externalUrl, 1000); let externalUrl: string | null = null;
  if (rawUrl) { try { const url = new URL(rawUrl); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); externalUrl = url.toString(); } catch { throw new AdditionalResourceError("El enlace debe comenzar con http:// o https:// y no incluir contraseñas."); } }
  const fileKey = bounded(input.fileKey, 400), fileName = bounded(input.fileName, 240);
  if (materialType === "Video" && !externalUrl) throw new AdditionalResourceError("Añade el enlace del video.");
  if (materialType === "Audio" && !fileKey) throw new AdditionalResourceError("Adjunta el archivo de audio.");
  if (materialType === "Audio" && !/\.(mp3|m4a|wav|ogg)$/i.test(fileKey)) throw new AdditionalResourceError("El tipo Audio necesita un archivo MP3, M4A, WAV u OGG.");
  return { ...metadata, area: "resources", period, materialType: String(materialType), subject: bounded(input.subject, 180), externalUrl, fileKey: fileKey || null, fileName: fileName || null, ...(kind === "course" ? { lessons: 0, minutes: 0 } : {}) };
}
