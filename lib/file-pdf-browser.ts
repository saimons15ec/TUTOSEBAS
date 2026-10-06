import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function loadFilePdf(bytes: Uint8Array) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  return getDocument({ data: bytes, useWorkerFetch: false, useWasm: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: true, enableXfa: false });
}
