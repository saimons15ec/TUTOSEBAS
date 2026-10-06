import { normalizeListText, recordTimestamp, type ListFilters } from './record-lists.ts';
type Attempt = {created_by:string;created_at:string;data:Record<string,unknown>;status:string};
type Student = {id:string;role:string;full_name:string;email:string;group_id?:string|null};
export function completedReportAttempts<T extends Attempt>(rows:T[]) { return rows.filter(row=>['finalized','completed'].includes(row.status)&&typeof row.data.score==='number'&&Number.isFinite(row.data.score)&&row.data.score>=0&&row.data.score<=20).toSorted((a,b)=>recordTimestamp(String(b.data.completedAt||b.created_at))-recordTimestamp(String(a.data.completedAt||a.created_at))); }
export function studentReportSummaries<S extends Student,A extends Attempt>(profiles:S[], attempts:A[], filters:ListFilters) {
  const requireAttempts=Boolean(filters.status||filters.from||filters.to||filters.period),query=normalizeListText(filters.query),group=filters.group==='__none'?'':filters.group;
  return profiles.filter(student=>student.role==='student').flatMap(student=>{
    const own=attempts.filter(row=>row.created_by===student.id),scores=own.map(row=>Number(row.data.score));
    if(requireAttempts&&!own.length)return[];
    if(filters.group&&String(student.group_id||'')!==group&&!own.length)return[];
    if(query&&!own.length&&!normalizeListText(`${student.full_name} ${student.email}`).includes(query))return[];
    return [{student,attempts:own.length,average:scores.length?scores.reduce((sum,value)=>sum+value,0)/scores.length:0,best:scores.length?Math.max(...scores):0,latest:own[0]}];
  });
}
