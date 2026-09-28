export const SESSION_EXPIRED_MESSAGE = "Tu sesión ya no está disponible. Vuelve a iniciar sesión para continuar.";

export async function readApiJson<T extends Record<string, unknown>>(response: Response, fallback: string): Promise<T> {
  if (response.status === 401) throw new Error(SESSION_EXPIRED_MESSAGE);
  const raw = await response.text();
  if (!raw.trim()) throw new Error(fallback);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
  } catch {
    // A proxy or expired dispatch session can return HTML instead of API JSON.
  }
  if (raw.trimStart().startsWith("<")) throw new Error(SESSION_EXPIRED_MESSAGE);
  throw new Error(fallback);
}
