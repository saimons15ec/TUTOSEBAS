"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BookOpenCheck, RotateCcw, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { drawTopicPractice, filterTopicPractice, topicPracticeFormats, type PracticeFilter } from "@/lib/academic-selection";
import { buildAcademicTopics, type AcademicScope, type AcademicTopic } from "@/lib/academic-topics";
import { practiceMetrics, type PracticeProgressRow } from "@/lib/practice-progress";

type QuestionRecord = { id: string; status: string; data: Record<string, unknown> };
const selectClass = "min-h-11 w-full rounded-xl border bg-white px-3 text-sm";
function randomOrder<T>(values: T[]) {
  const output = [...values];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}

export function TopicPractice<T extends QuestionRecord>({ rows, renderPractice, topics: suppliedTopics, scope: suppliedScope, topicValue, onTopicChange, progressRows = [], preview = false }: { rows: T[]; renderPractice: (questions: T[], drawId: number) => ReactNode; topics?: AcademicTopic[]; scope?: AcademicScope; topicValue?: string; onTopicChange?: (id: string) => void; progressRows?: PracticeProgressRow[]; preview?: boolean }) {
  const topics = useMemo(() => suppliedTopics || buildAcademicTopics([], rows.map(row => ({ ...row, kind: "question", title: "" })), { area: String(rows[0]?.data.area || "complexive") as AcademicScope["area"], subject: String(rows[0]?.data.subject || ""), period: String(rows[0]?.data.period || "") }), [suppliedTopics, rows]);
  const scope = suppliedScope || { area: String(rows[0]?.data.area || "complexive"), subject: String(rows[0]?.data.subject || ""), period: String(rows[0]?.data.period || "") };
  const makeFilter = (id: string, nextFormat: string): PracticeFilter => {
    const topic = topics.find(item => item.id === id);
    return { ...scope, topic: topic?.title || (id === "all" ? "" : "Tema no disponible"), topicId: topic && !topic.legacy ? topic.id : undefined, topicAliases: topic?.aliases, format: nextFormat };
  };
  const [topicId, setTopicId] = useState(topics[0]?.id || "all"), [format, setFormat] = useState(""), [count, setCount] = useState(() => String(Math.min(5, Math.max(1, filterTopicPractice(rows, makeFilter(topicValue ?? topics[0]?.id ?? "all", "")).length)))), [draw, setDraw] = useState<T[] | null>(null), [drawId, setDrawId] = useState(0);
  const selectedId = topicValue ?? topicId;
  const formats = topicPracticeFormats(rows, makeFilter(selectedId, "")), loadedFormats = formats.filter(item => item.count > 0);
  const selectedFormat = loadedFormats.some(item => item.format === format) ? format : loadedFormats.length === 1 ? loadedFormats[0].format : "";
  const filter = makeFilter(selectedId, selectedFormat), available = filterTopicPractice(rows, filter).length;
  const metrics = practiceMetrics(preview ? [] : progressRows, scope as AcademicScope, topics.find(topic => topic.id === selectedId) || null, selectedFormat);
  const numericCount = Number(count), maximum = Math.min(100, available), validCount = Number.isInteger(numericCount) && numericCount >= 1 && numericCount <= maximum;
  const start = () => {
    try { const questions = drawTopicPractice(rows, filter, numericCount, randomOrder, draw?.map(row => row.id)); setDraw(questions); setDrawId(value => value + 1); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Revisa tema, formato y cantidad."); }
  };
  const resetFilters = (nextTopicId: string, nextFormat: string) => {
    const nextFormats = topicPracticeFormats(rows, makeFilter(nextTopicId, "")).filter(item => item.count > 0);
    const validFormat = nextFormats.some(item => item.format === nextFormat) ? nextFormat : nextFormats.length === 1 ? nextFormats[0].format : "";
    setTopicId(nextTopicId); onTopicChange?.(nextTopicId); setFormat(validFormat); setDraw(null);
    const amount = filterTopicPractice(rows, makeFilter(nextTopicId, validFormat)).length;
    setCount(String(Math.min(5, Math.max(1, amount))));
  };
  return <div className="space-y-5">
    <section className="space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-5">
      <div><h3 className="font-bold">Practicar por tema</h3><p className="mt-1 text-sm text-slate-600">Elige tema, formato y cantidad. Practicas con las preguntas aprobadas de esa selección y recibes una explicación después de responder.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold">Tema<select className={selectClass} value={selectedId} onChange={event => resetFilters(event.target.value, selectedFormat)}><option value="all">Todos los temas</option>{topics.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold">Formato disponible<select className={selectClass} value={selectedFormat} disabled={!loadedFormats.length} onChange={event => resetFilters(selectedId, event.target.value)}><option value="" disabled={loadedFormats.length === 1}>{loadedFormats.length ? `Todos los formatos disponibles (${formats.reduce((sum, item) => sum + item.count, 0)})` : "Sin preguntas aprobadas"}</option>{formats.map(item => <option key={item.format} value={item.format} disabled={!item.count}>{item.format} ({item.count}){!item.count ? " · No disponible" : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold">Cantidad<Input type="number" min={1} max={Math.max(1, Math.min(100, available))} value={count} onChange={event => { setCount(event.target.value); setDraw(null); }}/></label>
      </div>
      <p className="text-xs text-slate-500">Solo puedes elegir formatos con preguntas aprobadas en el tema seleccionado. Los demás aparecen deshabilitados.</p>
      <div className="flex flex-wrap items-center gap-3"><p aria-live="polite" className="text-sm text-slate-600">{available} pregunta(s) disponibles · Puedes practicar hasta {maximum}.</p><Button className="min-h-11 bg-[#003f32]" disabled={!validCount} onClick={start}>{draw ? <RotateCcw/> : <BookOpenCheck/>} {draw ? "Volver a practicar" : "Practicar"}</Button>{draw && <Button variant="outline" onClick={() => setDraw(null)}><ChevronLeft/> Cambiar selección</Button>}</div>
      {available > 0 && !validCount && <p className="text-sm text-amber-800">Elige una cantidad entera entre 1 y {maximum}; esta selección tiene {available} preguntas.</p>}
      {!available && <p className="text-sm text-amber-800">No hay preguntas aprobadas de ese tema y formato. Elige otra combinación o incorpora un bloque.</p>}
    </section>
    <section aria-label="Tu progreso de práctica" className="space-y-3 rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-bold">Tu progreso de práctica</h3>{preview ? <p className="text-sm text-slate-600">La vista previa del profesor no guarda avance.</p> : <><p className="text-sm text-slate-600">{selectedId === "all" ? "Todos los temas" : topics.find(topic => topic.id === selectedId)?.title} · {selectedFormat || "Todos los formatos"} · {scope.period}</p><dl className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">Prácticas completadas</dt><dd className="mt-1 text-2xl font-bold">{metrics.completed}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">Preguntas respondidas</dt><dd className="mt-1 text-2xl font-bold">{metrics.answered}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">Aciertos</dt><dd className="mt-1 text-2xl font-bold">{metrics.accuracy === null ? "Sin respuestas" : `${metrics.accuracy}%`}</dd></div></dl><p aria-live="polite" className="text-xs text-slate-500">{metrics.started} práctica(s) iniciada(s) · {metrics.correct} respuesta(s) correcta(s). Se guarda al comprobar cada respuesta. Repetir crea una nueva práctica; este avance no cambia la nota de simuladores o exámenes.</p></>}</section>
    {draw && renderPractice(draw, drawId)}
  </div>;
}
