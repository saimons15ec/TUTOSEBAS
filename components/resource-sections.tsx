"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, FolderCog, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MAX_RESOURCE_SECTIONS, additionalResourceCatalog, resourceCategory, type AdditionalResourceRow, type ResourceSection, type ResourceSectionMode } from "@/lib/additional-resources";

type Mutate = (body: Record<string, unknown>, success?: string) => Promise<boolean>;
const modeLabels: Record<ResourceSectionMode, string> = { materials: "Materiales y archivos", courses: "Cursos con lecciones", apa: "Materiales y ayuda APA" };
const selectClass = "min-h-11 w-full rounded-xl border bg-white px-3 text-sm";

function SectionEditor({ section, mutate, onSaved, onClose }: { section?: ResourceSection; mutate: Mutate; onSaved: (id?: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(section?.title || ""), [description, setDescription] = useState(section?.description || ""), [mode, setMode] = useState<ResourceSectionMode>(section?.mode || "materials"), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{section ? "Editar sección" : "Añadir sección"}</DialogTitle><DialogDescription>{section ? "El nombre cambia para profesor y estudiante. Conserva los materiales y el acceso." : "Crea un espacio propio para organizar un tipo de contenido. Por ejemplo: Planificaciones, Evaluaciones o Infografías."}</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm font-semibold">Nombre de la sección<Input autoFocus value={title} maxLength={80} placeholder="Por ejemplo: Planificaciones de Ciencias" onChange={event => setTitle(event.target.value)}/></label>
      <label className="space-y-2 text-sm font-semibold">Descripción (opcional)<Textarea value={description} maxLength={600} placeholder="Explica qué materiales se guardan aquí." onChange={event => setDescription(event.target.value)}/></label>
      <label className="space-y-2 text-sm font-semibold">Contenido de esta sección<select className={selectClass} value={mode} disabled={Boolean(section)} onChange={event => setMode(event.target.value as ResourceSectionMode)}>{Object.entries(modeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><span className="block text-xs font-normal leading-5 text-slate-500">{mode === "courses" ? "Permite crear cursos, añadir lecciones y registrar el avance de cada estudiante." : mode === "apa" ? "Reúne materiales y las herramientas de consulta de citas y referencias." : "Permite cargar documentos, infografías, audios, presentaciones y enlaces."}</span></label>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className="bg-[#003f32]" disabled={busy || !title.trim()} onClick={async () => {
        setBusy(true); try { if (await mutate({ action: "save_resource_section", sectionId: section?.id, revision: section?.revision, title, description, mode }, section ? "Sección actualizada." : "Sección añadida. Ya puedes cargar su contenido.")) { onSaved(section?.id); onClose(); } } finally { setBusy(false); }
      }}>{busy ? <RefreshCw className="animate-spin"/> : <Check/>}{section ? "Guardar cambios" : "Crear sección"}</Button></div>
    </DialogContent>
  </Dialog>;
}

function RemoveSection({ section, sections, rows, period, mutate, onRemoved, onClose }: { section: ResourceSection; sections: ResourceSection[]; rows: AdditionalResourceRow[]; period: string; mutate: Mutate; onRemoved: (target?: string) => void; onClose: () => void }) {
  const contents = additionalResourceCatalog(rows, period, true).filter(row => resourceCategory(row) === section.id);
  const courses = contents.filter(row => row.kind === "course"), destinations = sections.filter(row => row.status === "published" && row.id !== section.id && (!courses.length || row.mode === "courses"));
  const [target, setTarget] = useState(""), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>Quitar «{section.title}»</DialogTitle><DialogDescription>La sección dejará de aparecer en el menú. Se conserva para restaurarla después.</DialogDescription></DialogHeader>
      {contents.length ? <>
        <p className="rounded-xl bg-[#fff9eb] p-4 text-sm leading-6">Contiene <strong>{contents.length} contenidos</strong>, incluidos los archivados. Elige otra sección para conservarlos. Sus archivos, publicación y planes de acceso se mantienen{courses.length ? "; también sus lecciones y avance" : ""}.</p>
        <label className="space-y-2 text-sm font-semibold">Mover el contenido a<select className={selectClass} value={target} onChange={event => setTarget(event.target.value)}><option value="">Selecciona una sección de destino</option>{destinations.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
        {!destinations.length && <p className="text-sm leading-6 text-amber-800">{courses.length ? "Crea primero otra sección de Cursos con lecciones para mover estos cursos." : "Crea primero otra sección para guardar el contenido."}</p>}
      </> : <p className="text-sm leading-6 text-slate-600">Esta sección no tiene contenidos. Puedes quitarla sin mover materiales.</p>}
      <p className="text-xs leading-5 text-slate-500">Los periodos anteriores se conservan. Restaurar la sección no devuelve automáticamente los contenidos que moviste.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button className="bg-[#003f32]" disabled={busy || (contents.length > 0 && !target)} onClick={async () => {
        if (contents.length && !destinations.some(row => row.id === target)) return toast.error("Selecciona un destino compatible.");
        setBusy(true); try { if (await mutate({ action: "archive_resource_section", sectionId: section.id, revision: section.revision, targetSectionId: target || null }, contents.length ? "Sección retirada; contenido conservado en su destino." : "Sección retirada.")) { onRemoved(target || undefined); onClose(); } } finally { setBusy(false); }
      }}>{busy ? <RefreshCw className="animate-spin"/> : <Trash2/>}Quitar sección</Button></div>
    </DialogContent>
  </Dialog>;
}

export function ResourceSectionManager({ sections, rows, period, mutate, onChanged }: { sections: ResourceSection[]; rows: AdditionalResourceRow[]; period: string; mutate: Mutate; onChanged: (id?: string) => void }) {
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<ResourceSection | "new" | null>(null), [removing, setRemoving] = useState<ResourceSection | null>(null), [busy, setBusy] = useState(false);
  const active = sections.filter(section => section.status === "published"), archived = sections.filter(section => section.status === "archived");
  const change = async (body: Record<string, unknown>, message: string, id?: string) => { setBusy(true); try { if (await mutate(body, message)) onChanged(id); } finally { setBusy(false); } };
  return <>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogTrigger asChild><Button variant="outline" className="mt-4 w-full"><FolderCog className="size-4"/> Gestionar secciones</Button></DialogTrigger>
      <DialogContent onCloseAutoFocus={event => { if (editing || removing) event.preventDefault(); }} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Organiza tus secciones</DialogTitle><DialogDescription>{period} · Añade un espacio para cada tipo de contenido, cambia sus nombres y elige su orden.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{active.length} de {MAX_RESOURCE_SECTIONS} secciones activas</p><Button className="bg-[#003f32]" disabled={busy || active.length >= MAX_RESOURCE_SECTIONS} onClick={() => { setOpen(false); setEditing("new"); }}><Plus/> Añadir sección</Button></div>
        <div className="space-y-2">{active.map((section, index) => <section className="rounded-xl border p-3" key={section.id}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words font-bold">{index + 1}. {section.title}</p><Badge variant="secondary" className="mt-1 text-xs">{modeLabels[section.mode]}</Badge></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Subir sección ${section.title}`} disabled={busy || index === 0} onClick={() => change({ action: "move_resource_section", sectionId: section.id, revision: section.revision, direction: "up" }, "Orden de secciones actualizado.")}><ArrowUp className="size-4"/></Button><Button size="icon" variant="ghost" aria-label={`Bajar sección ${section.title}`} disabled={busy || index === active.length - 1} onClick={() => change({ action: "move_resource_section", sectionId: section.id, revision: section.revision, direction: "down" }, "Orden de secciones actualizado.")}><ArrowDown className="size-4"/></Button></div></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => { setOpen(false); setEditing(section); }}><Pencil/> Editar sección</Button><Button variant="outline" size="sm" disabled={busy || active.length <= 1} onClick={() => { setOpen(false); setRemoving(section); }}><Trash2/> Quitar sección</Button></div>
        </section>)}</div>
        {archived.length > 0 && <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Secciones retiradas ({archived.length})</summary><p className="mt-2 text-xs leading-5 text-slate-500">Puedes restaurar la sección. Los contenidos que moviste se mantienen en su destino.</p><div className="mt-3 space-y-2">{archived.map(section => <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3" key={section.id}><span className="break-words text-sm font-semibold">{section.title}</span><Button variant="outline" size="sm" disabled={busy || active.length >= MAX_RESOURCE_SECTIONS} onClick={() => change({ action: "restore_resource_section", sectionId: section.id, revision: section.revision }, "Sección restaurada.", section.id)}><RefreshCw/> Restaurar</Button></div>)}</div></details>}
      </DialogContent>
    </Dialog>
    {editing && <SectionEditor section={editing === "new" ? undefined : editing} mutate={mutate} onSaved={onChanged} onClose={() => { setEditing(null); setOpen(true); }}/>}
    {removing && <RemoveSection section={removing} sections={active} rows={rows} period={period} mutate={mutate} onRemoved={onChanged} onClose={() => { setRemoving(null); setOpen(true); }}/>}
  </>;
}
