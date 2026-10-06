"use client";

import { useState, type FormEvent } from "react";
import { BookOpenCheck, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function passwordAction(body: Record<string, unknown>) {
  const response = await fetch("/api/auth", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json() as { error?: string; mustChangePassword?: boolean };
  if (!response.ok) throw new Error(result.error || "No se pudo completar el acceso.");
  return result;
}

export function PasswordAccess({ change = false, configured = true }: { change?: boolean; configured?: boolean }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError("");
    if (change && nextPassword !== confirmation) { setError("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true);
    try {
      await passwordAction(change ? { action: "change_password", currentPassword: password, password: nextPassword } : { action: "login", email, password });
      setPassword(""); setNextPassword(""); setConfirmation(""); window.location.reload();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo ingresar."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f7f5f0] p-5 text-[#15352d]"><section className="w-full max-w-md rounded-[28px] border bg-white p-6 shadow-xl sm:p-9">
    <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#d6a32b]"><BookOpenCheck/></span><div><strong className="text-xl">TUTOSEBAS</strong><p className="text-sm text-slate-500">Acompañamiento académico UIC</p></div></div>
    <LockKeyhole className="mt-9 text-[#8a5e08]"/><h1 className="mt-4 text-2xl font-extrabold">{change ? "Cambia tu contraseña inicial" : "Ingresa a tu plataforma"}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{change ? "La contraseña entregada por el profesor es temporal. Elige una nueva que solo tú conozcas para continuar." : "Usa el correo registrado por el profesor y la contraseña que te entregó. Solo las cuentas habilitadas pueden entrar."}</p>
    {!configured && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">El acceso con contraseña aún está en preparación. El administrador debe completar la conexión.</p>}
    <form onSubmit={submit} className="mt-6 space-y-4">
      {!change && <label className="block text-sm font-semibold">Correo<Input className="mt-2 h-12" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} disabled={busy || !configured}/></label>}
      <label className="block text-sm font-semibold">{change ? "Contraseña inicial o actual" : "Contraseña"}<Input className="mt-2 h-12" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy || !configured}/></label>
      {change && <><label className="block text-sm font-semibold">Nueva contraseña<Input className="mt-2 h-12" type="password" autoComplete="new-password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} required minLength={15} disabled={busy}/></label><label className="block text-sm font-semibold">Repite la nueva contraseña<Input className="mt-2 h-12" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={busy}/></label><p className="text-xs leading-5 text-slate-500">Al menos 15 caracteres. Usa una frase única; evita nombres, cédulas y claves compartidas.</p></>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button type="submit" disabled={busy || !configured} className="h-12 w-full bg-[#003f32]">{busy ? "Verificando…" : change ? "Guardar y continuar" : "Ingresar"}</Button>
    </form><p className="mt-5 text-xs leading-5 text-slate-500">Si olvidaste tu contraseña, solicita al profesor que la restablezca. No hay registro público.</p>
    {change && <Button variant="outline" className="mt-4 w-full" disabled={busy} onClick={async () => { setBusy(true); try { await passwordAction({ action: "logout" }); window.location.reload(); } catch { setError("No se pudo cerrar la sesión. Intenta nuevamente."); setBusy(false); } }}>Cerrar sesión</Button>}
  </section></main>;
}
