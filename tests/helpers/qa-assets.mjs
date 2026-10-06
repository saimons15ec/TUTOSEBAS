import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

const require = createRequire(import.meta.url);
// Node needs PDF.js's legacy DOM compatibility layer and a file worker URL.
// Parsing, validation and the worker remain the same installed PDF.js version.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'pdfjs-dist') return nextResolve('pdfjs-dist/legacy/build/pdf.mjs', context);
    if (specifier === 'pdfjs-dist/build/pdf.worker.min.mjs?url') return {
      url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'))}`)}`,
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
export const assetRoot = fileURLToPath(new URL('../fixtures/qa-round2/', import.meta.url));
export const manifest = JSON.parse(readFileSync(`${assetRoot}manifest.json`, 'utf8'));
export const bytes = name => new Uint8Array(readFileSync(`${assetRoot}${name}`));
export const { readQuestionBlockFile } = await import('../../lib/question-block-file.ts');
const { questionTextInputs } = await import('../../lib/question-document.ts');
const { tableQuestionInputs, previewQuestionBlock } = await import('../../lib/question-blocks.ts');
const parser = new DOMParser();
export const contextFor = (block, area = 'complexive') => ({ area, subject: block.subject, topic: block.topic, period: manifest.period, title: `QA · ${block.id}`, format: 'Selección directa', plan: 'Bronce', source: '', sourceResourceId: '', requireExplicitFormat: true });
export async function readBlock(block, extension = 'docx', area = 'complexive') {
  const file = new File([bytes(`${block.id}.${extension}`)], `${block.id}.${extension}`);
  const extracted = await readQuestionBlockFile(file, parser);
  const inputs = extracted.grid ? tableQuestionInputs(extracted.grid) : questionTextInputs(extracted.text || '');
  const preview = previewQuestionBlock(inputs, contextFor(block, area));
  assert.equal(preview.invalid, 0, JSON.stringify(preview.rows.filter(row => row.errors.length)));
  assert.deepEqual(preview.errors, []); assert.equal(preview.questions.length, 20);
  return preview.questions;
}
