export type ListFilters = { query:string; status:string; group:string; from:string; to:string; period:string };
export type ListAccessors<T> = { text:(row:T)=>string; status:(row:T)=>string; group:(row:T)=>string; at:(row:T)=>string; period:(row:T)=>string };
export const emptyFilters: ListFilters = {query:'',status:'',group:'',from:'',to:'',period:''};
export function recordTimestamp(value:string) { return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? value.replace(' ','T')+'Z' : value); }
export function localRecordDay(value:string) { const time=recordTimestamp(value); if(!Number.isFinite(time))return'';const parts=new Intl.DateTimeFormat('en',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Guayaquil'}).formatToParts(new Date(time));return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-'); }
export const normalizeListText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function filterRecords<T>(rows: readonly T[], filters: ListFilters, fields: ListAccessors<T>) {
  if((filters.from&&!validDay(filters.from))||(filters.to&&!validDay(filters.to))||(filters.from&&filters.to&&filters.from>filters.to))return[];
  return rows.filter(row=>{
    if(filters.query&&!normalizeListText(fields.text(row)).includes(normalizeListText(filters.query)))return false;
    if(filters.status&&(filters.status==='active_reviews'?!['received','new_version','deadline_set','in_review','changes_requested'].includes(fields.status(row)):fields.status(row)!==filters.status))return false;
    if(filters.group&&fields.group(row)!==(filters.group==='__none'?'':filters.group))return false;
    if(filters.period&&fields.period(row)!==(filters.period==='__none'?'':filters.period))return false;
    if(filters.from||filters.to){const day=localRecordDay(fields.at(row));if(!day||(filters.from&&day<filters.from)||(filters.to&&day>filters.to))return false;}
    return true;
  });
}
export function paginateRecords<T>(rows: readonly T[], requested:number, requestedSize=10) {
  const size=[10,20,50].includes(requestedSize)?requestedSize:10,pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(pages-1,Math.max(0,Number.isInteger(requested)?requested:0));
  return {rows:rows.slice(page*size,(page+1)*size),page,pages,size,total:rows.length,from:rows.length?page*size+1:0,to:Math.min(rows.length,(page+1)*size)};
}
