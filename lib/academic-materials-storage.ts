import { AdditionalResourceError, normalizedAdditionalResource } from './additional-resources.ts';
import { assertActiveAdministrator } from './security.ts';

type Actor = { id: string; role: string; status: string };
type Stored = { id: string; title: string; status: string; data_json: string; updated_at: string };
export async function saveAcademicMaterial(database: D1Database, input: Record<string, unknown>, period: string, actor: Actor, verifyFile: (key: string) => Promise<boolean>) {
  assertActiveAdministrator(actor.role, actor.status);
  const row = await database.prepare("SELECT id,title,status,data_json,updated_at FROM records WHERE id=? AND kind='resource'").bind(input.id).first<Stored>();
  if (!row) throw new AdditionalResourceError('Material no encontrado.', 404);
  const data = JSON.parse(row.data_json) as Record<string, unknown>;
  if (!['complexive', 'final_degree'].includes(String(data.area)) || data.period !== period || row.status === 'archived') throw new AdditionalResourceError('Selecciona un material activo de una materia del periodo vigente.', 409);
  if (input.revision !== (data.materialRevision || row.updated_at)) throw new AdditionalResourceError('El material cambió. Actualiza antes de editarlo.', 409);
  const values = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data as Record<string, unknown> : {};
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 180) : '';
  if (!title) throw new AdditionalResourceError('Escribe el título del material.');
  const plan = values.plan ?? data.plan;
  if (typeof plan !== 'string' || !['Bronce', 'Plata', 'Gold'].includes(plan)) throw new AdditionalResourceError('Selecciona un plan válido.');
  const replacement = input.replaceContent === true;
  const next = { ...data, description: typeof values.description === 'string' ? values.description.trim().slice(0, 4000) : String(data.description || ''), plan, materialRevision: crypto.randomUUID() };
  if (replacement) {
    const content = normalizedAdditionalResource('resource', { ...values, category: 'other' }, period);
    if (!content.fileKey && !content.externalUrl) throw new AdditionalResourceError('Selecciona el nuevo archivo o enlace.');
    if (content.materialType !== 'Video' && !content.fileKey) throw new AdditionalResourceError('Adjunta el archivo del material.');
    if (content.fileKey && !(await verifyFile(content.fileKey))) throw new AdditionalResourceError('El archivo debe ser una carga válida de tu cuenta.');
    const history = Array.isArray(data.materialVersions) ? data.materialVersions : [];
    if (history.length >= 100) throw new AdditionalResourceError('El material alcanzó 100 versiones. Crea otro material para conservar su historia.', 409);
    Object.assign(next, { materialType: content.materialType, fileKey: content.fileKey, fileName: content.fileName, externalUrl: content.externalUrl, materialVersions: [...history, { title: row.title, fileKey: data.fileKey || null, fileName: data.fileName || null, externalUrl: data.externalUrl || null, materialType: data.materialType, savedAt: new Date().toISOString(), revision: data.materialRevision || row.updated_at }] });
  }
  const serialized = JSON.stringify(next);
  // The question update and material edit share a transaction and a snapshot
  // guard. A concurrent edit cannot invalidate unrelated questions.
  const updates = [database.prepare("UPDATE records SET title=?,status='draft',data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='resource' AND status=? AND data_json=? AND title=?").bind(title, serialized, row.id, row.status, row.data_json, row.title)];
  if (replacement) updates.push(database.prepare("UPDATE records SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE kind='question' AND status='approved' AND json_extract(data_json,'$.sourceResourceId')=? AND json_extract(data_json,'$.area')=? AND json_extract(data_json,'$.period')=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND kind='resource' AND status='draft' AND data_json=?)").bind(row.id, data.area, period, row.id, serialized));
  const results = await database.batch(updates);
  if (results[0].meta.changes !== 1) throw new AdditionalResourceError('El material cambió mientras guardabas. Actualiza y vuelve a intentarlo.', 409);
  return { id: row.id, status: 'draft', questionsToReview: Number(results[1]?.meta.changes || 0) };
}
