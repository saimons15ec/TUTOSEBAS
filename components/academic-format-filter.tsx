"use client";

import { QUESTION_FORMATS } from "@/lib/question-blocks";

export function AcademicFormatFilter({ value, onChange }: { value: string[]; onChange: (formats: string[]) => void }) {
  const selected = value.length ? value : [...QUESTION_FORMATS];
  return <fieldset className="space-y-2 rounded-xl border p-4"><legend className="px-1 text-sm font-bold">Formatos del sorteo</legend><p className="text-xs text-slate-600">Puedes combinar estructuras. La cantidad se sortea del conjunto elegido; no fija una cuota por formato.</p><div className="grid gap-2 sm:grid-cols-2">{QUESTION_FORMATS.map(format => <label key={format} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(format)} disabled={selected.length === 1 && selected.includes(format)} onChange={event => { const next = event.target.checked ? [...selected, format] : selected.filter(item => item !== format); onChange(next.length === QUESTION_FORMATS.length ? [] : next); }}/>{format}</label>)}</div></fieldset>;
}
