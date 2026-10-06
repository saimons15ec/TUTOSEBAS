"use client";
import { useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { studentRevision } from '@/lib/students';
type Profile = { id: string; email: string; full_name: string; role: string; status: string; identifier_last4?: string | null; group_id?: string | null; member_role?: string };
export function StudentEdit({ profile, groups, mutate }: { profile: Profile; groups: { id: string; title: string }[]; mutate: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(profile.full_name), [last4, setLast4] = useState(profile.identifier_last4 || ''), [group, setGroup] = useState(profile.group_id || ''), [role, setRole] = useState(profile.member_role || 'member'), [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogTrigger asChild><Button size="sm" variant="outline"><Pencil/> Editar ficha</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Ficha del estudiante</DialogTitle><DialogDescription>Se conservan el correo, la identidad, el estado y el historial. Cambiar de grupo modifica sus accesos compartidos.</DialogDescription></DialogHeader>
    <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Correo registrado:</strong> {profile.email}</p>
    <label className="space-y-2 text-sm font-semibold">Nombre académico<Input maxLength={120} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
    <label className="space-y-2 text-sm font-semibold">Últimos cuatro dígitos (opcional)<Input maxLength={4} inputMode="numeric" value={last4} disabled={busy} onChange={e => setLast4(e.target.value.replace(/\D/g, ''))}/></label>
    <label className="space-y-2 text-sm font-semibold">Grupo<select className="min-h-11 w-full rounded-xl border bg-white px-3" value={group} disabled={busy} onChange={e => { setGroup(e.target.value); if (!e.target.value) setRole('member'); }}><option value="">Sin grupo</option>{groups.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <label className="space-y-2 text-sm font-semibold">Función<select className="min-h-11 w-full rounded-xl border bg-white px-3" value={role} disabled={busy} onChange={e => setRole(e.target.value)}><option value="member">Integrante</option><option value="coordinator" disabled={!group}>Coordinador</option></select></label>
    <p className="text-xs leading-5 text-slate-500">Para sustituir al coordinador, cambia primero al actual a Integrante y después asigna al nuevo. No se elimina ningún perfil.</p>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-[#003f32]" disabled={busy || !name.trim() || (last4.length > 0 && last4.length !== 4)} onClick={async () => { setBusy(true); try { if (await mutate({ action: 'edit_student', id: profile.id, revision: studentRevision(profile), fullName: name, identifierLast4: last4, groupId: group, memberRole: role }, 'Ficha actualizada; identidad e historial conservados.')) setOpen(false); } finally { setBusy(false); } }}>{busy ? <RefreshCw className="animate-spin"/> : <Pencil/>} Guardar ficha</Button></div>
  </DialogContent></Dialog>;
}
