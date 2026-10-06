import { env } from "cloudflare:workers";
import { getApplicationUser, type ApplicationUser } from "@/lib/application-auth";
import { authMode } from "@/lib/password-auth";
import quizData from "@/app/data/quiz.json";
import { assertActiveAdministrator, PublicError, resolveProfileAccess } from "@/lib/security";

type RuntimeEnv = Cloudflare.Env & { ADMIN_EMAILS?: string };
export type Profile = { id: string; auth_id: string | null; email: string; full_name: string; role: "admin" | "student"; status: string; identifier_last4: string | null; group_id: string | null; member_role: string };
export type RecordRow = { id: string; kind: string; group_id: string | null; title: string; status: string; data_json: string; created_by: string; created_at: string; updated_at: string; data?: Record<string, unknown> };

const runtime = env as RuntimeEnv;
export const db = () => { if (!runtime.DB) throw new Error("Missing DB binding"); return runtime.DB; };
export const bucket = () => { if (!runtime.BUCKET) throw new Error("Missing BUCKET binding"); return runtime.BUCKET; };
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
export const email = (value: unknown) => { const result = text(value, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new PublicError("Ingresa un correo válido."); return result; };
export const parse = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };

export async function identity(): Promise<ApplicationUser | null> {
  const user = await getApplicationUser();
  if (user) return user;
  if (authMode() === "sites" && process.env.NODE_ENV === "development") return { userId: "local-tutosebas-admin", displayName: "Administrador local", fullName: "Administrador local", email: "admin@example.com" };
  return null;
}

export async function context() {
  const user = await identity();
  if (!user) return null;
  const database = db();
  const normalizedEmail = email(user.email);
  const configuredAdmins = runtime.ADMIN_EMAILS ?? (process.env.NODE_ENV === "development" ? "admin@example.com" : "");
  const admins = new Set(configuredAdmins.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!admins.size) throw new Error("ADMIN_EMAILS is not configured");
  if (user.method === "password") {
    if (user.mustChangePassword) throw new PublicError("Cambia tu contraseña inicial antes de entrar a la plataforma.", 428);
    const profile = await database.prepare("SELECT * FROM profiles WHERE id=? AND lower(email)=? AND status IN ('active','invited') LIMIT 1").bind(user.profileId, normalizedEmail).first<Profile>();
    if (!profile) throw new PublicError("Tu cuenta no está habilitada.", 403);
    const { role, status } = resolveProfileAccess(admins, normalizedEmail, profile.status);
    const changed = await database.prepare("UPDATE profiles SET role=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND role=?").bind(role, status, profile.id, profile.status, profile.role).run();
    if (changed.meta.changes !== 1) throw new PublicError("El acceso cambió. Vuelve a iniciar sesión.", 403);
    return { user, profile: { ...profile, role, status }, database };
  }
  // A signed-in identity is not an invitation. Only the roster email (or a
  // configured administrator during bootstrap) may acquire application access.
  let profile = await database.prepare("SELECT * FROM profiles WHERE lower(email)=? LIMIT 1").bind(normalizedEmail).first<Profile>();
  if (!profile) {
    if (!admins.has(normalizedEmail)) return { user, database, profile: { id: "unregistered", auth_id: null, email: normalizedEmail, full_name: user.fullName ?? user.displayName, role: "student", status: "unregistered", identifier_last4: null, group_id: null, member_role: "member" } as Profile };
    const linked = await database.prepare("SELECT id FROM profiles WHERE auth_id=? LIMIT 1").bind(user.userId).first<{ id: string }>();
    if (linked) throw new PublicError("El correo de esta sesión no coincide con la cuenta registrada. Usa tu correo autorizado.", 403);
    const id = uid("usr");
    await database.prepare("INSERT INTO profiles (id,auth_id,email,full_name,role,status) VALUES (?,?,?,?,'admin','active')").bind(id, user.userId, normalizedEmail, user.fullName ?? user.displayName).run();
  } else {
    if (profile.auth_id && profile.auth_id !== user.userId) throw new PublicError("Ese correo está vinculado a otra identidad. Usa la cuenta autorizada o solicita al profesor que revise el acceso.", 403);
    const linked = await database.prepare("SELECT id FROM profiles WHERE auth_id=? AND id!=? LIMIT 1").bind(user.userId, profile.id).first<{ id: string }>();
    if (linked) throw new PublicError("El correo de esta sesión no coincide con la cuenta registrada. Usa tu correo autorizado.", 403);
    const { role, status } = resolveProfileAccess(admins, normalizedEmail, profile.status);
    // The academic roster name is managed by the professor. Signing in with
    // ChatGPT must link the identity without replacing that registered name.
    const changed = await database.prepare("UPDATE profiles SET auth_id=?,role=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lower(email)=? AND (auth_id IS NULL OR auth_id=?) AND status=? AND role=?").bind(user.userId, role, status, profile.id, normalizedEmail, user.userId, profile.status, profile.role).run();
    if (changed.meta.changes !== 1) throw new PublicError("El acceso cambió. Actualiza la página o pide al profesor que revise tu cuenta.", 403);
  }
  profile = await database.prepare("SELECT * FROM profiles WHERE auth_id=? LIMIT 1").bind(user.userId).first<Profile>();
  if (!profile) throw new Error("No fue posible preparar la cuenta.");
  const contentOwner = profile.role === "admin" ? profile.id : (await database.prepare("SELECT id FROM profiles WHERE role='admin' AND status='active' ORDER BY created_at LIMIT 1").first<{ id: string }>())?.id;
  if (profile.status === "active" && contentOwner) await ensurePilotSimulator(database, contentOwner);
  if (profile.role === "admin" && profile.status === "active") await seed(database, profile.id);
  return { user, profile, database };
}

