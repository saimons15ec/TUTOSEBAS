export const MAX_JSON_BYTES = 1024 * 1024;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadKind = "material" | "review" | "submission" | "payment";

export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function resolveProfileAccess(admins: ReadonlySet<string>, normalizedEmail: string, currentStatus: string) {
  const role = admins.has(normalizedEmail) ? "admin" as const : "student" as const;
  const status = role === "admin" || currentStatus === "invited" ? "active" : currentStatus;
  return { role, status };
}

export function canAccessPaymentRecord(role: string, memberRole: string) {
  return role === "admin" || (role === "student" && memberRole === "coordinator");
}

export function publicIssue(error: unknown, fallback: string) {
  if (error instanceof PublicError) return { message: error.message, status: error.status };
  const message = error instanceof Error ? error.message : "";
  if (/UNIQUE constraint failed: profiles\.email/i.test(message)) return { message: "Ese correo ya está registrado.", status: 409 };
  if (/no such table/i.test(message)) return { message: "La actualización de datos aún no está publicada.", status: 503 };
  console.error("TUTOSEBAS request failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
  return { message: fallback, status: 500 };
}

export function assertTrustedMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new PublicError("Solicitud rechazada por seguridad. Actualiza la página e inténtalo nuevamente.", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin) return;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new PublicError("Origen de solicitud no válido.", 403);
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = (forwardedHost || request.headers.get("host") || new URL(request.url).host).toLowerCase();
  if (originUrl.host.toLowerCase() !== expectedHost) {
    throw new PublicError("Solicitud rechazada por seguridad. Actualiza la página e inténtalo nuevamente.", 403);
  }
  if (originUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(originUrl.hostname)) {
    throw new PublicError("La solicitud debe usar una conexión segura.", 403);
  }
}

