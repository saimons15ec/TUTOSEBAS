"use client";
import { toast } from "sonner";
import { RESOURCE_MATERIAL_TYPES } from "@/lib/additional-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SupportUpload = (file: File, kind: string) => Promise<{ key: string; fileName: string } | null>;
export type SupportDraft = { materialType: string; fileKey: string | null; fileName: string | null; externalUrl: string; file: File | null };
export const supportDraft = (data: Record<string, unknown> = {}): SupportDraft => ({ materialType: String(data.materialType || "Documento"), fileKey: data.fileKey ? String(data.fileKey) : null, fileName: data.fileName ? String(data.fileName) : null, externalUrl: String(data.externalUrl || ""), file: null });
export async function resolveSupportDraft(draft: SupportDraft, upload: SupportUpload) {
  if (draft.materialType === "Video" && !/^https?:\/\//i.test(draft.externalUrl.trim())) { toast.error("Añade un enlace válido para el video."); return null; }
  if (draft.materialType === "Audio" && !draft.file && !draft.fileKey) { toast.error("Selecciona un archivo de audio."); return null; }
  if (!draft.file && !draft.fileKey && !draft.externalUrl.trim()) { toast.error("Selecciona un archivo o añade un enlace."); return null; }
  const stored = draft.file ? await upload(draft.file, "material") : null;
  if (draft.file && !stored) return null;
  return { materialType: draft.materialType, fileKey: stored?.key || draft.fileKey, fileName: stored?.fileName || draft.fileName, externalUrl: draft.externalUrl.trim() || null };
}
export function SupportContentInput({ value, onChange, disabled = false }: { value: SupportDraft; onChange: (value: SupportDraft) => void; disabled?: boolean }) {
  const audio = value.materialType === "Audio", video = value.materialType === "Video";
  return <div className="space-y-4"><label className="block space-y-2 text-sm font-semibold">Tipo de material<select disabled={disabled} className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm" value={value.materialType} onChange={event => onChange(supportDraft({ materialType: event.target.value }))}>{RESOURCE_MATERIAL_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>{!video && <div className="space-y-2"><label className="block space-y-2 text-sm font-semibold">{audio ? "Archivo de audio" : "Archivo del material"}<Input key={value.file?.name || value.fileKey || "empty"} disabled={disabled} type="file" accept={audio ? ".mp3,.m4a,.wav,.ogg" : ".pdf,.docx,.pptx,.png,.jpg,.jpeg"} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 25 * 1024 * 1024) { toast.error("El archivo supera 25 MB."); event.target.value = ""; return; } if (!(audio ? /\.(mp3|m4a|wav|ogg)$/i : /\.(pdf|docx|pptx|png|jpe?g)$/i).test(file.name)) { toast.error("Selecciona un archivo del tipo permitido."); event.target.value = ""; return; } onChange({ ...value, file, fileKey: null, fileName: null }); }}/></label>{(value.file || value.fileKey) && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><span className="break-all">{value.file?.name || value.fileName || "Archivo adjunto"}</span><Button disabled={disabled} size="sm" variant="ghost" onClick={() => onChange({ ...value, file: null, fileKey: null, fileName: null })}>Quitar adjunto de esta edición</Button></div>}<p className="text-xs text-slate-500">{audio ? "MP3, M4A, WAV u OGG" : "PDF, Word DOCX, PowerPoint PPTX o imagen PNG/JPG"} · Máximo 25 MB.</p></div>}{!audio && <label className="block space-y-2 text-sm font-semibold">{video ? "Enlace del video" : "Enlace de apoyo (alternativa al archivo)"}<Input type="url" maxLength={1000} disabled={disabled} value={value.externalUrl} onChange={event => onChange({ ...value, externalUrl: event.target.value })} placeholder="https://..."/></label>}</div>;
}
