import { AdditionalResourceError, normalizedAdditionalResource, type AdditionalResourceRow } from "./additional-resources.ts";

export const MAX_COURSE_LESSONS = 100;
export function assertSupportContent(data: Record<string, unknown>) {
  if (!data.fileKey && !data.externalUrl) throw new AdditionalResourceError("Adjunta un archivo o añade un enlace antes de publicar el contenido.");
}
export function normalizedCourseLesson(input: Record<string, unknown>, courseId: string, period: string) {
  const content = normalizedAdditionalResource("resource", { ...input, category: "courses", plan: "Bronce" }, period);
  assertSupportContent(content);
  if (typeof input.order !== "number" || !Number.isInteger(input.order) || input.order < 1 || input.order > 1000) throw new AdditionalResourceError("El orden debe ser un número entero entre 1 y 1000.");
  const minutes = input.minutes ?? 0;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0 || minutes > 600) throw new AdditionalResourceError("La duración debe ser un número entero de 0 a 600 minutos.");
  return { courseId, period, description: content.description, materialType: content.materialType, fileKey: content.fileKey, fileName: content.fileName, externalUrl: content.externalUrl, order: input.order, minutes };
}
export function courseLessons<T extends AdditionalResourceRow>(rows: T[], courseId: string, publishedOnly = false): T[] {
  return rows.filter(row => row.kind === "course_lesson" && row.data.courseId === courseId && row.status !== "archived" && (!publishedOnly || row.status === "published"))
    .sort((a, b) => Number(a.data.order || 0) - Number(b.data.order || 0) || a.id.localeCompare(b.id));
}
export function courseProgress(lessons: AdditionalResourceRow[], progress: AdditionalResourceRow[]) {
  const published = lessons.filter(row => row.kind === "course_lesson" && row.status === "published");
  const complete = new Set(progress.filter(row => row.kind === "course_progress" && row.data.completed === true && published.some(lesson => lesson.id === row.data.lessonId && lesson.data.revision === row.data.lessonRevision)).map(row => String(row.data.lessonId)));
  return { completed: complete.size, total: published.length, percent: published.length ? Math.round(complete.size / published.length * 100) : 0, complete };
}
