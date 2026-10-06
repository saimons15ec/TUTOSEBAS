"use client";
import { useId, type ComponentType } from 'react';
import { groupNavigation } from '@/lib/navigation-groups';
type Item = readonly [string,string,ComponentType<{className?:string}>];
export function PlatformNav({items,active,go,unread=0}:{items:readonly Item[];active:string;go:(id:string)=>void;unread?:number}) {
  const prefix=useId();
  return <nav aria-label="Menú principal" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-5">{groupNavigation(items).map((group,index)=><section key={group.label} aria-labelledby={`${prefix}-${index}`} className="mb-3"><h3 id={`${prefix}-${index}`} className="px-3.5 pb-2 pt-3 text-[11px] font-bold uppercase tracking-widest text-[#b3ccbf]">{group.label}</h3>{group.items.map(([id,label,Icon])=><button key={id} aria-current={active===id?'page':undefined} onClick={()=>go(id)} className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold ${active===id?'bg-white text-[#003f32]':'text-slate-300 hover:bg-white/8 hover:text-white'}`}><Icon className="size-[18px]"/><span className="flex-1">{label}</span>{id==='notices'&&unread>0&&<span aria-label={`${unread} aviso${unread===1?'':'s'} sin leer`} className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold leading-none text-white">{unread>99?'99+':unread}</span>}</button>)}</section>)}</nav>;
}
