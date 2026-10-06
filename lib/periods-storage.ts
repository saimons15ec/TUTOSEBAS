import { assertActiveAdministrator, PublicError } from './security.ts';
type Actor = { id: string; role: string; status: string };
type Period = { id: string; title: string; data_json: string; updated_at: string };
export async function createPeriod(database: D1Database, input: Record<string, unknown>, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const title = typeof input.title === 'string' ? input.title.trim() : '', years = /^(20\d{2}|21\d{2})-(20\d{2}|21\d{2})$/.exec(title);
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!years || Number(years[2]) !== Number(years[1]) + 1 || note.length > 4000) throw new PublicError('Usa un periodo como 2027-2028 y una nota de hasta 4000 caracteres.');
  const id = `period_${crypto.randomUUID()}`, data = { current: false, note, selectionRevision: crypto.randomUUID() };
  const created = await database.prepare("INSERT INTO records(id,kind,title,status,data_json,created_by) SELECT ?,'period',?,'draft',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE kind='period' AND title=?)").bind(id, title, JSON.stringify(data), actor.id, title).run();
  if (created.meta.changes !== 1) throw new PublicError('Ese periodo ya está registrado.', 409);
  return { id };
}
export async function activatePeriod(database: D1Database, input: Record<string, unknown>, actor: Actor) {
  assertActiveAdministrator(actor.role, actor.status);
  const target = await database.prepare("SELECT id,title,data_json,updated_at FROM records WHERE id=? AND kind='period'").bind(input.id).first<Period>();
  if (!target) throw new PublicError('Periodo no encontrado.', 404);
  const current = (await database.prepare("SELECT id,title,data_json,updated_at FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1").all<Period>()).results;
  if (current.length > 1) throw new PublicError('Hay más de un periodo vigente. Revisa la configuración antes de activar.', 409);
  const previous = current[0], previousData = previous ? JSON.parse(previous.data_json) : {};
  if (String(input.currentId || '') !== (previous?.id || '') || String(input.revision || '') !== String(previousData.selectionRevision || previous?.updated_at || '')) throw new PublicError('El periodo vigente cambió. Actualiza antes de activar otro.', 409);
  if (previous?.id === target.id) return { id: target.id, period: target.title };
  const data = { ...JSON.parse(target.data_json), current: true, selectionRevision: crypto.randomUUID(), activatedAt: new Date().toISOString() };
  const guard = previous ? "EXISTS(SELECT 1 FROM records WHERE id=? AND kind='period' AND json_extract(data_json,'$.current')=1 AND data_json=?) AND (SELECT COUNT(*) FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1)=1" : "NOT EXISTS(SELECT 1 FROM records WHERE kind='period' AND json_extract(data_json,'$.current')=1)";
  const results = await database.batch([
    database.prepare(`UPDATE records SET status='published',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='period' AND data_json=? AND ${guard}`).bind(JSON.stringify(data), target.id, target.data_json, ...(previous ? [previous.id, previous.data_json] : [])),
    database.prepare("UPDATE records SET status='archived',data_json=json_set(data_json,'$.current',json('false')),updated_at=CURRENT_TIMESTAMP WHERE kind='period' AND id!=? AND json_extract(data_json,'$.current')=1 AND EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data_json,'$.selectionRevision')=?)").bind(target.id, target.id, data.selectionRevision),
  ]);
  if (results[0].meta.changes !== 1) throw new PublicError('La convocatoria cambió durante la activación. Actualiza y vuelve a intentarlo.', 409);
  return { id: target.id, period: target.title };
}
