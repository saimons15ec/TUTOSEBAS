"use client";

import { useMemo, useState } from "react";
import { CheckCheck, CheckCircle2, Download, Layers3, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { previewQuestionBlock, QUESTION_FORMATS, tableQuestionInputs, validateBlockContext, type BlockContext, type QuestionFormat } from "@/lib/question-blocks";
import { QUESTION_FORMAT_GUIDES, questionTemplateCsv, questionTemplateSlug, type QuestionTemplateFormat } from "@/lib/question-templates";
import { questionTextInputs } from "@/lib/question-document";
import { questionWordTemplate } from "@/lib/question-word-template";
import { readQuestionBlockFile } from "@/lib/question-block-file";
import { AcademicTopicSelector } from "@/components/academic-topics";
import { type AcademicTopic } from "@/lib/academic-topics";
import { questionBlockReviewState } from "@/lib/teacher-academic";

type RecordItem = { kind: string; id: string; title: string; status: string; data: Record<string, unknown> };
type Props = {
  topicRows: RecordItem[]; subjects: Record<"complexive" | "final_degree", string[]>; resources: RecordItem[]; questions: RecordItem[]; period: string;
  initialArea?: "complexive" | "final_degree"; initialSubject?: string; initialTopic?: AcademicTopic | null;
  lockScope?: boolean;
  onImported?: (context: { subject: string; topic: string; topicId: string }) => void;
  mutate: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
};
const selectClass = "min-h-11 w-full rounded-xl border bg-white px-3 text-sm";

export function QuestionBlockImport({ subjects, resources, questions, topicRows, period, initialArea = "complexive", initialSubject = "", initialTopic = null, lockScope = false, onImported, mutate }: Props) {
  const [open, setOpen] = useState(false), [area, setArea] = useState(initialArea), [subject, setSubject] = useState(initialSubject);
  const [topic, setTopic] = useState(""), [topicId, setTopicId] = useState(""), [title, setTitle] = useState(""), [format, setFormat] = useState<QuestionTemplateFormat>("Mixto");
  const [sourceResourceId, setSourceResourceId] = useState(""), [source, setSource] = useState(""), [pasted, setPasted] = useState("");
  const [grid, setGrid] = useState<unknown[][] | null>(null), [fileName, setFileName] = useState(""), [analyzed, setAnalyzed] = useState(false), [busy, setBusy] = useState(false);
  const currentSubject = subjects[area].includes(subject) ? subject : "";
  const availableResources = resources.filter(row => row.status !== "archived" && row.data.area === area && row.data.subject === currentSubject && row.data.period === period && (!topic || row.data.topic === topic));
  const context = useMemo(() => ({ area, subject: currentSubject, topic, topicId, title: title || `${topic} · bloque`, format: format === "Mixto" ? "Selección directa" : format, requireExplicitFormat: format === "Mixto", period, source, sourceResourceId, plan: "Bronce" }), [area, currentSubject, topic, topicId, title, format, period, source, sourceResourceId]);
  const analysis = useMemo(() => {
    if (!analyzed) return null;
    const normalized = validateBlockContext(context);
    try {
      const inputs = grid ? tableQuestionInputs(grid) : questionTextInputs(pasted);
      const existing = questions.filter(row => row.data.area === area && row.data.subject === currentSubject && row.data.period === period).map(row => row.data);
      return { ...previewQuestionBlock(inputs, (normalized.context || context) as BlockContext, existing), contextErrors: normalized.errors };
    } catch (error) { return { rows: [], questions: [], invalid: 0, duplicates: 0, errors: [error instanceof Error ? error.message : "No se pudo leer la tabla."], contextErrors: normalized.errors }; }
  }, [analyzed, context, grid, pasted, questions, area, currentSubject, period]);
  const change = (callback: () => void) => { callback(); setAnalyzed(false); };
  const selectResource = (id: string) => change(() => {
    setSourceResourceId(id);
    const row = availableResources.find(item => item.id === id);
    if (row) { setTopic(String(row.data.topic || "")); setTopicId(String(row.data.topicId || "")); }
    setSource(row ? `${row.title} · ${String(row.data.materialType || "Material")}${row.data.topic ? ` · ${String(row.data.topic)}` : ""}` : "");
  });
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([questionTemplateCsv(format)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `TUTOSEBAS_${questionTemplateSlug(format)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const downloadWordTemplate = () => {
    const url = URL.createObjectURL(new Blob([questionWordTemplate(format, { subject: currentSubject, topic }).buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `TUTOSEBAS_${questionTemplateSlug(format)}.docx`; anchor.click(); URL.revokeObjectURL(url);
  };
  const ready = analysis && !analysis.contextErrors.length && !analysis.errors.length && !analysis.invalid && analysis.questions.length > 0;
  const loadFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setAnalyzed(false); setGrid(null); setPasted(""); setFileName("");
    try { const result = await readQuestionBlockFile(file); setGrid(result.grid || null); setPasted(result.text || (result.grid ? result.grid.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '\"\"')}"`).join("\t")).join("\n") : "")); setFileName(file.name); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo abrir el archivo."); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (value && initialSubject) { setArea(initialArea); setSubject(initialSubject); setTopic(initialTopic?.title || ""); setTopicId(initialTopic && !initialTopic.legacy ? initialTopic.id : ""); } } }}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 bg-white"><Layers3/> Importar bloque</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Importar preguntas por tema</DialogTitle><DialogDescription>Word .docx, PDF con texto, Excel .xlsx, CSV o texto pegado. Archivos de hasta 2 MB; PDF de hasta 60 páginas. Hasta 100 preguntas por bloque, con cuatro alternativas y una sola correcta. Se guardan pendientes; puedes mezclar los cinco formatos en el mismo bloque. Las claves deben estar escritas; se revisa todo antes de guardar.</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Área<select className={selectClass} value={area} disabled={busy || lockScope} onChange={event => change(() => { setArea(event.target.value as typeof area); setSubject(""); setTopic(""); setTopicId(""); setSourceResourceId(""); setSource(""); })}><option value="complexive">Complexivos</option><option value="final_degree">Fin de Carrera</option></select></label>
        <label className="space-y-2 text-sm font-semibold">Materia<select className={selectClass} value={currentSubject} disabled={busy || lockScope} onChange={event => change(() => { setSubject(event.target.value); setTopic(""); setTopicId(""); setSourceResourceId(""); setSource(""); })}><option value="">Selecciona una materia</option>{subjects[area].map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold">Tema<AcademicTopicSelector scope={{area,subject:currentSubject,period}} topicRows={topicRows} content={[...resources,...questions]} value={topic} topicId={topicId} disabled={busy} mutate={mutate} onChange={(title,id)=>change(()=>{setTopic(title);setTopicId(id);setSourceResourceId("");setSource("")})}/></label>
        <label className="space-y-2 text-sm font-semibold">Nombre del bloque<Input value={title} maxLength={180} disabled={busy} placeholder={topic ? `${topic} · bloque` : "Tema 1 · bloque 1"} onChange={event => change(() => setTitle(event.target.value))}/></label>
        <label className="space-y-2 text-sm font-semibold">Formato de la plantilla y por defecto<select className={selectClass} value={format} disabled={busy} onChange={event => change(() => setFormat(event.target.value as QuestionTemplateFormat))}><option value="Mixto">Mixto · formato por pregunta</option>{QUESTION_FORMATS.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold">Material de origen (opcional)<select className={selectClass} value={sourceResourceId} disabled={busy || !currentSubject} onChange={event => selectResource(event.target.value)}><option value="">Sin material vinculado</option>{availableResources.map(row => <option key={row.id} value={row.id}>{row.title} · {row.status === "published" ? "Publicado" : "Pendiente de publicación"}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">Fuente común (si la celda fuente está vacía)<Input value={source} maxLength={500} disabled={busy} placeholder="Material oficial, Tema 1, sección o páginas" onChange={event => change(() => setSource(event.target.value))}/></label>
      </div>
      <div aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Plantilla de {format}:</strong> {QUESTION_FORMAT_GUIDES[format]}<p className="mt-1">Los ejemplos cambian al elegir formato; reemplázalos por tus preguntas. Si el archivo indica formato por pregunta, se conserva para permitir bloques mixtos.</p></div>
      <p className="text-sm text-slate-600">Periodo: <strong>{period}</strong>. Excel: se lee la primera hoja. Para casos prácticos completa contexto; para relacionar y ordenar incluye listas y cuatro combinaciones o secuencias completas.</p>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={downloadTemplate}><Download/> Excel/CSV · {format}</Button><Button type="button" variant="outline" onClick={downloadWordTemplate}><Download/> Word · {format}</Button><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold"><UploadCloud className="size-4"/> Cargar archivo<input type="file" className="sr-only" accept=".docx,.pdf,.xlsx,.csv,.tsv,.txt" disabled={busy} onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = ""; }}/></label>{fileName && <span className="break-all text-sm text-slate-500">{fileName}</span>}</div>
      <label className="space-y-2 text-sm font-semibold">Texto o tabla extraída (puedes corregirla antes de analizar)<Textarea className="min-h-28 font-mono text-xs" value={pasted} maxLength={1_000_000} disabled={busy} placeholder="pregunta → opcion_a → opcion_b → opcion_c → opcion_d → correcta → explicacion" onChange={event => change(() => { setPasted(event.target.value); setGrid(null); setFileName(""); })}/></label>
      <details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Cómo preparar cada estructura</summary><ul className="mt-3 list-disc space-y-2 pl-5"><li>Selección directa: pregunta y cuatro respuestas.</li><li>Completar: enunciado con espacios; cada alternativa contiene la solución completa.</li><li>Relacionar: ambas listas en el enunciado; cada alternativa contiene todos los pares.</li><li>Ordenar: pasos numerados en el enunciado; cada alternativa contiene una secuencia completa.</li><li>Caso práctico: situación en contexto, pregunta de análisis y cuatro decisiones o soluciones.</li></ul><p className="mt-3">Word/PDF: usa “Pregunta 1:”, “Formato:”, “Contexto:” si corresponde, “Alternativa A:” hasta D, “Correcta:”, “Explicación:” y “Fuente:”. Los PDF escaneados necesitan OCR previo; los diseños con columnas deben revisarse. Word antiguo .doc debe guardarse como .docx. Columnas opcionales en tablas: formato, contexto, fuente y mezclar_alternativas (Sí/No). Correcta: A–D o 1–4. Mantén las celdas con saltos de línea entre comillas en CSV. No se corrigen respuestas abiertas ni varias claves por pregunta.</p></details>
      <Button type="button" variant="outline" disabled={busy || (!grid && !pasted.trim())} onClick={() => setAnalyzed(true)}>{busy ? <RefreshCw className="animate-spin"/> : <Layers3/>} Analizar bloque</Button>
      {analysis && <section aria-live="polite" className="space-y-3 rounded-2xl border p-4">
        <p className="font-semibold">{analysis.questions.length} listas para guardar · {analysis.duplicates} repetidas omitidas · {analysis.invalid} con errores</p><div className="flex flex-wrap gap-2">{QUESTION_FORMATS.filter(format=>analysis.questions.some(question=>question.format===format)).map(format=><span key={format} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{format}: {analysis.questions.filter(question=>question.format===format).length}</span>)}</div>
        {[...analysis.contextErrors, ...analysis.errors].map((error, i) => <p key={i} className="text-sm text-red-700">{error}</p>)}
        {analysis.questions.some(question => !question.shuffleOptions) && <p className="text-sm text-amber-800">{analysis.questions.filter(question => !question.shuffleOptions).length} pregunta(s) conservarán el orden de alternativas para respetar sus referencias o tu indicación.</p>}
        <div className="max-h-72 space-y-2 overflow-y-auto">{analysis.rows.map(row => <details key={row.row} className="rounded-xl border p-3"><summary className={`cursor-pointer text-sm ${row.errors.length ? "text-red-700" : row.duplicate ? "text-amber-800" : ""}`}><strong>Fila {row.row}</strong> · {row.errors.length ? row.errors.join(" ") : row.duplicate ? "Ya existe en esta materia y periodo; se omite." : `${row.question?.format} · ${row.question?.prompt.slice(0, 100)}`}</summary>{row.question && <div className="mt-3 space-y-2 text-sm">{row.question.caseContext && <p className="whitespace-pre-line rounded-lg bg-amber-50 p-2">{row.question.caseContext}</p>}<p className="whitespace-pre-line font-semibold">{row.question.prompt}</p>{row.question.options.map((option, i) => <p key={i} className={`whitespace-pre-line rounded-lg p-2 ${i === row.question?.correctIndex ? "bg-emerald-50 text-emerald-900" : "bg-slate-50"}`}>{String.fromCharCode(65 + i)}. {option}</p>)}<p className="whitespace-pre-line">Explicación: {row.question.explanation}</p><p>Fuente: {row.question.source}</p></div>}</details>)}</div>
      </section>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cerrar</Button><Button className="bg-[#003f32]" disabled={!ready || busy} onClick={async () => {
        if (!ready || !analysis) return;
        setBusy(true);
        try { if (await mutate({ action: "import_question_block", context, questions: analysis.questions }, "Bloque guardado. Revisa y aprueba todas juntas o una por una.")) { setPasted(""); setGrid(null); setFileName(""); setAnalyzed(false); setOpen(false); onImported?.({ subject: currentSubject, topic, topicId }); } }
        finally { setBusy(false); }
      }}>{busy ? <RefreshCw className="animate-spin"/> : <UploadCloud/>} Guardar {analysis?.questions.length || ""} preguntas pendientes</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function QuestionBlockReview({ block, questions, mutate, onView }: { block: RecordItem; questions: RecordItem[]; mutate: Props["mutate"]; onView: () => void }) {
  const [reviewedRevision, setReviewedRevision] = useState(""), [busy, setBusy] = useState(false);
  const review = questionBlockReviewState(block, questions), reviewed = reviewedRevision === review.revision;
  return <article className="min-w-0 space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><h3 className="break-words font-bold">{block.title}</h3><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${review.approved === review.total && review.total ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{review.approved === review.total && review.total ? "Aprobado" : "Por revisar"}</span></div>
    <p className="text-sm text-slate-500">{String(block.data.subject)} · {String(block.data.topic)}</p>
    <p className="text-sm"><strong>{review.total}</strong> preguntas · {review.approved} aprobadas · {review.pending} pendientes</p>
    <p className="text-xs text-slate-500">{[...new Set(questions.map(row => String(row.data.format)))].join(" · ")}</p>
    <Button variant="outline" className="min-h-11 w-full whitespace-normal" disabled={busy} onClick={onView}>Ver y revisar una por una</Button>
    {review.approved === review.total && review.total > 0 ? <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="size-4 shrink-0"/> Todas aprobadas para práctica y simuladores.</p> : <>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={reviewed} disabled={busy || review.blocked} onChange={event => setReviewedRevision(event.target.checked ? review.revision : "")}/><span>Revisé las respuestas, explicaciones y fuentes de este bloque.</span></label>
      {review.blocked && <p className="text-sm text-amber-800">Resuelve las preguntas para reformular o archivadas antes de aprobar todas. Un bloque vacío no se puede aprobar.</p>}
      <Button className="min-h-11 w-full whitespace-normal bg-[#003f32]" disabled={!reviewed || busy || review.blocked || !review.pending} onClick={async () => { setBusy(true); try { if (await mutate({ action: "approve_question_block", id: block.id, reviewed: true }, "Todas las preguntas del bloque quedaron aprobadas.")) setReviewedRevision(""); } finally { setBusy(false); } }}>{busy ? <RefreshCw className="animate-spin"/> : <CheckCheck/>} Aprobar todas ({review.pending})</Button>
      <p className="text-xs leading-5 text-slate-500">Aprueba las pendientes de este bloque, de cualquier formato. También puedes usar Aprobar en cada pregunta.</p>
    </>}
  </article>;
}

export function QuestionEditDialog({ row, mutate }: { row: RecordItem; mutate: Props["mutate"] }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(""), [options, setOptions] = useState<string[]>(["", "", "", ""]), [correctIndex, setCorrectIndex] = useState(0);
  const [format, setFormat] = useState<QuestionFormat>("Selección directa"), [caseContext, setCaseContext] = useState(""), [source, setSource] = useState(""), [explanation, setExplanation] = useState(""), [shuffleOptions, setShuffleOptions] = useState(true);
  const begin = () => {
    setPrompt(String(row.data.prompt || "")); setOptions(Array.isArray(row.data.options) ? row.data.options.map(String) : ["", "", "", ""]);
    setCorrectIndex(Number(row.data.correctIndex || 0)); setFormat((row.data.format || "Selección directa") as QuestionFormat);
    setCaseContext(String(row.data.caseContext || "")); setSource(String(row.data.source || "")); setExplanation(String(row.data.explanation || "")); setShuffleOptions(row.data.shuffleOptions !== false); setOpen(true);
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <Button size="sm" variant="outline" disabled={row.status === "archived"} onClick={begin}>Editar</Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Editar pregunta</DialogTitle><DialogDescription>{String(row.data.subject)} · {String(row.data.topic)} · {String(row.data.period)}. Al guardar vuelve a pendiente de revisión. Los intentos finalizados conservan su cuestionario original.</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm font-semibold">Formato<select className={selectClass} value={format} disabled={busy} onChange={event => setFormat(event.target.value as QuestionFormat)}>{QUESTION_FORMATS.map(item => <option key={item}>{item}</option>)}</select></label>
      {format === "Caso práctico" && <label className="space-y-2 text-sm font-semibold">Contexto del caso<Textarea value={caseContext} maxLength={4000} disabled={busy} onChange={event => setCaseContext(event.target.value)}/></label>}
      <label className="space-y-2 text-sm font-semibold">Enunciado y listas<Textarea value={prompt} maxLength={2000} disabled={busy} onChange={event => setPrompt(event.target.value)}/></label>
      <div className="grid gap-3 sm:grid-cols-2">{options.map((option, i) => <label key={i} className="space-y-2 text-sm font-semibold">Alternativa {String.fromCharCode(65 + i)}<Textarea value={option} maxLength={500} disabled={busy} onChange={event => setOptions(current => current.map((value, index) => index === i ? event.target.value : value))}/></label>)}</div>
      <label className="space-y-2 text-sm font-semibold">Correcta<select className={selectClass} value={correctIndex} disabled={busy} onChange={event => setCorrectIndex(Number(event.target.value))}>{options.map((_, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}</select></label>
      <label className="space-y-2 text-sm font-semibold">Explicación<Textarea value={explanation} maxLength={2000} disabled={busy} onChange={event => setExplanation(event.target.value)}/></label>
      <label className="space-y-2 text-sm font-semibold">Fuente, página o sección<Input value={source} maxLength={500} disabled={busy} onChange={event => setSource(event.target.value)}/></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={shuffleOptions} disabled={busy} onChange={event => setShuffleOptions(event.target.checked)}/><span>Permitir mezclar alternativas si no dependen de letras u orden.</span></label>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button className="bg-[#003f32]" disabled={busy} onClick={async () => { setBusy(true); try { if (await mutate({ action: "update_question", id: row.id, question: { prompt, options, correctIndex, format, caseContext, explanation, source, shuffleOptions } }, "Pregunta corregida y pendiente de revisión.")) setOpen(false); } finally { setBusy(false); } }}>{busy && <RefreshCw className="animate-spin"/>} Guardar corrección</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