export function admin(profile: Profile) { assertActiveAdministrator(profile.role, profile.status); }

async function ensurePilotSimulator(database: D1Database, owner: string) {
  const exists = await database.prepare("SELECT id FROM records WHERE id='sim-ef-pilot'").first();
  if (exists) return;
  await database.prepare("INSERT OR IGNORE INTO records (id,kind,title,status,data_json,created_by) VALUES ('sim-ef-pilot','simulator',?,'published',?,?)").bind(
    "Simulador piloto · Didáctica de la Educación Física",
    JSON.stringify({ area: "final_degree", subject: "Didáctica de la Educación Física", period: "2025-2026", type: "subject", count: 20, plan: "Gold", passScore: 14, description: "Simulador histórico de 20 preguntas aleatorias. La corrección aparece al finalizar y cada intento queda en el historial." }),
    owner,
  ).run();
}

async function seed(database: D1Database, owner: string) {
  const exists = await database.prepare("SELECT id FROM records WHERE id='period-current'").first();
  if (exists) return;
  const base = [
    ["period-current", "period", null, "2026-2027", "draft", { current: true, note: "Periodo vigente en preparación" }],
    ["period-history", "period", null, "2025-2026", "archived", { current: false, note: "Material histórico separado" }],
    ["resource-curriculum", "resource", null, "Currículo y documentos oficiales", "published", { area: "resources", category: "curriculum", description: "Competencias, destrezas, objetivos, criterios y ejemplos de aplicación.", plan: "Plata", period: "2026-2027" }],
    ["resource-apa", "resource", null, "Centro de Normas APA 7", "published", { area: "resources", category: "apa", description: "Guía, citas, referencias, plantillas, curso y verificador orientativo.", plan: "Plata", period: "2026-2027" }],
    ["resource-ef", "resource", null, "Banco piloto · Didáctica de la Educación Física", "published", { area: "final_degree", category: "question_bank", description: "20 preguntas verificadas de los temas 6, 9 y 10.", plan: "Bronce", period: "2025-2026", subject: "Didáctica de la Educación Física" }],
    ["course-planning", "course", null, "Planificación curricular", "published", { description: "De la lectura del currículo a una planificación aplicable y coherente.", plan: "Gold", lessons: 3, minutes: 54 }],
    ["course-dua", "course", null, "Aplicación del DUA", "draft", { description: "Principios, decisiones pedagógicas e instrumentos para atender la diversidad.", plan: "Gold", lessons: 0, minutes: 0 }],
    ["course-apa", "course", null, "Normas APA aplicadas a trabajos UIC", "published", { description: "Formato, citas, referencias y revisión final con ejercicios.", plan: "Gold", lessons: 4, minutes: 68 }],
    ["sim-fll", "simulator", null, "Simulador histórico · Fundamentos de Lengua y Literatura", "published", { area: "complexive", subject: "Fundamentos de Lengua y Literatura", period: "2025-2026", type: "historical", count: 20, plan: "Gold", distribution: { completar: 5, contextualizadas: 5, relacionar: 5, ordenar: 5 } }],
    ["sim-diagnostic", "simulator", null, "Diagnóstico inicial complexivo", "draft", { area: "complexive", subject: "General", period: "2026-2027", type: "diagnostic", count: 20, plan: "Plata" }],
    ["sim-fdc", "simulator", null, "Simulador general · Fin de Carrera", "draft", { area: "final_degree", subject: "General", period: "2026-2027", type: "general", count: 60, plan: "Gold", passScore: 14 }],
  ] as const;
  const statements = base.map(([id, kind, groupId, title, status, data]) => database.prepare("INSERT OR IGNORE INTO records (id,kind,group_id,title,status,data_json,created_by) VALUES (?,?,?,?,?,?,?)").bind(id, kind, groupId, title, status, JSON.stringify(data), owner));
  for (const [index, question] of quizData.questions.entries()) {
    const correctValue = question.correctValues[0];
    const correctIndex = question.options.findIndex((option) => option.value === correctValue);
    statements.push(database.prepare("INSERT OR IGNORE INTO records (id,kind,title,status,data_json,created_by) VALUES (?,?,?,?,?,?)").bind(`question-${question.id}`, "question", `Pregunta ${index + 1}`, "approved", JSON.stringify({ area: "final_degree", subject: "Didáctica de la Educación Física", topic: index < 10 ? "El juego" : "Gimnasia", period: "2025-2026", format: "Selección directa", difficulty: "Media", prompt: question.question, options: question.options.map((option) => option.label), correctIndex, explanation: question.options[correctIndex]?.feedback ?? question.hint, source: index < 10 ? "Tema 6 · El juego" : index < 15 ? "Tema 9 · Prácticas gimnásticas" : "Tema 10 · Componentes de la gimnasia" }), owner));
  }
  await database.batch(statements);
}
