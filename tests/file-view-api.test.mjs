import assert from 'node:assert/strict';
import test from 'node:test';
import { FILE_GET, FILE_POST, TestDatabase, state, signIn } from './helpers/platform-api.mjs';
import { fileDisposition, fileViewKind, singleFileRange } from '../lib/file-view.ts';

const origin = 'https://viewer.test', period = '2026-2027';
function fixture() {
  const db = new TestDatabase(), files = new Map(), reads = [];
  state.env.DB = db;
  state.env.BUCKET = {
    async put(key, buffer, metadata) { files.set(key, { bytes: new Uint8Array(buffer).slice(), ...metadata }); },
    async head(key) { reads.push(['head', key]); const file = files.get(key); return file ? { size: file.bytes.length, httpEtag: '"viewer-test"' } : null; },
    async get(key, options) { reads.push(['get', key, options]); const file = files.get(key); if (!file) return null; const range = options?.range; return { body: range ? file.bytes.slice(range.offset, range.offset + range.length) : file.bytes, size: file.bytes.length, httpEtag: '"viewer-test"', writeHttpMetadata(headers) { headers.set('content-type', 'text/html'); headers.set('content-disposition', 'inline'); } }; },
    async delete(key) { files.delete(key); },
  };
  for (const who of ['teacher', 'student', 'other']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id) VALUES(?,?,?,?,?,?,?)').run(who, `auth-${who}`, `${who === 'teacher' ? 'profesor' : who}@example.test`, who, who === 'teacher' ? 'admin' : 'student', 'active', who === 'teacher' ? null : who === 'other' ? 'other-group' : 'group');
  db.add('period-current', 'period', period, 'published', { current: true }); db.add('sim-ef-pilot', 'simulator', 'Sentinel', 'archived', {});
  db.add('group', 'group', 'Grupo', 'active', { plan: 'Gold', planStatus: 'active', endsAt: new Date(Date.now() + 86400000).toISOString() }); signIn();
  return { db, files, reads };
}
async function upload(name, bytes) {
  const response = await FILE_POST(new Request(`${origin}/api/files?kind=material&fileName=${encodeURIComponent(name)}`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' }, body: bytes })), result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
async function read(key, view, status = 200, headers = {}) { const response = await FILE_GET(new Request(`${origin}/api/files?key=${encodeURIComponent(key)}${view ? `&view=${view}` : ''}`, { headers })); assert.equal(response.status, status, status === response.status ? '' : await response.clone().text()); return response; }

test('private viewer serves verified PDF/image/audio MIME and an explicit download disposition', async () => {
  const f = fixture(); try {
    for (const [name, bytes, type, mode] of [['guía.pdf', new TextEncoder().encode('%PDF-1.4\n%%EOF'), 'application/pdf', 'pdf'], ['imagen.png', new Uint8Array([137,80,78,71,13,10,26,10,1]), 'image/png', 'image'], ['voz.mp3', new TextEncoder().encode('ID3audio'), 'audio/mpeg', 'audio']]) {
      const file = await upload(name, bytes); f.db.add(`material-${mode}`, 'resource', name, 'published', { area: 'complexive', subject: 'Ciencias', plan: 'Bronce', fileKey: file.key, period });
      signIn('student'); const metadata = await (await read(file.key, 'metadata')).json(); assert.equal(metadata.kind, mode); assert.equal(metadata.contentType, type); assert.equal(metadata.size, bytes.length);
      for (const view of [undefined, 'inline']) { const response = await read(file.key, view); assert.equal(response.headers.get('content-type'), type); assert.match(response.headers.get('content-disposition'), new RegExp(`^${view ? 'inline' : 'attachment'};`)); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes); }
      signIn();
    }
  } finally { f.db.sql.close(); }
});
test('audio ranges support seek, suffix, open end, clipped end and If-Range without widening access', async () => {
  const f = fixture(); try {
    const bytes = new TextEncoder().encode('ID3abcdefghijklmnopqrstuvwxyz'), file = await upload('voz.mp3', bytes); f.db.add('audio', 'resource', 'Audio', 'published', { area: 'complexive', subject: 'Ciencias', plan: 'Bronce', fileKey: file.key, period }); signIn('student');
    for (const [range, start, end] of [['bytes=3-8', 3, 8], ['bytes=4-', 4, bytes.length - 1], ['bytes=-4', bytes.length - 4, bytes.length - 1], ['bytes=20-99', 20, bytes.length - 1]]) {
      const response = await read(file.key, 'inline', 206, { range }); assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`); assert.equal(Number(response.headers.get('content-length')), end - start + 1); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
    }
    for (const range of ['bytes=999-', 'bytes=5-2', 'bytes=-0', 'bytes=0-2,6-8', 'bytes=abc', 'bytes=9007199254740992-', 'items=0-1']) { const response = await read(file.key, 'inline', 416, { range }); assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`); }
    await read(file.key, 'inline', 206, { range: 'bytes=0-2', 'if-range': '"viewer-test"' }); assert.deepEqual(new Uint8Array(await (await read(file.key, 'inline', 200, { range: 'bytes=0-2', 'if-range': '"old"' })).arrayBuffer()), bytes);
  } finally { f.db.sql.close(); }
});
test('inline and metadata recheck session, status, publication, period, plan, parent course and inventory before storage access', async () => {
  const f = fixture(); try {
    const file = await upload('guia.pdf', new TextEncoder().encode('%PDF-1.4\n%%EOF')), data = { area: 'complexive', subject: 'Ciencias', plan: 'Gold', fileKey: file.key, period };
    f.db.add('material', 'resource', 'Guía', 'published', data); signIn('student'); await read(file.key, 'inline');
    for (const change of ["UPDATE profiles SET status='suspended' WHERE id='student'", "UPDATE records SET status='draft' WHERE id='material'", "UPDATE records SET data_json=json_set(data_json,'$.period','2025-2026') WHERE id='material'", "UPDATE records SET data_json=json_set(data_json,'$.plan','Bronce') WHERE id='group'", "UPDATE profiles SET group_id='other-group' WHERE id='student'", "UPDATE file_objects SET status='quarantined'"]) {
      f.db.sql.exec(change); const before = f.reads.length; await read(file.key, 'metadata', 403); await read(file.key, 'inline', 403, { range: 'bytes=0-2' }); assert.equal(f.reads.length, before);
      f.db.sql.exec("UPDATE profiles SET status='active',group_id='group' WHERE id='student'; UPDATE file_objects SET status='active'; UPDATE records SET status='published' WHERE id='material'"); f.db.sql.prepare("UPDATE records SET data_json=? WHERE id='material'").run(JSON.stringify(data)); f.db.sql.exec("UPDATE records SET data_json=json_set(data_json,'$.plan','Gold') WHERE id='group'");
    }
    state.headers = new Headers(); await read(file.key, 'metadata', 401); signIn('student');
    f.db.sql.exec("UPDATE records SET status='archived' WHERE id='material'"); f.db.add('course', 'course', 'Curso', 'draft', { plan: 'Gold', period }); f.db.add('lesson', 'course_lesson', 'Lección', 'published', { courseId: 'course', period, fileKey: file.key }); await read(file.key, 'metadata', 403);
    f.db.sql.exec("UPDATE records SET status='published' WHERE id='course'"); await read(file.key, 'metadata'); f.files.delete(file.key); await read(file.key, 'metadata', 404);
  } finally { f.db.sql.close(); }
});
test('viewer headers cannot inject a filename and unsupported types never become active inline content', () => {
  assert.equal(fileViewKind('text/html'), null); assert.equal(fileViewKind('image/svg+xml'), null); assert.equal(fileViewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), null);
  const header = fileDisposition('Áudio"\r\nInjected: evil.pdf', true); assert.equal(/[\r\n]/.test(header), false); assert.match(header, /filename\*=UTF-8''%C3%81udio/); assert.equal(singleFileRange(null, 12), null); assert.equal(singleFileRange('bytes=0-', 0), 'invalid');
});
