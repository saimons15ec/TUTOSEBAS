"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Archive, BookOpen, BookText, Check, ChevronDown, FileText, FolderOpen, Info, Link2, MoreHorizontal, Pencil, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RESOURCE_MATERIAL_TYPES, defaultResourceSections, resourceSections, additionalResourceCatalog, filterAdditionalResources, isAcademicResource, resourceCategory, type AdditionalCategory, type AdditionalResourceRow, type ResourceSection } from "@/lib/additional-resources";
import { SupportContentInput, resolveSupportDraft, supportDraft, type SupportUpload } from "@/components/support-content";
import { ResourceSectionManager } from "@/components/resource-sections";
import { SupportLinks } from "@/components/courses";

type Mutate = (body: Record<string, unknown>, success?: string) => Promise<boolean>;
type ManagedDialog = { open: boolean; onOpenChange: (open: boolean) => void; onCloseAutoFocus?: (event: Event) => void };
const selectClass = "min-h-11 w-full rounded-xl border bg-white px-3 text-sm";
const SectionContext = createContext<ResourceSection[]>(defaultResourceSections());
export const useResourceSections = () => useContext(SectionContext);
function CategoryPicker({ value, onChange, kind }: { value: AdditionalCategory; onChange: (value: AdditionalCategory) => void; kind?: string }) {
  const available = useResourceSections().filter(section => kind !== "course" || section.mode === "courses");
  return <label className="block space-y-2 text-sm font-semibold">Sección donde aparecerá<select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>{available.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select><span className="block text-xs font-normal leading-5 text-slate-500">{available.find(section => section.id === value)?.summary}</span></label>;
}

function ResourceEditDialog({ row, mutate, open, onOpenChange, onCloseAutoFocus }: { row: AdditionalResourceRow; mutate: Mutate } & ManagedDialog) {
  const [title, setTitle] = useState(row.title), [description, setDescription] = useState(String(row.data.description || "")), [category, setCategory] = useState<AdditionalCategory>(resourceCategory(row) || "other"), [plan, setPlan] = useState(String(row.data.plan || "Bronce")), [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{row.kind === "course" ? "Editar datos del curso" : "Editar datos del recurso"}</DialogTitle><DialogDescription>Se guardará como borrador para revisar y publicar. Conserva su archivo o enlace.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-semibold">Título<Input value={title} maxLength={180} onChange={event => setTitle(event.target.value)}/></label><label className="space-y-2 text-sm font-semibold">Descripción<Textarea value={description} maxLength={4000} onChange={event => setDescription(event.target.value)}/></label><CategoryPicker value={category} onChange={setCategory} kind={row.kind}/><label className="space-y-2 text-sm font-semibold">Plan mínimo<select className={selectClass} value={plan} onChange={event => setPlan(event.target.value)}>{["Bronce", "Plata", "Gold"].map(value => <option key={value}>{value}</option>)}</select></label><Button disabled={busy} className="bg-[#003f32]" onClick={async () => { if (!title.trim()) return toast.error("Escribe un título."); setBusy(true); try { if (await mutate({ action: "update_additional_resource", id: row.id, title, data: { description, category, plan } }, "Recurso actualizado como borrador.")) onOpenChange(false); } finally { setBusy(false); } }}>{busy ? <RefreshCw className="animate-spin"/> : <Pencil/>} Guardar cambios</Button></DialogContent></Dialog>;
}

function ResourceReferenceDialog({ rows, row, period, mutate, initialCategory = "other", open: controlledOpen, onOpenChange, onCloseAutoFocus }: { rows: AdditionalResourceRow[]; row?: AdditionalResourceRow; period: string; mutate: Mutate; initialCategory?: AdditionalCategory; open?: boolean; onOpenChange?: (open: boolean) => void; onCloseAutoFocus?: (event: Event) => void }) {
  const [localOpen, setLocalOpen] = useState(false), [id, setId] = useState(row?.id || ""), [query, setQuery] = useState(""), [category, setCategory] = useState<AdditionalCategory>(row ? resourceCategory(row) || "other" : initialCategory), [busy, setBusy] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { if (busy && value) return; setLocalOpen(value); onOpenChange?.(value); if (value) { setId(row?.id || ""); setQuery(""); setCategory(row ? resourceCategory(row) || "other" : initialCategory); } };
  const candidates = rows.filter(item => isAcademicResource(item) && item.status !== "archived" && item.data.period === period), filtered = filterAdditionalResources(candidates, query, ""), selected = candidates.find(item => item.id === id);
  return <Dialog open={open} onOpenChange={setOpen}>{controlledOpen === undefined && <DialogTrigger asChild><Button size="sm" variant="outline"><Link2/> {row ? "Cambiar sección" : "Usar material de una materia"}</Button></DialogTrigger>}<DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Mostrar también un material de materia</DialogTitle><DialogDescription>Selecciona un material de Complexivos o Fin de Carrera para mostrarlo también en esta sección. Su archivo, publicación y acceso siguen gestionándose en la materia original.</DialogDescription></DialogHeader>{!row && <><Input aria-label="Buscar material de una materia" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título, materia o tema"/><label className="space-y-2 text-sm font-semibold">Material<select className={selectClass} value={id} onChange={event => setId(event.target.value)}><option value="">Selecciona un material</option>{[...new Map([...filtered, ...(selected ? [selected] : [])].map(item => [item.id, item])).values()].map(item => <option key={item.id} value={item.id}>{String(item.data.subject)} · {String(item.data.topic || "")} · {item.title}</option>)}</select></label>{!candidates.length && <p className="text-sm text-slate-600">Primero añade un material en una materia del periodo vigente.</p>}</>}{selected && <p className="rounded-xl bg-slate-50 p-3 text-sm">{selected.title} · {String(selected.data.subject)} · {String(selected.data.topic || "")} · Plan {String(selected.data.plan || "Bronce")}</p>}<CategoryPicker value={category} onChange={setCategory}/><Button disabled={busy || !id} className="bg-[#003f32]" onClick={async () => { setBusy(true); try { if (await mutate({ action: "set_additional_reference", id, category }, "Referencia de apoyo guardada.")) setOpen(false); } finally { setBusy(false); } }}>{busy ? <RefreshCw className="animate-spin"/> : <Link2/>} Guardar referencia</Button></DialogContent></Dialog>;
}

function ArchiveResource({ row, mutate, open, onOpenChange, onCloseAutoFocus }: { row: AdditionalResourceRow; mutate: Mutate } & ManagedDialog) {
  const reference = isAcademicResource(row), [busy, setBusy] = useState(false);
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}><AlertDialogHeader><AlertDialogTitle>{reference ? "Quitar de Recursos adicionales" : "Archivar recurso"}</AlertDialogTitle><AlertDialogDescription>{reference ? "El material seguirá en su materia y tema, con su archivo y preguntas vinculadas." : "Dejará de aparecer para estudiantes. Puedes restaurarlo como borrador; se conservará su archivo."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async () => { setBusy(true); try { await mutate(reference ? { action: "set_additional_reference", id: row.id, category: null } : { action: "update_status", id: row.id, status: "archived" }, reference ? "Referencia retirada; material conservado." : "Recurso archivado."); } finally { setBusy(false); } }}>{reference ? "Quitar referencia" : "Archivar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function ReplaceContentDialog({ row, mutate, upload, open, onOpenChange, onCloseAutoFocus }: { row: AdditionalResourceRow; mutate: Mutate; upload: SupportUpload } & ManagedDialog) {
  const [content, setContent] = useState(supportDraft({ materialType: row.data.materialType })), [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{row.kind === "course" ? "Archivo de presentación del curso" : "Sustituir archivo o enlace"}</DialogTitle><DialogDescription>{row.title}. Se guardará como borrador. El archivo anterior se conserva; deja de estar vinculado a esta ficha.</DialogDescription></DialogHeader><SupportContentInput value={content} onChange={setContent} disabled={busy}/><Button disabled={busy} className="bg-[#003f32]" onClick={async () => { setBusy(true); try { const data = await resolveSupportDraft(content, upload); if (data && await mutate({ action: "replace_additional_content", id: row.id, data }, "Contenido sustituido. Revisa y vuelve a publicar.")) onOpenChange(false); } finally { setBusy(false); } }}>{busy ? <RefreshCw className="animate-spin"/> : <Pencil/>} Guardar contenido</Button></DialogContent></Dialog>;
}

const sectionIcon = (section: ResourceSection) => section.mode === "courses" ? BookOpen : section.mode === "apa" ? FileText : section.id === "curriculum" || section.id === "planning" ? BookText : FolderOpen;

function ResourceOptions({ row, rows, period, mutate, upload }: { row: AdditionalResourceRow; rows: AdditionalResourceRow[]; period: string; mutate: Mutate; upload?: SupportUpload }) {
  const [menuOpen, setMenuOpen] = useState(false), [action, setAction] = useState<"edit" | "replace" | "reference" | "archive" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = (event: Event) => { event.preventDefault(); triggerRef.current?.focus(); };
  const choose = (value: typeof action) => { setMenuOpen(false); setAction(value); };
  const close = (value: boolean) => { if (!value) setAction(null); };
  const reference = isAcademicResource(row);
  return <>
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild><Button ref={triggerRef} variant="outline" size="sm" title="Opciones" aria-label={`Opciones de ${row.title}`}><MoreHorizontal className="size-4"/><span className="sr-only sm:not-sr-only">Opciones</span></Button></PopoverTrigger>
      <PopoverContent align="end" onCloseAutoFocus={event => { if (action) event.preventDefault(); }} className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-2">
        <p className="mb-2 break-words border-b px-2 pb-3 pt-1 text-sm font-bold">{row.title}</p>
        <div className="flex flex-col gap-1 [&_button]:min-h-10 [&_button]:w-full [&_button]:justify-start">
          {reference ? <Button variant="ghost" onClick={() => choose("reference")}><Link2/> Cambiar sección</Button> : <>
            <Button variant="ghost" onClick={() => choose("edit")}><Pencil/> Editar nombre y acceso</Button>
            {upload && <Button variant="ghost" onClick={() => choose("replace")}><FileText/> {row.kind === "course" ? "Archivo de presentación" : "Cambiar archivo o enlace"}</Button>}
          </>}
          <Button variant="ghost" onClick={() => choose("archive")}><Archive/> {reference ? "Quitar referencia" : "Archivar"}</Button>
        </div>
        <p className="mt-2 border-t px-2 pt-3 text-xs leading-5 text-slate-500">{reference ? "Quitar la referencia conserva el material en su materia." : "Archivar conserva los archivos y permite restaurar."}</p>
      </PopoverContent>
    </Popover>
    {action === "edit" && <ResourceEditDialog row={row} mutate={mutate} open onOpenChange={close} onCloseAutoFocus={restoreFocus}/>}
    {action === "replace" && upload && <ReplaceContentDialog row={row} mutate={mutate} upload={upload} open onOpenChange={close} onCloseAutoFocus={restoreFocus}/>}
    {action === "reference" && <ResourceReferenceDialog rows={rows} row={row} period={period} mutate={mutate} open onOpenChange={close} onCloseAutoFocus={restoreFocus}/>}
    {action === "archive" && <ArchiveResource row={row} mutate={mutate} open onOpenChange={close} onCloseAutoFocus={restoreFocus}/>}
  </>;
}

export function AdditionalResourceCard({ row, mutate, actions }: { row: AdditionalResourceRow; mutate?: Mutate; actions?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const reference = isAcademicResource(row), materialType = String(row.data.materialType || "Documento");
  return <article className="flex h-full min-w-0 flex-col rounded-[22px] border border-[#dce5e1] bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge variant="secondary" className="bg-[#f3f6f4] text-[#285548]">{materialType}</Badge>
      {mutate && <Badge className={row.status === "published" ? "border-0 bg-emerald-100 text-emerald-800" : "border-0 bg-amber-100 text-amber-800"}>{row.status === "published" ? "Publicado" : "Borrador"}</Badge>}
    </div>
    <h3 className="mt-4 break-words text-base font-bold leading-6 text-[#123c32]">{row.title}</h3>
    {Boolean(row.data.description) && <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-600">{String(row.data.description)}</p>}
    {Boolean(row.data.subject || row.data.topic) && <p className="mt-3 break-words text-xs leading-5 text-slate-500">{[row.data.subject, row.data.topic].filter(Boolean).map(String).join(" · ")}</p>}
    {reference && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#8a5e08]"><Link2 className="size-3.5 shrink-0"/> Material de {row.data.area === "complexive" ? "Complexivos" : "Fin de Carrera"}</p>}
    <p className="mt-3 text-xs text-slate-500">Plan mínimo: {String(row.data.plan || "Bronce")}</p>
    {Boolean(row.data.fileName) && <p className="mt-3 truncate text-xs text-slate-500" title={String(row.data.fileName)}>{String(row.data.fileName)}</p>}
    <div className="mt-4"><SupportLinks row={row}/></div>
    {mutate && <div className="mt-auto pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1ef] pt-4">
        {reference ? <p className="min-w-0 flex-1 text-xs leading-5 text-slate-500">Publicación desde su materia.</p> : <Button size="sm" className={row.status === "published" ? "" : "bg-[#003f32]"} variant={row.status === "published" ? "outline" : "default"} disabled={busy} onClick={async () => {
          setBusy(true);
          try { await mutate({ action: "update_status", id: row.id, status: row.status === "published" ? "draft" : "published" }, row.status === "published" ? "Recurso ocultado." : "Recurso publicado."); } finally { setBusy(false); }
        }}>{busy ? <RefreshCw className="size-4 animate-spin"/> : row.status === "published" ? null : <Check className="size-4"/>}{row.status === "published" ? "Ocultar" : "Publicar recurso"}</Button>}
        {actions}
      </div>
    </div>}
  </article>;
}

export function AdditionalResourcesView<T extends AdditionalResourceRow>({ rows, relatedRows = [], sectionRows = [], visibleSectionIds, period, mutate, upload, renderCard, renderActions, apa, category: selectedCategory, onCategoryChange }: {
  rows: T[]; relatedRows?: AdditionalResourceRow[]; sectionRows?: AdditionalResourceRow[]; visibleSectionIds?: string[]; period: string; mutate?: Mutate; upload?: SupportUpload;
  renderCard: (row: T, actions?: ReactNode) => ReactNode; renderActions?: (section: ResourceSection) => ReactNode;
  apa: ReactNode; category?: AdditionalCategory; onCategoryChange?: (category: AdditionalCategory) => void;
}) {
  const [query, setQuery] = useState(""), [materialType, setMaterialType] = useState(""), [status, setStatus] = useState(""), [localCategory, setLocalCategory] = useState<AdditionalCategory>("planning");
  const allSections = resourceSections(sectionRows, period, true), sections = allSections.filter(section => section.status === "published" && (visibleSectionIds === undefined || visibleSectionIds.includes(section.id)));
  const desired = selectedCategory || localCategory, active = sections.some(section => section.id === desired) ? desired : sections[0]?.id || "";
  const catalog = additionalResourceCatalog(rows, period);
  const visible = filterAdditionalResources(catalog, query, materialType, relatedRows, sections).filter(row => !status || row.status === status);
  const archived = additionalResourceCatalog(rows, period, true).filter(row => row.status === "archived" && !isAcademicResource(row) && resourceCategory(row) === active);
  const filtered = Boolean(query || materialType || status);
  const reset = () => { setQuery(""); setMaterialType(""); setStatus(""); };
  const renderItems = (items: T[]) => <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{items.map(row => <div className="min-w-0" key={row.id}>{renderCard(row, mutate ? <ResourceOptions row={row} rows={rows} period={period} mutate={mutate} upload={upload}/> : undefined)}</div>)}</div>;
  return <SectionContext.Provider value={sections}><Tabs value={active} className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]" onValueChange={value => { setLocalCategory(value as AdditionalCategory); onCategoryChange?.(value as AdditionalCategory); reset(); }}>
    <aside className="min-w-0 rounded-[22px] border border-[#dce5e1] bg-white p-3 sm:p-4">
      <p className="px-2 text-xs font-bold uppercase tracking-[.12em] text-slate-500">Secciones</p>
      <TabsList aria-label="Secciones de recursos y cursos" className="mt-3 grid h-auto w-full grid-cols-2 items-stretch gap-2 bg-transparent p-0 lg:grid-cols-1">
        {sections.map(section => {
          const category = section.id, Icon = sectionIcon(section);
          return <TabsTrigger value={category} key={category} className="group h-auto min-w-0 justify-start gap-3 rounded-xl border border-[#edf1ef] px-3 py-3 text-left whitespace-normal hover:bg-[#f5f8f6] data-[state=active]:border-[#003f32] data-[state=active]:bg-[#003f32] data-[state=active]:text-white">
            <Icon className="hidden size-5 text-[#8a5e08] group-data-[state=active]:text-[#edca6b] sm:block"/>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-5">{section.title}</span><span className="mt-1 hidden text-xs font-normal leading-5 text-slate-500 group-data-[state=active]:text-white/75 sm:block">{section.summary}</span></span>
            <span className="shrink-0 rounded-md bg-[#f2f5f3] px-1.5 py-0.5 text-xs text-[#285548] group-data-[state=active]:bg-white/15 group-data-[state=active]:text-white">{catalog.filter(row => resourceCategory(row) === category).length}</span>
          </TabsTrigger>;
        })}
      </TabsList>
      {mutate && <ResourceSectionManager sections={allSections} rows={rows} period={period} mutate={mutate} onChanged={id => { if (id) { setLocalCategory(id); onCategoryChange?.(id); } reset(); }}/>}
      <p className="mt-4 hidden border-t pt-4 text-xs leading-5 text-slate-500 lg:block">{mutate ? "Elige una sección y añade su contenido. Los borradores se revisan antes de publicar." : "Elige una sección para consultar tus materiales o continuar un curso."}</p>
    </aside>
    <div className="min-w-0 space-y-5">
      {!sections.length && <div className="rounded-[22px] border bg-white p-6"><h2 className="font-bold">No hay secciones habilitadas para tu grupo</h2><p className="mt-2 text-sm leading-6 text-slate-500">Consulta al profesor sobre los beneficios de tu plan y su vigencia.</p></div>}
      {sections.map(section => {
        const category = section.id;
        const items = visible.filter(row => resourceCategory(row) === category), total = catalog.filter(row => resourceCategory(row) === category).length;
        const courses = items.filter(row => row.kind === "course"), support = items.filter(row => row.kind !== "course"), Icon = sectionIcon(section);
        return <TabsContent key={category} value={category} className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-[22px] border border-[#dce5e1] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0 flex-1 basis-64">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.08em] text-[#8a5e08]"><Icon className="size-4"/>{mutate ? "Gestionar contenido" : "Explorar contenido"}</div>
                <h2 className="break-words text-xl font-extrabold tracking-tight text-[#123c32]">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
              </div>
              {renderActions && <div className="flex max-w-full flex-wrap gap-2">{renderActions(section)}</div>}
            </div>
            <div className="border-t border-[#e6ede8] bg-[#f6f8f5] px-5 py-4 sm:px-6">
              <p className="text-xs leading-5 text-[#385e50]"><strong>{mutate ? "Qué puedes añadir: " : "Qué encontrarás aquí: "}</strong>{section.examples}</p>
              {mutate && <p className="mt-2 text-xs leading-5 text-slate-500">{section.mode === "courses" ? "Crea el curso → añade y revisa sus lecciones → publica las lecciones y el curso." : "Añade el material → abre su archivo o enlace → publica el recurso."}</p>}
            </div>
          </section>
          {mutate && <div className="flex flex-wrap items-center justify-between gap-2 px-1"><p className="max-w-md text-xs leading-5 text-slate-500">También puedes mostrar aquí un material que ya cargaste en una materia.</p><ResourceReferenceDialog rows={rows} period={period} mutate={mutate} initialCategory={category}/></div>}
          {section.mode === "apa" && <details className="group rounded-2xl border border-[#dce5e1] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold"><span className="flex items-center gap-2"><BookText className="size-4 text-[#8a5e08]"/> Guía rápida y revisión de referencias</span><ChevronDown className="size-4 transition-transform group-open:rotate-180"/></summary>
            <div className="border-t p-4 sm:p-5"><p className="mb-4 text-xs leading-5 text-slate-500">Herramientas de consulta incluidas en la plataforma. Los archivos que cargue el profesor aparecen abajo.</p>{apa}</div>
          </details>}
          <section aria-label="Filtrar contenidos de la sección" className="rounded-2xl border border-[#dce5e1] bg-white p-4">
            <div className={`grid gap-3 ${mutate ? "sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_140px]" : "sm:grid-cols-[minmax(0,1fr)_180px]"}`}>
              <label className={`block min-w-0 space-y-1.5 text-xs font-semibold text-slate-600 ${mutate ? "sm:col-span-2 xl:col-span-1" : ""}`}><span>Buscar en esta sección</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400"/><Input className="min-h-11 pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder={section.mode === "courses" ? "Curso, lección o descripción" : "Título, materia o descripción"}/></span></label>
              <label className="block min-w-0 space-y-1.5 text-xs font-semibold text-slate-600"><span>Formato del material</span><select className={selectClass} value={materialType} onChange={event => setMaterialType(event.target.value)}><option value="">Todos los formatos</option>{RESOURCE_MATERIAL_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
              {mutate && <label className="block min-w-0 space-y-1.5 text-xs font-semibold text-slate-600"><span>Publicación</span><select className={selectClass} value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="draft">Borradores</option><option value="published">Publicados</option></select></label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{filtered ? `${items.length} de ${total} contenidos` : `${total} ${total === 1 ? "contenido" : "contenidos"}`}{mutate && " · Los borradores solo los ve el profesor"}</p>{filtered && <Button variant="ghost" size="sm" onClick={reset}>Limpiar filtros</Button>}</div>
          </section>
          {section.mode === "courses" || courses.length > 0 ? <>
            {courses.length > 0 && <section className="space-y-3"><h3 className="px-1 text-sm font-bold">Cursos y avance por lección</h3>{renderItems(courses)}</section>}
            {support.length > 0 && <section className="space-y-3"><div className="px-1"><h3 className="text-sm font-bold">Materiales complementarios de cursos</h3><p className="mt-1 text-xs leading-5 text-slate-500">Archivos y enlaces para consultar. Las lecciones y el avance se gestionan dentro de cada curso.</p></div>{renderItems(support)}</section>}
          </> : items.length > 0 && <section className="space-y-3"><h3 className="px-1 text-sm font-bold">{section.mode === "apa" ? "Materiales APA del profesor" : "Materiales de consulta"}</h3>{renderItems(items)}</section>}
          {!items.length && <div className="rounded-[22px] border border-dashed border-[#cbd8d0] bg-white px-6 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f3f6f0]"><Icon className="size-6 text-[#718677]"/></span>
            <h3 className="mt-4 text-base font-bold">{filtered ? "No hay resultados con estos filtros" : section.mode === "courses" ? "Todavía no hay cursos en esta sección" : "Esta sección aún no tiene materiales"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{filtered ? "Cambia la búsqueda o limpia los filtros para ver todos los contenidos." : mutate ? section.mode === "courses" ? "Pulsa Crear curso. Después podrás añadir sus lecciones desde Gestionar curso." : "Usa el botón de carga de esta sección. El material se guardará como borrador para que lo revises." : "Aquí aparecerán los contenidos que publique tu profesor y estén habilitados para tu cuenta."}</p>
            {filtered && <Button className="mt-4" variant="outline" onClick={reset}>Ver todos los contenidos</Button>}
          </div>}
          {mutate && archived.length > 0 && <details className="rounded-2xl border border-[#dce5e1] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Archivados de esta sección ({archived.length})</summary><p className="mt-3 text-xs leading-5 text-slate-500">Se conservan los archivos. Al restaurar, vuelve a revisar y publicar el contenido.</p><div className="mt-4 space-y-3">{archived.map(row => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" key={row.id}><div className="min-w-0"><p className="break-words text-sm font-semibold">{row.title}</p><p className="text-xs text-slate-500">Plan mínimo: {String(row.data.plan || "Bronce")}</p></div><Button size="sm" variant="outline" onClick={() => mutate({ action: "update_status", id: row.id, status: "draft" }, "Restaurado como borrador. Revisa antes de publicar.")}><RefreshCw/> Restaurar borrador</Button></div>)}</div></details>}
        </TabsContent>;
      })}
      {mutate && <p className="flex items-start gap-2 rounded-xl bg-[#f0f4f1] p-3 text-xs leading-5 text-slate-600"><Info className="mt-0.5 size-4 shrink-0"/> Publicar habilita el contenido para los estudiantes con acceso. Ocultar lo devuelve a borrador; archivar permite conservarlo para restaurar después.</p>}
    </div>
  </Tabs></SectionContext.Provider>;
}
