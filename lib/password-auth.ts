import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { assertActiveAdministrator, PublicError } from "./security.ts";
import { enforceRateLimit, sha256Hex, writeAudit } from "./security-storage.ts";

type AuthEnv = Cloudflare.Env & {
  APP_AUTH_MODE?: string; APP_DEPLOYMENT?: string; APP_ORIGIN?: string;
  SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; SUPABASE_SECRET_KEY?: string;
};
export type AuthProfile = { id: string; auth_id: string | null; email: string; full_name: string; role: string; status: string };
type IdentityRow = { profile_id: string; provider_id: string; registered_email: string; credentials_version: number; must_change_password: number; state: string };
export type PasswordSession = AuthProfile & IdentityRow & { token_hash: string; expires_at: number; last_seen_at: number; session_version: number };
const runtime = env as AuthEnv;
export const SESSION_COOKIE = "__Host-tutosebas-session";
const SESSION_SECONDS = 8 * 60 * 60;
const IDLE_SECONDS = 30 * 60;
const LOGIN_ERROR = "No se pudo ingresar. Revisa el correo y la contraseña o consulta al profesor.";

export function authMode(): "sites" | "password" {
  const mode = runtime.APP_AUTH_MODE || "sites";
  if (runtime.APP_DEPLOYMENT === "independent" && mode !== "password") throw new PublicError("El alojamiento independiente requiere acceso con contraseña.", 503);
  if (mode !== "sites" && mode !== "password") throw new PublicError("La configuración del acceso requiere revisión.", 503);
  return mode;
}

export function passwordConfigured() {
  return Boolean(runtime.SUPABASE_URL && runtime.SUPABASE_PUBLISHABLE_KEY && runtime.SUPABASE_SECRET_KEY && runtime.APP_ORIGIN);
}

function config() {
  if (!passwordConfigured() || !runtime.DB) throw new PublicError("El acceso con contraseña aún requiere conectar el servicio de autenticación.", 503);
  let url: URL; let origin: URL;
  try { url = new URL(runtime.SUPABASE_URL!); origin = new URL(runtime.APP_ORIGIN!); }
  catch { throw new PublicError("La configuración del acceso requiere revisión.", 503); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== "/" || url.search || url.hash || url.username || url.password || url.port ||
      origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password ||
      !runtime.SUPABASE_PUBLISHABLE_KEY!.startsWith("sb_publishable_") || !runtime.SUPABASE_SECRET_KEY!.startsWith("sb_secret_")) {
    throw new PublicError("La configuración del acceso requiere revisión.", 503);
  }
  return { database: runtime.DB, base: url.origin, origin: origin.origin, publishable: runtime.SUPABASE_PUBLISHABLE_KEY!, secret: runtime.SUPABASE_SECRET_KEY! };
}

export function assertPasswordOrigin(request: Request) {
  const expected = config().origin;
  if (new URL(request.url).origin !== expected || request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new PublicError("Solicitud rechazada por seguridad.", 403);
  }
}

export function validateNewPassword(value: unknown) {
  if (typeof value !== "string" || [...value].length < 15 || new TextEncoder().encode(value).byteLength > 72 || /[\u0000-\u001f\u007f]/.test(value) || /^(.)\1+$/.test(value)) {
    throw new PublicError("Usa una contraseña única de al menos 15 caracteres y como máximo 72 bytes. Puedes usar una frase; no uses la cédula.");
  }
  return value;
}

function normalizedEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254) throw new PublicError(LOGIN_ERROR, 401);
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicError(LOGIN_ERROR, 401);
  return email;
}

