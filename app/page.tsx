import { BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import Platform from "./platform";
import { AccessRequirements } from "@/components/access-requirements";
import { Button } from "@/components/ui/button";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { identity } from "@/lib/uic";
import { authMode, passwordConfigured } from "@/lib/password-auth";
import { PasswordAccess } from "@/components/password-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await identity();
  if (authMode() === "password" && (!user || user.mustChangePassword)) return <PasswordAccess change={Boolean(user?.mustChangePassword)} configured={passwordConfigured()}/>;
  if (user) return <Platform />;
  return <main className="min-h-screen bg-[#f7f5f0] p-4 text-[#15352d] sm:p-6"><div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[30px] border bg-white shadow-[0_28px_90px_rgba(16,42,67,.14)] lg:grid-cols-[1.08fr_.92fr]"><section className="relative overflow-hidden bg-[#003f32] p-7 text-white sm:p-10 lg:p-14"><div className="absolute -right-24 -top-28 size-96 rounded-full border-[64px] border-white/5"/><div className="relative flex h-full flex-col"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#d6a32b] text-[#392600]"><BookOpenCheck className="size-6"/></span><span><strong className="block text-xl">TUTOSEBAS</strong><small className="text-slate-300">Acompañamiento académico UIC</small></span></div><div className="my-auto py-14"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#f3d277]">Plataforma de estudio y revisión</p><h1 className="mt-4 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">Tu preparación, trabajos y progreso en un solo lugar.</h1><p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Fin de Carrera, Complexivos, trabajos UIC, cursos, Normas APA, pagos y revisiones según tu grupo y plan.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["Material por periodo","Bancos y simuladores","Entregas compartidas","Historial protegido"].map(item=><div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 p-3.5 text-sm font-semibold"><CheckCircle2 className="size-4 text-[#edc764]"/>{item}</div>)}</div></div></div></section><section className="grid place-items-center p-7 sm:p-10 lg:p-14"><div className="max-w-md"><span className="grid size-12 place-items-center rounded-2xl bg-[#fbf1d8] text-[#8a5e08]"><ShieldCheck className="size-6"/></span><h2 className="mt-6 text-3xl font-extrabold">Ingresar a la plataforma</h2><p className="mt-3 leading-7 text-slate-600">Usa la cuenta de ChatGPT asociada al correo registrado por el profesor. La cédula no es contraseña.</p><Button asChild className="mt-7 h-12 w-full bg-[#003f32] text-base"><a href={chatGPTSignInPath("/")} target="_top">Continuar con ChatGPT</a></Button><p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Si tu correo aún no está habilitado, verás un aviso para que el profesor active tu cuenta.</p><div className="mt-4"><AccessRequirements/></div></div></section></div></main>;
}
