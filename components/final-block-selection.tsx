"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { MAX_FINAL_BLOCKS, MAX_FINAL_BLOCK_QUESTIONS, type FinalBlockEntry } from "@/lib/final-exam-blocks";

type RecordItem = { id: string; title: string; status: string; data: Record<string, unknown> };
export function FinalBlockSelection({ blocks, questions, value, onChange, formats = [] }: { blocks: RecordItem[]; questions: RecordItem[]; value: FinalBlockEntry[]; onChange: (entries: FinalBlockEntry[]) => void; formats?: string[] }) {
  const [search, setSearch] = useState("");
  const shown = blocks.filter(block => `${block.title} ${block.data.subject || ""} ${block.data.topic || ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const missing = value.filter(entry => !blocks.some(block => block.id === entry.blockId));
  const total = value.reduce((sum, item) => sum + item.count, 0);
  return <fieldset className="space-y-3">
    <legend className="text-sm font-bold">Bloques del examen final</legend>
    <p className="text-sm text-slate-600">Elige hasta {MAX_FINAL_BLOCKS} bloques de esta área y periodo. Cada uno aporta de 1 a 100 preguntas aprobadas; máximo {MAX_FINAL_BLOCK_QUESTIONS} en total.</p>
    <Input aria-label="Buscar bloque por materia o tema" placeholder="Buscar bloque, materia o tema" value={search} onChange={event => setSearch(event.target.value)}/>
    <div className="max-h-80 space-y-3 overflow-y-auto">{shown.map(block => {
      const entry = value.find(item => item.blockId === block.id), available = questions.filter(question => question.status === "approved" && question.data.importBlockId === block.id && question.data.subject === block.data.subject && (!formats.length || formats.includes(String(question.data.format)))).length;
      return <div key={block.id} className={`space-y-3 rounded-xl border p-3 ${entry ? "border-amber-500 bg-amber-50" : "bg-white"}`}>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1 size-4" type="checkbox" checked={Boolean(entry)} disabled={!entry && (!available || value.length >= MAX_FINAL_BLOCKS)} onChange={event => onChange(event.target.checked ? [...value, { blockId: block.id, subject: String(block.data.subject || ""), blockTitle: block.title, count: Math.min(5, available) }] : value.filter(item => item.blockId !== block.id))}/><span><strong>{block.title}</strong><span className="block text-xs text-slate-600">{String(block.data.subject || "")} · {String(block.data.topic || "")} · {available} aprobadas</span></span></label>
        {entry && <label className="flex items-center gap-3 text-sm">Cantidad<Input className="max-w-28" aria-label={`Cantidad del bloque ${block.title}`} type="number" min={1} max={Math.min(100, available)} value={Number.isNaN(entry.count) ? "" : entry.count} onChange={event => onChange(value.map(item => item.blockId === block.id ? { ...item, count: event.target.value === "" ? Number.NaN : Number(event.target.value) } : item))}/>{entry.count > available && <span className="text-amber-800">Faltan preguntas aprobadas.</span>}</label>}
      </div>;
    })}</div>
    {missing.map(entry => <label key={entry.blockId} className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><input type="checkbox" checked onChange={() => onChange(value.filter(item => item.blockId !== entry.blockId))}/>{entry.blockTitle || entry.blockId} ya no está disponible. Desmárcalo.</label>)}
    {!blocks.length && <p className="text-sm text-slate-600">Importa y aprueba un bloque para seleccionarlo aquí.</p>}
    <p aria-live="polite" className={`rounded-xl p-3 text-sm ${total > MAX_FINAL_BLOCK_QUESTIONS ? "bg-red-50 text-red-800" : "bg-slate-50"}`}><strong>Total:</strong> {Number.isFinite(total) ? total : "Revisa las cantidades"} preguntas · {value.length} bloques</p>
  </fieldset>;
}