async function provider(path: string, method: string, body?: Record<string, unknown>, elevated = false) {
  const settings = config();
  let response: Response;
  try {
    response = await fetch(`${settings.base}/auth/v1${path}`, {
      method, headers: { apikey: elevated ? settings.secret : settings.publishable, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new PublicError("El servicio de acceso no respondió. Inténtalo de nuevo.", 503); }
  // Provider bodies and error descriptions may contain private data. Never log them.
  let result: Record<string, unknown>;
  try { result = await response.json() as Record<string, unknown>; }
  catch { throw new PublicError("No se pudo verificar el servicio de acceso.", 503); }
  if (!response.ok) {
    if (response.status === 429) throw new PublicError("Espera unos minutos antes de volver a intentar el acceso.", 429);
    if (response.status >= 500) throw new PublicError("El servicio de acceso no está disponible temporalmente.", 503);
    if (elevated) throw new PublicError("No se pudo asignar la contraseña. Revisa la conexión y si el correo ya existe en el servicio de acceso.", 409);
    throw new PublicError(LOGIN_ERROR, 401);
  }
  return result;
}

function providerUser(value: Record<string, unknown>) {
  const user = (value.user && typeof value.user === "object" ? value.user : value) as Record<string, unknown>;
  if (typeof user.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || typeof user.email !== "string" || !user.email_confirmed_at) {
    throw new PublicError("No se pudo verificar la identidad del servicio de acceso.", 503);
  }
  return { id: user.id, email: normalizedEmail(user.email) };
}

async function verifyPassword(email: string, password: unknown, providerId: string) {
  if (typeof password !== "string" || !password || new TextEncoder().encode(password).byteLength > 72) throw new PublicError(LOGIN_ERROR, 401);
  const user = providerUser(await provider("/token?grant_type=password", "POST", { email, password }));
  if (user.id !== providerId || user.email !== email) throw new PublicError(LOGIN_ERROR, 401);
}

async function tokenHash(token: string) { return sha256Hex(new TextEncoder().encode(token)); }
function tokenFromCookie(value: string | null) {
  const candidates = (value || "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  if (candidates.length !== 1) return null;
  const token = candidates[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(token: string, clear = false) {
  return `${SESSION_COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}`;
}

async function issueSession(identity: IdentityRow, profile: AuthProfile) {
  const { database } = config(); const now = Math.floor(Date.now() / 1000);
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const hash = await tokenHash(token);
  const result = await database.prepare(`INSERT INTO auth_sessions(token_hash,profile_id,credentials_version,created_at,expires_at,last_seen_at)
    SELECT ?,id,?, ?,?,? FROM profiles WHERE id=? AND lower(email)=? AND status IN ('active','invited')
    AND EXISTS(SELECT 1 FROM auth_identities WHERE profile_id=profiles.id AND registered_email=lower(profiles.email) AND provider_id=? AND state='ready' AND credentials_version=?)`)
    .bind(hash, identity.credentials_version, now, now + SESSION_SECONDS, now, profile.id, profile.email.toLowerCase(), identity.provider_id, identity.credentials_version).run();
  if (result.meta.changes !== 1) throw new PublicError(LOGIN_ERROR, 401);
  return { cookie: sessionCookie(token), mustChangePassword: Boolean(identity.must_change_password) };
}

export async function readPasswordSession(cookieHeader?: string | null, touch = true): Promise<PasswordSession | null> {
  const cookie = cookieHeader === undefined ? (await headers()).get("cookie") : cookieHeader;
  const token = tokenFromCookie(cookie); if (!token) return null;
  const { database } = config();
  const now = Math.floor(Date.now() / 1000);
  const session = await database.prepare(`SELECT p.*,i.*,s.token_hash,s.expires_at,s.last_seen_at,s.credentials_version AS session_version
    FROM auth_sessions s JOIN profiles p ON p.id=s.profile_id JOIN auth_identities i ON i.profile_id=p.id
    WHERE s.token_hash=? AND s.expires_at>? AND s.last_seen_at>? AND i.state='ready'
    AND s.credentials_version=i.credentials_version AND i.registered_email=lower(p.email) AND p.status IN ('active','invited') LIMIT 1`)
    .bind(await tokenHash(token), now, now - IDLE_SECONDS).first<PasswordSession>();
  if (session && touch && now - session.last_seen_at >= 60) await database.prepare("UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=? AND last_seen_at=?").bind(now, session.token_hash, session.last_seen_at).run();
  return session;
}

export async function loginWithPassword(request: Request, emailInput: unknown, password: unknown) {
  const { database } = config(); const email = normalizedEmail(emailInput);
  await enforceRateLimit(database, request.headers.get("cf-connecting-ip") || "unavailable", "auth:login-ip");
  await enforceRateLimit(database, await tokenHash(email), "auth:login-email");
  const profile = await database.prepare("SELECT * FROM profiles WHERE lower(email)=? AND status IN ('active','invited') LIMIT 1").bind(email).first<AuthProfile>();
  const identity = profile && await database.prepare("SELECT * FROM auth_identities WHERE profile_id=? AND registered_email=? AND state='ready' LIMIT 1").bind(profile.id, email).first<IdentityRow>();
  if (!profile || !identity) throw new PublicError(LOGIN_ERROR, 401);
  await verifyPassword(email, password, identity.provider_id);
  const result = await issueSession(identity, profile);
  await writeAudit(database, { actorId: profile.id, actorRole: profile.role, action: "password_login", targetKind: "profile", targetId: profile.id });
  return result;
}

export async function logoutPassword(cookie: string | null) {
  const { database } = config(); const token = tokenFromCookie(cookie);
  if (token) await database.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await tokenHash(token)).run();
  return { cookie: sessionCookie("", true) };
}

export async function reauthenticatePassword(request: Request, profile: AuthProfile, password: unknown) {
  const { database } = config();
  await enforceRateLimit(database, request.headers.get("cf-connecting-ip") || "unavailable", "auth:login-ip");
  await enforceRateLimit(database, await tokenHash(profile.email.toLowerCase()), "auth:login-email");
  const identity = await database.prepare("SELECT * FROM auth_identities WHERE profile_id=? AND registered_email=? AND state='ready' LIMIT 1").bind(profile.id, profile.email.toLowerCase()).first<IdentityRow>();
  if (!identity) throw new PublicError(LOGIN_ERROR, 401);
  await verifyPassword(profile.email.toLowerCase(), password, identity.provider_id);
}

export async function setRegisteredPassword(profileId: string, passwordInput: unknown, actor: AuthProfile) {
  assertActiveAdministrator(actor.role, actor.status);
  const { database } = config(); const password = validateNewPassword(passwordInput);
  await enforceRateLimit(database, actor.id, "auth:assign-password");
  const profile = await database.prepare("SELECT * FROM profiles WHERE id=? AND status IN ('active','invited') LIMIT 1").bind(profileId).first<AuthProfile>();
  if (!profile) throw new PublicError("Primero registra y habilita esta cuenta en la plataforma.", 404);
  const existing = await database.prepare("SELECT * FROM auth_identities WHERE profile_id=? LIMIT 1").bind(profile.id).first<IdentityRow>();
  if (!existing) {
    // No adoption by email: only an administrator-created provider identity is linked.
    const user = providerUser(await provider("/admin/users", "POST", { email: profile.email.toLowerCase(), password, email_confirm: true }, true));
    if (user.email !== profile.email.toLowerCase()) throw new PublicError("La cuenta creada no coincide con el correo registrado.", 503);
    await database.prepare("INSERT INTO auth_identities(profile_id,provider_id,registered_email,credentials_version,must_change_password,state) VALUES(?,?,?,1,1,'ready')").bind(profile.id, user.id, user.email).run();
  } else {
    const lock = await database.prepare("UPDATE auth_identities SET state='updating',credentials_version=credentials_version+1 WHERE profile_id=? AND credentials_version=? AND state IN ('ready','blocked')").bind(profile.id, existing.credentials_version).run();
    if (lock.meta.changes !== 1) throw new PublicError("La contraseña ya se está actualizando. Intenta nuevamente cuando termine.", 409);
    await database.prepare("DELETE FROM auth_sessions WHERE profile_id=?").bind(profile.id).run();
    try {
      const oldUser = providerUser(await provider(`/admin/users/${existing.provider_id}`, "GET", undefined, true));
      if (oldUser.email !== profile.email.toLowerCase()) throw new PublicError("El correo del servicio de acceso no coincide con la ficha registrada.", 409);
      const user = providerUser(await provider(`/admin/users/${existing.provider_id}`, "PUT", { password }, true));
      if (user.id !== existing.provider_id || user.email !== profile.email.toLowerCase()) throw new PublicError("No se pudo comprobar la actualización de acceso.", 503);
      await database.prepare("UPDATE auth_identities SET state='ready',must_change_password=1 WHERE profile_id=? AND state='updating' AND credentials_version=?").bind(profile.id, existing.credentials_version + 1).run();
    } catch (error) {
      await database.prepare("UPDATE auth_identities SET state='blocked' WHERE profile_id=? AND credentials_version=?").bind(profile.id, existing.credentials_version + 1).run();
      throw error;
    }
  }
  await writeAudit(database, { actorId: actor.id, actorRole: actor.role, action: "registered_password_assigned", targetKind: "profile", targetId: profile.id });
}

export async function changeOwnPassword(session: PasswordSession, currentPassword: unknown, nextPasswordInput: unknown) {
  const { database } = config(); const nextPassword = validateNewPassword(nextPasswordInput);
  if (nextPassword === currentPassword) throw new PublicError("Elige una contraseña diferente a la anterior.");
  await enforceRateLimit(database, session.id, "auth:change-password");
  await verifyPassword(session.email.toLowerCase(), currentPassword, session.provider_id);
  const lock = await database.prepare("UPDATE auth_identities SET state='updating',credentials_version=credentials_version+1 WHERE profile_id=? AND credentials_version=? AND state='ready'").bind(session.id, session.credentials_version).run();
  if (lock.meta.changes !== 1) throw new PublicError("El acceso cambió. Vuelve a iniciar sesión.", 401);
  await database.prepare("DELETE FROM auth_sessions WHERE profile_id=?").bind(session.id).run();
  try {
    const user = providerUser(await provider(`/admin/users/${session.provider_id}`, "PUT", { password: nextPassword }, true));
    if (user.id !== session.provider_id || user.email !== session.email.toLowerCase()) throw new PublicError("No se pudo comprobar la actualización de acceso.", 503);
    await database.prepare("UPDATE auth_identities SET state='ready',must_change_password=0 WHERE profile_id=? AND credentials_version=? AND state='updating'").bind(session.id, session.credentials_version + 1).run();
  } catch (error) {
    await database.prepare("UPDATE auth_identities SET state='blocked' WHERE profile_id=? AND credentials_version=?").bind(session.id, session.credentials_version + 1).run();
    throw error;
  }
  await writeAudit(database, { actorId: session.id, actorRole: session.role, action: "own_password_changed", targetKind: "profile", targetId: session.id });
  return issueSession({ ...session, credentials_version: session.credentials_version + 1, must_change_password: 0 }, session);
}
