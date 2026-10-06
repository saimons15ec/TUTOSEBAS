import { admin, context } from "@/lib/uic";
import { publicIssue, readJsonObject } from "@/lib/security";
import { assertPasswordOrigin, authMode, changeOwnPassword, loginWithPassword, logoutPassword, passwordConfigured, readPasswordSession, reauthenticatePassword, setRegisteredPassword } from "@/lib/password-auth";

export const dynamic = "force-dynamic";
const reply = (data: Record<string, unknown>, status = 200, cookie?: string) => Response.json(data, {
  status, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff", ...(cookie ? { "set-cookie": cookie } : {}) },
});

export async function GET(request: Request) {
  try {
    const method = authMode(); const configured = passwordConfigured();
    if (!configured) return reply({ method, configured, authenticated: false, assignments: [] });
    const session = method === "password" ? await readPasswordSession(request.headers.get("cookie")) : null;
    if (session?.must_change_password) return reply({ method, configured, authenticated: true, mustChangePassword: true });
    const current = await context();
    const assignments = current?.profile.role === "admin" && current.profile.status === "active"
      ? (await current.database.prepare("SELECT profile_id,must_change_password,state FROM auth_identities ORDER BY profile_id").all()).results : [];
    return reply({ method, configured, authenticated: Boolean(current), mustChangePassword: false, assignments });
  } catch (error) { const issue = publicIssue(error, "No se pudo consultar el acceso."); return reply({ error: issue.message }, issue.status); }
}

export async function POST(request: Request) {
  try {
    assertPasswordOrigin(request);
    const body = await readJsonObject(request, 4096);
    if (body.action === "login") {
      if (authMode() !== "password") return reply({ error: "Esta versión todavía usa el acceso con ChatGPT." }, 409);
      const result = await loginWithPassword(request, body.email, body.password);
      return reply({ ok: true, mustChangePassword: result.mustChangePassword }, 200, result.cookie);
    }
    if (body.action === "logout") {
      if (authMode() !== "password") return reply({ error: "Usa Cerrar sesión en tu cuenta actual." }, 409);
      return reply({ ok: true }, 200, (await logoutPassword(request.headers.get("cookie"))).cookie);
    }
    if (body.action === "change_password") {
      if (authMode() !== "password") return reply({ error: "El acceso con contraseña aún no está activado." }, 409);
      const session = await readPasswordSession(request.headers.get("cookie"));
      if (!session) return reply({ error: "Vuelve a iniciar sesión para cambiar la contraseña." }, 401);
      const result = await changeOwnPassword(session, body.currentPassword, body.password);
      return reply({ ok: true, mustChangePassword: false }, 200, result.cookie);
    }
    if (body.action === "set_password") {
      const current = await context();
      if (!current) return reply({ error: "Debes iniciar sesión." }, 401);
      admin(current.profile);
      if (authMode() === "password") {
        // Reauthenticate the administrator before changing another account's access.
        await reauthenticatePassword(request, current.profile, body.currentPassword);
      }
      if (typeof body.profileId !== "string" || body.profileId.length > 100) return reply({ error: "Selecciona una cuenta registrada." }, 400);
      await setRegisteredPassword(body.profileId, body.password, current.profile);
      return reply({ ok: true, mustChangePassword: true });
    }
    return reply({ error: "Acción de acceso no válida." }, 400);
  } catch (error) { const issue = publicIssue(error, "No se pudo completar el acceso."); return reply({ error: issue.message }, issue.status); }
}