export async function readJsonObject(request: Request, maxBytes = MAX_JSON_BYTES): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new PublicError("La solicitud debe enviarse como JSON.", 415);
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PublicError("La solicitud supera el tamaño permitido.", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new PublicError("La solicitud supera el tamaño permitido.", 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PublicError("El contenido JSON no es válido.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PublicError("La solicitud debe contener un objeto JSON.");
  return parsed as Record<string, unknown>;
}

export async function readBoundedBytes(request: Request, maxBytes = MAX_UPLOAD_BYTES): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PublicError("El archivo supera 25 MB.", 413);
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PublicError("El archivo supera 25 MB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

type FileRule = {
  contentType: string;
  signature: (bytes: Uint8Array) => boolean;
  family: "document" | "image" | "audio";
};

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);
const asciiAt = (bytes: Uint8Array, offset: number, value: string) => [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
const zip = (bytes: Uint8Array) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]);

const FILE_RULES: Record<string, FileRule> = {
  ".pdf": { contentType: "application/pdf", family: "document", signature: (bytes) => asciiAt(bytes, 0, "%PDF-") },
  ".docx": { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", family: "document", signature: zip },
  ".pptx": { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", family: "document", signature: zip },
  ".png": { contentType: "image/png", family: "image", signature: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  ".jpg": { contentType: "image/jpeg", family: "image", signature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  ".jpeg": { contentType: "image/jpeg", family: "image", signature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  ".mp3": { contentType: "audio/mpeg", family: "audio", signature: (bytes) => asciiAt(bytes, 0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) },
  ".m4a": { contentType: "audio/mp4", family: "audio", signature: (bytes) => asciiAt(bytes, 4, "ftyp") },
  ".wav": { contentType: "audio/wav", family: "audio", signature: (bytes) => asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE") },
  ".ogg": { contentType: "audio/ogg", family: "audio", signature: (bytes) => asciiAt(bytes, 0, "OggS") },
};

const KIND_EXTENSIONS: Record<UploadKind, Set<string>> = {
  material: new Set(Object.keys(FILE_RULES)),
  review: new Set([".pdf", ".docx", ".pptx", ".png", ".jpg", ".jpeg"]),
  submission: new Set([".pdf", ".docx", ".pptx", ".png", ".jpg", ".jpeg"]),
  payment: new Set([".pdf", ".png", ".jpg", ".jpeg"]),
};

function containsAscii(bytes: Uint8Array, terms: string[]) {
  const decoder = new TextDecoder("latin1");
  const normalized = terms.map((term) => term.toLowerCase());
  const overlapSize = Math.max(...normalized.map((term) => term.length), 1) - 1;
  let overlap = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
    const chunk = decoder.decode(bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.byteLength))).toLowerCase();
    const searchable = overlap + chunk;
    if (normalized.some((term) => searchable.includes(term))) return true;
    overlap = searchable.slice(-overlapSize);
  }
  return false;
}

export function inspectUpload(kind: UploadKind, originalName: string, bytes: Uint8Array) {
  if (!bytes.byteLength) throw new PublicError("El archivo está vacío.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new PublicError("El archivo supera 25 MB.", 413);
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) throw new PublicError("El archivo contiene un formato ejecutable no permitido.");

  const rawName = originalName.split(/[\\/]/).pop()?.trim() || "";
  const extensionMatch = /\.[a-z0-9]+$/i.exec(rawName);
  const extension = extensionMatch?.[0]?.toLowerCase() || "";
  const rule = FILE_RULES[extension];
  if (!rule || !KIND_EXTENSIONS[kind].has(extension)) {
    const allowed = kind === "payment" ? "PDF, PNG o JPG" : kind === "material" ? "PDF, DOCX, PPTX, PNG, JPG o audio MP3, M4A, WAV u OGG" : "PDF, DOCX, PPTX, PNG o JPG";
    throw new PublicError(`Para este proceso usa ${allowed}.`);
  }
  if (!rule.signature(bytes)) throw new PublicError("El contenido del archivo no coincide con su extensión.");

  if ([".docx", ".pptx"].includes(extension)) {
    const expectedFolder = extension === ".docx" ? "word/" : "ppt/";
    if (!containsAscii(bytes, [expectedFolder]) || !containsAscii(bytes, ["[Content_Types].xml"])) throw new PublicError("El documento de Office no tiene una estructura válida.");
    if (containsAscii(bytes, ["vbaproject.bin", "/embeddings/", "/activex/", "oleobject"])) throw new PublicError("No se permiten macros, objetos incrustados ni contenido activo.");
  }
  if (extension === ".pdf" && containsAscii(bytes, ["/javascript", "/openaction", "/launch", "/embeddedfile", "/richmedia"])) {
    throw new PublicError("El PDF contiene acciones o archivos incrustados no permitidos.");
  }

  const baseName = rawName.slice(0, Math.max(0, rawName.length - extension.length));
  const safeBase = baseName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "archivo";
  return { safeName: `${safeBase}${extension}`, contentType: rule.contentType, extension, family: rule.family };
}

export function storedObjectKey(key: string) {
  if (!key || key.length > 500 || /[\u0000-\u001f\\]/.test(key) || key.includes("..")) return null;
  const parts = key.split("/");
  if (parts.length !== 4 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(parts[2]) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[a-zA-Z0-9._-]{1,140}$/.test(parts[3])) return null;
  if (parts[0] === "materials" && parts[1] === "shared") return { kind: "material" as const, groupId: "shared" };
  const kind = ({ reviews: "review", submissions: "submission", payments: "payment" } as const)[parts[0] as "reviews" | "submissions" | "payments"];
  if (!kind || !/^[a-zA-Z0-9_-]{1,100}$/.test(parts[1])) return null;
  return { kind, groupId: parts[1] };
}

export function objectKeyMatches(key: string, kind: UploadKind, groupId: string) {
  const parsed = storedObjectKey(key);
  return Boolean(parsed && parsed.kind === kind && parsed.groupId === groupId);
}
