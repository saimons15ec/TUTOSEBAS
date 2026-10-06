import { assertActiveAdministrator, PublicError } from './security.ts';
import { studentRevision } from './students.ts';
export async function editStudent(database: D1Database, input: Record<string, unknown>, actor: { role: string; status: string }) {
  assertActiveAdministrator(actor.role, actor.status);
  const old = await database.prepare("SELECT * FROM profiles WHERE id=? AND role='student'").bind(input.id).first<Record<string, unknown>>();
  if (!old) throw new PublicError('Estudiante no encontrado.', 404);
  if (input.revision !== studentRevision(old)) throw new PublicError('La ficha cambió. Actualiza antes de guardar.', 409);
  const name = typeof input.fullName === 'string' ? input.fullName.trim().slice(0, 120) : '', group = typeof input.groupId === 'string' ? input.groupId.trim() || null : null, role = input.memberRole;
  if (!name || !['member', 'coordinator'].includes(String(role)) || typeof role !== 'string') throw new PublicError('Completa el nombre y selecciona una función válida.');
  const last4 = typeof input.identifierLast4 === 'string' ? input.identifierLast4.trim() : '';
  if (last4 && !/^\d{4}$/.test(last4)) throw new PublicError('Escribe exactamente cuatro dígitos o deja el campo vacío.');
  if (!group && role === 'coordinator') throw new PublicError('Un coordinador necesita un grupo.');
  const result = await database.prepare("UPDATE profiles SET full_name=?,identifier_last4=?,group_id=?,member_role=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='student' AND full_name=? AND email=? AND status=? AND identifier_last4 IS ? AND group_id IS ? AND member_role IS ? AND (? IS NULL OR (EXISTS(SELECT 1 FROM records WHERE id=? AND kind='group' AND status='active') AND (SELECT COUNT(*) FROM profiles WHERE group_id=? AND id!=?)<3 AND (?!='coordinator' OR NOT EXISTS(SELECT 1 FROM profiles WHERE group_id=? AND id!=? AND member_role='coordinator'))))").bind(name, last4 || null, group, role, old.id, old.full_name, old.email, old.status, old.identifier_last4, old.group_id, old.member_role, group, group, group, old.id, role, group, old.id).run();
  if (result.meta.changes !== 1) throw new PublicError('El grupo o la ficha cambió: revisa sus tres cupos y su coordinador, actualiza y vuelve a guardar.', 409);
  return { id: String(old.id) };
}
