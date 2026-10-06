import { assertActiveAdministrator, PublicError } from './security.ts';
type Actor={id:string;role:string;status:string;group_id?:string|null};
type Stored={id:string;title:string;status:string;group_id:string|null;data_json:string;updated_at:string};
export function normalizedNotice(titleValue:unknown,input:Record<string,unknown>){
 if(typeof titleValue!=='string'||!titleValue.trim()||titleValue.trim().length>180)throw new PublicError('Escribe un título de hasta 180 caracteres.');
 if(typeof input.body!=='string'||!input.body.trim()||input.body.trim().length>4000)throw new PublicError('Escribe un mensaje de hasta 4000 caracteres.');
 const groupId=input.groupId==null||input.groupId===''?null:typeof input.groupId==='string'?input.groupId.trim():undefined;
 if(groupId===undefined||(groupId&&groupId.length>100))throw new PublicError('Selecciona destinatarios válidos.');
 return{title:titleValue.trim(),data:{body:input.body.trim(),groupId,type:'info',readBy:[] as string[],noticeRevision:crypto.randomUUID()}};
}
async function validGroup(db:D1Database,groupId:string|null){if(groupId&&!await db.prepare("SELECT id FROM records WHERE id=? AND kind='group'").bind(groupId).first())throw new PublicError('El grupo destinatario no existe.');}
export async function saveNotice(db:D1Database,input:Record<string,unknown>,actor:Actor,onlyStatus=false){
 assertActiveAdministrator(actor.role,actor.status);
 const row=await db.prepare("SELECT id,title,status,group_id,data_json,updated_at FROM records WHERE id=? AND kind='notice'").bind(input.id).first<Stored>();if(!row)throw new PublicError('Aviso no encontrado.',404);
 const old=JSON.parse(row.data_json) as Record<string,unknown>;if(input.revision!==(old.noticeRevision||row.updated_at))throw new PublicError('El aviso cambió. Actualiza antes de guardarlo.',409);
 const status=String(input.status||'draft');if(!['published','draft','archived'].includes(status))throw new PublicError('Selecciona publicado, borrador o archivado.');
 const fields=onlyStatus&&status!=='published'?{title:row.title,data:{body:String(old.body??''),groupId:row.group_id,type:String(old.type||'info'),readBy:[] as string[],noticeRevision:crypto.randomUUID()}}:onlyStatus?normalizedNotice(row.title,{body:old.body,groupId:row.group_id}):normalizedNotice(input.title,input.data&&typeof input.data==='object'&&!Array.isArray(input.data)?input.data as Record<string,unknown>:{});
 await validGroup(db,fields.data.groupId);
 const changed=fields.title!==row.title||fields.data.body!==old.body||fields.data.groupId!==row.group_id;
 if(!changed&&status===row.status)return{id:row.id,unchanged:true};
 const versions=Array.isArray(old.noticeVersions)?old.noticeVersions:[];if(versions.length>=50)throw new PublicError('Este aviso alcanzó 50 versiones. Crea un nuevo aviso para conservar su historial.',409);
 const at=new Date().toISOString(),version={id:crypto.randomUUID(),at,author:actor.id,title:row.title,body:String(old.body||''),groupId:row.group_id,status:row.status,readBy:Array.isArray(old.readBy)?old.readBy:[]};
 const data={...old,...fields.data,noticeVersions:[...versions,version],updatedBy:actor.id,editedAt:at,readBy:changed||(status==='published'&&row.status!=='published')?[]:Array.isArray(old.readBy)?old.readBy:[]};
 if(new TextEncoder().encode(JSON.stringify(data)).byteLength>800_000)throw new PublicError('El historial del aviso alcanzó su límite. Crea un nuevo aviso sin borrar el anterior.',409);
 const updated=await db.prepare("UPDATE records SET title=?,status=?,group_id=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='notice' AND status=? AND data_json=? AND title=? AND group_id IS ?").bind(fields.title,status,fields.data.groupId,JSON.stringify(data),row.id,row.status,row.data_json,row.title,row.group_id).run();
 if(updated.meta.changes!==1)throw new PublicError('El aviso cambió mientras lo guardabas. Actualiza y vuelve a intentar.',409);return{id:row.id};
}
export async function markNoticeRead(db:D1Database,input:Record<string,unknown>,actor:Actor){
 const row=await db.prepare("SELECT id,title,status,group_id,data_json,updated_at FROM records WHERE id=? AND kind='notice'").bind(input.id).first<Stored>();if(!row)throw new PublicError('Aviso no encontrado.',404);
 if(actor.status!=='active'||(actor.role!=='admin'&&(row.status!=='published'||(row.group_id&&row.group_id!==actor.group_id))))throw new PublicError('No tienes permiso para este aviso.',403);
 const data=JSON.parse(row.data_json) as Record<string,unknown>;if(input.revision!==undefined&&input.revision!==(data.noticeRevision||row.updated_at))throw new PublicError('El aviso se actualizó. Revisa la nueva versión.',409);
 if(Array.isArray(data.readBy)&&data.readBy.includes(actor.id))return{id:row.id};
 if(Array.isArray(data.readBy)&&data.readBy.length>=5000)throw new PublicError('No se pudo registrar otra lectura de este aviso.',409);
 const updated=await db.prepare("UPDATE records SET data_json=json_set(data_json,'$.readBy',json_insert(CASE WHEN json_type(data_json,'$.readBy')='array' THEN json_extract(data_json,'$.readBy') ELSE '[]' END,'$[#]',?)),updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='notice' AND title=? AND status=? AND group_id IS ? AND json_extract(data_json,'$.body') IS ? AND json_extract(data_json,'$.noticeRevision') IS ? AND NOT EXISTS(SELECT 1 FROM json_each(CASE WHEN json_type(data_json,'$.readBy')='array' THEN json_extract(data_json,'$.readBy') ELSE '[]' END) WHERE value=?) AND COALESCE(json_array_length(json_extract(data_json,'$.readBy')),0)<5000").bind(actor.id,row.id,row.title,row.status,row.group_id,data.body??null,data.noticeRevision||null,actor.id).run();
 if(updated.meta.changes!==1){const latest=await db.prepare("SELECT title,status,group_id,data_json FROM records WHERE id=? AND kind='notice'").bind(row.id).first<Stored>();const next=latest&&JSON.parse(latest.data_json);if(!latest||latest.title!==row.title||latest.status!==row.status||latest.group_id!==row.group_id||next.body!==data.body||next.noticeRevision!==data.noticeRevision||!Array.isArray(next.readBy)||!next.readBy.includes(actor.id))throw new PublicError('El aviso cambió antes de registrar tu lectura. Actualiza.',409);}
 return{id:row.id};
}
