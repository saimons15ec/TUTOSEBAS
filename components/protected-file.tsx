"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Download, FileText, ImageIcon, Music, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { suggestedFileView, type FileViewKind } from "@/lib/file-view";

function PdfPage({ document, page }: { document: PDFDocumentProxy; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null), [width, setWidth] = useState(600), [status, setStatus] = useState("Cargando página…");
  useEffect(() => { const element = box.current; if (!element) return; const observer = new ResizeObserver(entries => setWidth(Math.max(100, Math.floor(entries[0].contentRect.width)))); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let cancelled = false, render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    const current = canvas.current;
    void (async () => {
      try {
        const pdfPage = await document.getPage(page); if (cancelled || !current) return;
        const native = pdfPage.getViewport({ scale: 1 }), scale = Math.min(width / native.width, 2), density = Math.min(window.devicePixelRatio || 1, 2), viewport = pdfPage.getViewport({ scale: scale * density });
        if (viewport.width * viewport.height > 12_000_000) throw new Error("La página es demasiado grande para el visor. Usa la descarga.");
        current.width = Math.ceil(viewport.width); current.height = Math.ceil(viewport.height); current.style.width = `${viewport.width / density}px`; current.style.height = `${viewport.height / density}px`;
        const canvasContext = current.getContext("2d"); if (!canvasContext) throw new Error("Tu navegador no permite mostrar esta página. Usa la descarga.");
        render = pdfPage.render({ canvas: current, canvasContext, viewport }); await render.promise; if (!cancelled) setStatus("");
      } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : "No se pudo mostrar esta página. Usa la descarga."); }
    })();
    return () => { cancelled = true; render?.cancel(); };
  }, [document, page, width]);
  return <div ref={box} className="min-w-0"><p aria-live="polite" className="text-sm text-slate-600">{status}</p><canvas key={`${page}:${width}`} ref={canvas} role="img" aria-label={`Página ${page} del documento PDF`} className="mx-auto max-w-full rounded border bg-white"/></div>;
}
function PdfViewer({ fileKey }: { fileKey: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null), [page, setPage] = useState(1), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false, task: ReturnType<typeof import("@/lib/file-pdf-browser")["loadFilePdf"]> | undefined;
    void (async () => { try {
      const response = await fetch(`/api/files?key=${encodeURIComponent(fileKey)}&view=inline`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) { const issue = await response.json() as { error?: string }; throw new Error(issue.error || "No se pudo abrir el documento."); }
      if (response.headers.get("content-type") !== "application/pdf") throw new Error("El archivo no es un PDF.");
      const bytes = new Uint8Array(await response.arrayBuffer()), { loadFilePdf } = await import("@/lib/file-pdf-browser"); if (cancelled) return;
      task = loadFilePdf(bytes); const loaded = await task.promise;
      if (loaded.numPages > 500) throw new Error("Este documento supera las 500 páginas del visor. Usa la descarga.");
      if (!cancelled) setDocument(loaded);
    } catch (error) { if (!cancelled) setError(error instanceof Error && error.name === "PasswordException" ? "El PDF requiere una contraseña. Descárgalo para abrirlo." : error instanceof Error ? error.message : "No se pudo abrir el PDF. Usa la descarga."); if (task) await task.destroy(); } })();
    return () => { cancelled = true; controller.abort(); if (task) void task.destroy(); };
  }, [fileKey]);
  if (error) return <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>;
  if (!document) return <p role="status" className="flex items-center gap-2 text-sm"><RefreshCw className="size-4 animate-spin"/> Cargando documento…</p>;
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-center gap-3"><Button variant="outline" size="sm" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft/></Button><span aria-live="polite" className="text-sm">Página {page} de {document.numPages}</span><Button variant="outline" size="sm" aria-label="Página siguiente" disabled={page === document.numPages} onClick={() => setPage(page + 1)}><ChevronRight/></Button></div><PdfPage key={page} document={document} page={page}/><p className="text-xs text-slate-500">Para buscar texto o usar el lector de pantalla, descarga el PDF y ábrelo con tu lector habitual.</p></div>;
}
function FileViewer({ fileKey, name }: { fileKey: string; name: string }) {
  const [kind, setKind] = useState<FileViewKind | null>(null), [error, setError] = useState("");
  const url = `/api/files?key=${encodeURIComponent(fileKey)}&view=inline`;
  useEffect(() => { const controller = new AbortController(); void (async () => { try {
    const response = await fetch(`/api/files?key=${encodeURIComponent(fileKey)}&view=metadata`, { signal: controller.signal, cache: "no-store" }), result = await response.json() as { kind: FileViewKind; error?: string };
    if (!response.ok) throw new Error(result.error || "No se pudo abrir el archivo.");
    if (!["pdf", "image", "audio"].includes(result.kind)) throw new Error("Este formato requiere descarga.");
    setKind(result.kind);
  } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No se pudo abrir el archivo."); } })(); return () => controller.abort(); }, [fileKey]);
  if (error) return <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>;
  if (!kind) return <p role="status" className="text-sm">Comprobando acceso al archivo…</p>;
  if (kind === "pdf") return <PdfViewer fileKey={fileKey}/>;
  if (kind === "audio") return <div className="space-y-3"><audio src={url} controls preload="metadata" aria-label={name} className="w-full" onError={() => setError("No se pudo reproducir el audio. Puedes descargarlo para escucharlo.")}/><p className="text-sm text-slate-600">Usa los controles para escuchar o avanzar en el audio.</p></div>;
  // Private same-origin images must bypass public image optimization and caching.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className="mx-auto max-h-[65dvh] max-w-full rounded-xl object-contain" onError={() => setError("No se pudo mostrar la imagen. Puedes descargarla.")}/>;
}
export function ProtectedFile({ fileKey, name }: { fileKey: string; name: string }) {
  const [open, setOpen] = useState(false), suggestion = suggestedFileView(name || fileKey), label = suggestion === "audio" ? "Escuchar audio" : suggestion === "image" ? "Ver imagen" : "Ver PDF", Icon = suggestion === "audio" ? Music : suggestion === "image" ? ImageIcon : FileText;
  const download = <Button variant="outline" size="sm" asChild><a href={`/api/files?key=${encodeURIComponent(fileKey)}`}><Download/> Descargar</a></Button>;
  return <>{suggestion && <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm"><Icon/> {label}</Button></DialogTrigger><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{name || "Archivo del material"}</DialogTitle><DialogDescription>Consulta el material o guarda una copia para estudiar.</DialogDescription></DialogHeader>{open && <FileViewer key={fileKey} fileKey={fileKey} name={name}/>}<div className="flex justify-end">{download}</div></DialogContent></Dialog>}{download}</>;
}
