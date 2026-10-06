import { PublicError } from './security.ts';
export type WorkEvent = { id: string; event: 'submission'|'review'; version: number; at: string; author: string; status: string; fileKey: string; fileName: string; notes: string; dueAt?: string; legacy?: boolean };
type Row = { id:string; status:string; created_at:string; updated_at:string; data:Record<string,unknown> };
export function workHistory(row: Row): WorkEvent[] {
  if (Array.isArray(row.data.workHistory)) return row.data.workHistory as WorkEvent[];
  const d=row.data, version=Number(d.revisions||0)+1;
  const events: WorkEvent[]=[{id:`legacy:${row.id}`,event:'submission',version,at:String(d.submittedAt||row.updated_at),author:String(d.submittedByName||'Integrante del grupo'),status:'received',fileKey:String(d.fileKey||''),fileName:String(d.fileName||'Archivo entregado'),notes:String(d.notes||''),legacy:true}];
  if(d.reviewFileKey||d.reviewNotes)events.push({id:`legacy-review:${row.id}`,event:'review',version,at:row.updated_at,author:'Profesor',status:row.status,fileKey:String(d.reviewFileKey||''),fileName:String(d.reviewFileName||'Archivo corregido'),notes:String(d.reviewNotes||''),dueAt:String(d.dueAt||''),legacy:true});
  return events;
}
export function appendWorkHistory(previous: WorkEvent[], event: WorkEvent) { if(previous.length>=200)throw new PublicError('La solicitud alcanzó 200 eventos. Conserva su historial y abre una solicitud nueva.');return [...previous,event]; }
