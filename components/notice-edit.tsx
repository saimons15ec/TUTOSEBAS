"use client";
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogTrigger,DialogFooter } from '@/components/ui/dialog';
type Row={id:string;title:string;status:string;group_id?:string|null;updated_at:string;data:Record<string,unknown>};
export function NoticeEdit({row,groups,mutate}:{row:Row;groups:{id:string;title:string}[];mutate:(body:Record<string,unknown>,success?:string)=>Promise<boolean>}){
 const[open,setOpen]=useState(false),[title,setTitle]=useState(row.title),[message,setMessage]=useState(String(row.data.body||'')),[group,setGroup]=useState(row.group_id||'');
 const save=async(status:string)=>{if(await mutate({action:'save_notice',id:row.id,revision:row.data.noticeRevision||row.updated_at,title,status,data:{body:message,groupId:group||null}},status==='published'?'Aviso actualizado y publicado.':'Aviso guardado como borrador.'))setOpen(false);};
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Pencil/> Editar aviso</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Editar aviso</DialogTitle><DialogDescription>Los cambios conservan la versión anterior. Al cambiar el mensaje o los destinatarios, el aviso vuelve a estar pendiente de lectura.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-semibold">Título<Input maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="space-y-2 text-sm font-semibold">Mensaje<Textarea maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)}/></label><label className="space-y-2 text-sm font-semibold">Destinatarios<select className="min-h-11 w-full rounded-xl border bg-white px-3" value={group} onChange={e=>setGroup(e.target.value)}><option value="">Todos los estudiantes</option>{groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="outline" disabled={!title.trim()||!message.trim()} onClick={()=>save('draft')}>Guardar borrador</Button><Button disabled={!title.trim()||!message.trim()} onClick={()=>save('published')}>Guardar y publicar</Button></DialogFooter></DialogContent></Dialog>;
}
