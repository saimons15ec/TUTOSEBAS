export type FileViewKind = "pdf" | "image" | "audio";
export function fileViewKind(contentType: string): FileViewKind | null {
  if (contentType === "application/pdf") return "pdf";
  if (["image/png", "image/jpeg"].includes(contentType)) return "image";
  if (["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"].includes(contentType)) return "audio";
  return null;
}
export function suggestedFileView(name: string): FileViewKind | null {
  const extension = name.toLowerCase().split(".").at(-1);
  return extension === "pdf" ? "pdf" : ["png", "jpg", "jpeg"].includes(extension || "") ? "image" : ["mp3", "m4a", "wav", "ogg"].includes(extension || "") ? "audio" : null;
}
export function fileDisposition(name: string, inline: boolean) {
  const safe = name.replace(/[\r\n\x00-\x1f\x7f"\\]/g, "_").slice(0, 240) || "archivo";
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
export function singleFileRange(header: string | null, size: number): { offset: number; length: number } | null | "invalid" {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || !Number.isSafeInteger(size) || size <= 0 || (!match[1] && !match[2])) return "invalid";
  const first = Number(match[1]), last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return "invalid";
  if (!match[1]) return last > 0 ? { offset: Math.max(0, size - last), length: Math.min(size, last) } : "invalid";
  const end = match[2] ? Math.min(size - 1, last) : size - 1;
  return first < size && first <= end ? { offset: first, length: end - first + 1 } : "invalid";
}
