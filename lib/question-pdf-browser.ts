import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractQuestionPdf } from "./question-pdf.ts";

export async function readQuestionPdfFile(bytes: Uint8Array) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({ data: bytes, useWorkerFetch: false, useWasm: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: true, enableXfa: false });
  try { return await extractQuestionPdf(await task.promise); }
  catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("El PDF está protegido con contraseña. Guarda una copia sin contraseña.");
    throw error instanceof Error ? error : new Error("No se pudo leer el PDF. Usa la plantilla Word o Excel.");
  } finally { await task.destroy(); }
}
