"use client";
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { buildTaskQueue } from '@/lib/task-queue';
export function TaskQueue({ rows, period, go }: { rows: {kind:string;status:string;data:Record<string,unknown>}[]; period:string; go:(id:string)=>void }) {
  const tasks = buildTaskQueue(rows, period);
  return tasks.length ? <div className="grid gap-3 md:grid-cols-2">{tasks.map(task=><button key={task.label} onClick={()=>go(task.target)} className="flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-[#f1f6f2] focus-visible:outline-2 focus-visible:outline-[#003f32]"><strong className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8f0dc] text-[#8a5e08]">{task.count}</strong><span className="flex-1 text-sm font-semibold">{task.label}</span><ChevronRight aria-hidden="true" className="size-4 shrink-0"/></button>)}</div> : <p className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><CheckCircle2 className="size-5"/> No hay tareas pendientes en esta cola.</p>;
}
