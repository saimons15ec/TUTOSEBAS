"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUESTION_FORMATS } from "@/lib/question-blocks";
import { type FormatCoverage } from "@/lib/academic-format-distribution";

export function AcademicFormatDistribution({ mode, onModeChange, formats, total, counts, onCountsChange }: { mode: FormatCoverage; onModeChange: (mode: FormatCoverage) => void; formats: string[]; total: number; counts: Record<string, string>; onCountsChange: (counts: Record<string, string>) => void }) {
  const choices: readonly string[] = formats.length ? QUESTION_FORMATS.filter(format => formats.includes(format)) : QUESTION_FORMATS;
  const assigned = choices.reduce<number>((sum, format) => sum + Number(counts[format] || 0), 0);
  return <section className="space-y-3 rounded-2xl border bg-slate-50 p-4">
    <label className="space-y-2 text-sm font-semibold">Reparto por formato<select aria-label="Reparto por formato" className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm" value={mode} onChange={event => onModeChange(event.target.value as FormatCoverage)}><option value="varied">Variedad y reparto según el banco</option><option value="quota">Cantidades exactas por formato</option><option value="pool">Sortear del conjunto permitido</option></select></label>
    {mode === "varied" && <p className="text-sm text-slate-600">Incluye al menos una pregunta de cada formato elegido y reparte el resto según el banco. Con Todos los formatos se usan los que tienen preguntas aprobadas compatibles. Se respetan las cantidades por materia, tema o bloque.</p>}
    {mode === "pool" && <p className="text-sm text-slate-600">El tipo de pregunta se sortea dentro de los formatos permitidos.</p>}
    {mode === "quota" && <><p className="text-sm text-slate-600">Las cantidades deben sumar {total} preguntas. Usa 0 para excluir un formato de este examen.</p><div className="grid gap-3 sm:grid-cols-2">{choices.map(format => <label key={format} className="space-y-2 text-sm font-semibold">{format}<Input type="number" min={0} max={200} value={counts[format] || "0"} onChange={event => onCountsChange({ ...counts, [format]: event.target.value })}/></label>)}</div><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={!Number.isInteger(total) || total < 1 || total > 200} onClick={() => onCountsChange(Object.fromEntries(choices.map((format, index) => [format, String(Math.floor(total / choices.length) + (index < total % choices.length ? 1 : 0))])))}>Repartir el total</Button><p aria-live="polite" className={`text-sm font-semibold ${assigned === total ? "text-emerald-800" : "text-amber-800"}`}>{assigned} de {total} asignadas</p></div></>}
  </section>;
}
