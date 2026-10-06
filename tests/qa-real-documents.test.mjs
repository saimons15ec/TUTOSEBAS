import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { manifest, bytes, readBlock, readQuestionBlockFile, contextFor } from './helpers/qa-assets.mjs';
import { questionTextInputs } from '../lib/question-document.ts';
import { previewQuestionBlock } from '../lib/question-blocks.ts';

const normalized = value => String(value).replace(/\s+/g, ' ').trim();
for (const extension of ['docx','pdf','xlsx','csv','txt']) test(`QA real ${extension}: all 80 questions preserve keys, text, five formats and multiline cases`, async () => {
  for (const block of manifest.blocks) {
    const questions = await readBlock(block, extension);
    for (let index = 0; index < questions.length; index++) {
      const actual = questions[index], expected = block.questions[index];
      for (const field of ['prompt','explanation','source','caseContext']) assert.equal(normalized(actual[field]), normalized(expected[field]), `${block.id} ${index+1} ${field}`);
      assert.deepEqual(actual.options.map(normalized), expected.options.map(normalized));
      assert.equal(actual.correctIndex, expected.correctIndex); assert.equal(actual.format, expected.format); assert.equal(actual.shuffleOptions, expected.shuffleOptions);
    }
  }
});
test('QA real files: checksums and valid formats match the reproducible manifest', () => {
  for (const file of manifest.files) { const content = bytes(file.name); assert.equal(content.length, file.size); assert.equal(createHash('sha256').update(content).digest('hex'), file.sha256); }
  assert.equal(new TextDecoder().decode(bytes('audio-prueba.wav').slice(0,4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes('audio-prueba.wav').slice(8,12)), 'WAVE');
  assert.deepEqual([...bytes('infografia.png').slice(0,8)], [137,80,78,71,13,10,26,10]);
});
test('QA real invalid documents: fake PDF, damaged Word, scanned PDF, missing keys and oversized blocks fail clearly', async () => {
  for (const [name, pattern] of [['archivo-falso.pdf', /PDF válido/], ['word-danado.docx', /válido|incompleto/], ['escaneo-sin-texto.pdf', /OCR|texto legible/]]) await assert.rejects(readQuestionBlockFile(new File([bytes(name)], name)), pattern);
  await assert.rejects(readQuestionBlockFile(new File([new Uint8Array(2*1024*1024+1)], 'grande.docx')), /2 MB/);
  const result = await readQuestionBlockFile(new File([bytes('bloque-errores.csv')], 'bloque-errores.csv'));
  const preview = previewQuestionBlock(questionTextInputs(result.text), contextFor(manifest.blocks[3]));
  assert.ok(preview.invalid >= 2); assert.match(preview.rows.flatMap(row=>row.errors).join(' '), /correcta|Formato desconocido/);
});
