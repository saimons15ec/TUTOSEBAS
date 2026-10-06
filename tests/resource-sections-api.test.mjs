import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, GET, FILE_POST, FILE_GET, TestDatabase, state, signIn } from './helpers/platform-api.mjs';
import { resourceSections, resourceSectionRecordId, resourceCategory, filterAdditionalResources } from '../lib/additional-resources.ts';
import { courseLessons, courseProgress } from '../lib/courses.ts';

const period = '2026-2027', origin = 'https://sections.test';
class TestBucket {
  objects = new Map();
  async put(key, bytes, options) { this.objects.set(key, { bytes: new Uint8Array(bytes).slice(), ...options }); }
  async head(key) { return this.objects.get(key) || null; }
  async get(key) { const object = this.objects.get(key); return object && { body: object.bytes, size: object.bytes.length, customMetadata: object.customMetadata, arrayBuffer: async () => object.bytes.slice().buffer, httpEtag: '"test-object"', writeHttpMetadata(headers) { headers.set('content-type', object.httpMetadata.contentType); headers.set('content-disposition', object.httpMetadata.contentDisposition); } }; }
}
function fixture() {
  const db = new TestDatabase(), bucket = new TestBucket(); state.env.DB = db; state.env.BUCKET = bucket;
  for (const who of ['teacher', 'student', 'other']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id) VALUES(?,?,?,?,?,?,?)').run(who, `auth-${who}`, `${who === 'teacher' ? 'profesor' : who}@example.test`, who, who === 'teacher' ? 'admin' : 'student', 'active', who === 'teacher' ? null : 'group');
  db.add('period-current', 'period', period, 'published', { current: true }); db.add('sim-ef-pilot', 'simulator', 'Sentinel', 'archived', {});
  db.add('group', 'group', 'Grupo prueba', 'active', { plan: 'Gold', planStatus: 'active', endsAt: new Date(Date.now() + 86400000).toISOString(), permissions: [] }); signIn(); return { db, bucket };
}
async function post(body, expected = 200) {
  const response = await POST(new Request(`${origin}/api/platform`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(body) })), payload = await response.json();
  assert.equal(response.status, expected, JSON.stringify({ action: body.action, ...payload })); return payload;
}
async function catalog() { const response = await GET(); assert.equal(response.status, 200); return (await response.json()).records; }
function section(db, id) { return db.record(resourceSectionRecordId(period, id)); }
async function create(title = 'Evaluaciones', mode = 'materials', extra = {}, expected = 200) { return post({ action: 'save_resource_section', title, description: 'Contenido separado por sección', mode, ...extra }, expected); }
async function retire(db, id, targetSectionId = null, expected = 200) { return post({ action: 'archive_resource_section', sectionId: id, revision: section(db, id)?.data.revision || 'initial', targetSectionId }, expected); }
async function resource(category, extra = {}) { return (await post({ action: 'create_record', kind: 'resource', title: 'Guía de prueba', data: { area: 'resources', category, plan: 'Gold', materialType: 'Documento', externalUrl: 'https://example.edu/guia', ...extra } })).id; }
async function download(key, expected = 200) { const response = await FILE_GET(new Request(`${origin}/api/files?key=${encodeURIComponent(key)}`)); assert.equal(response.status, expected, await response.clone().text()); }
function beforeWrite(db, matches, callback) {
  const prepare = db.prepare.bind(db); let fired = false;
  db.prepare = query => { const statement = prepare(query), bind = statement.bind; statement.bind = (...values) => { const bound = bind(...values), run = bound.run; bound.run = async () => { if (!fired && matches(query, values)) { fired = true; callback(); } return run(); }; return bound; }; return statement; };
  return () => assert.equal(fired, true, 'The concurrent writer must run before the guarded statement');
}

test('default sections separate planning and curriculum without changing legacy records', async () => {
  const f = fixture(); try {
    f.db.add('legacy', 'resource', 'Currículo vigente', 'published', { area: 'resources', category: 'curriculum', plan: 'Bronce', externalUrl: 'https://example.edu' });
    const before = f.db.record('legacy'); signIn('student'); const rows = await catalog(), defaults = resourceSections(rows, period);
    assert.deepEqual(defaults.map(row => row.title), ['Planificaciones', 'Currículos', 'Cursos por lecciones', 'Normas APA', 'Biblioteca general']);
    assert.equal(resourceCategory(rows.find(row => row.id === 'legacy')), 'curriculum'); assert.deepEqual(f.db.record('legacy'), before);
    assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='resource_section'").get().n, 0, 'Reading must not seed sections');
  } finally { f.db.sql.close(); }
});

test('section creation, rename, ordering and search use stable IDs and the server period', async () => {
  const f = fixture(); try {
    const created = await create('  Evaluaciones  de  ciencias ', 'materials', { period: '1900', order: -99, status: 'archived', permissions: ['all'] });
    const cfg = section(f.db, created.sectionId); assert.equal(cfg.title, 'Evaluaciones de ciencias'); assert.equal(cfg.status, 'published'); assert.equal(cfg.data.period, period); assert.equal(cfg.data.order, 6); assert.equal(cfg.data.permissions, undefined);
    const id = await resource(created.sectionId); const before = f.db.record(id);
    await post({ action: 'save_resource_section', sectionId: created.sectionId, revision: cfg.data.revision, title: 'Banco de evaluaciones', mode: 'materials' });
    assert.equal(f.db.record(id).data.category, created.sectionId); assert.deepEqual(f.db.record(id), before);
    const rows = await catalog(), sections = resourceSections(rows, period); assert.equal(filterAdditionalResources([f.db.record(id)], 'banco de evaluaciones', '', [], sections).length, 1);
    await post({ action: 'move_resource_section', sectionId: created.sectionId, revision: section(f.db, created.sectionId).data.revision, direction: 'up' });
    const ordered = resourceSections(await catalog(), period); assert.equal(ordered[4].id, created.sectionId); assert.equal(ordered[5].id, 'other');
    await post({ action: 'move_resource_section', sectionId: 'other', revision: section(f.db, 'other').data.revision, direction: 'down' });
    await post({ action: 'save_resource_section', sectionId: created.sectionId, revision: cfg.data.revision, title: 'Stale' }, 409);
    signIn('student'); assert.deepEqual(resourceSections(await catalog(), period).map(row => row.id), ordered.map(row => row.id));
  } finally { f.db.sql.close(); }
});

test('empty, oversized and control-character section names are rejected', async () => {
  const f = fixture(); try {
    for (const title of ['', ' '.repeat(3), 'a'.repeat(81), 'bad\u0000name']) await create(title, 'materials', {}, 400);
  } finally { f.db.sql.close(); }
});

test('section validation and administration enforce active teacher access', async () => {
  const f = fixture(); try {
    await post({ action: 'save_resource_section', title: 'Planificaciones' }, 400);
    await create('Rúbricas'); await post({ action: 'save_resource_section', title: 'rubricas' }, 400);
    await post({ action: 'save_resource_section', title: 'Incorrecta', mode: 'invalid' }, 400);
    await post({ action: 'save_resource_section', title: 'Incorrecta', description: 'x'.repeat(601) }, 400);
    const cfg = section(f.db, 'planning'); await post({ action: 'save_resource_section', sectionId: 'planning', revision: cfg.data.revision, title: cfg.title, mode: 'courses' }, 400);
    await post({ action: 'create_record', kind: 'resource_section', title: 'Bypass', data: {} }, 400);
    await post({ action: 'update_status', id: cfg.id, status: 'archived' }, 400);
    await post({ action: 'move_resource_section', sectionId: 'planning', revision: cfg.data.revision, direction: 'sideways' }, 400);
    await post({ action: 'create_record', kind: 'resource', title: 'Unknown', data: { area: 'resources', category: `section_${crypto.randomUUID()}` } }, 409);
    await post({ action: 'create_record', kind: 'course', title: 'Wrong type', data: { category: 'apa' } }, 400);
    signIn('student');
    for (const action of ['save_resource_section', 'move_resource_section', 'archive_resource_section', 'restore_resource_section']) await post({ action, title: 'Unauthorized', sectionId: 'planning', revision: cfg.data.revision, direction: 'up' }, 403);
    assert.equal(section(f.db, 'planning').status, 'published');
  } finally { f.db.sql.close(); }
});

test('retirement moves published, draft, archived and academic references atomically without touching history or files', async () => {
  const f = fixture(); try {
    const source = await create('Infografías'), target = await create('Biblioteca de ciencias');
    const uploaded = await FILE_POST(new Request(`${origin}/api/files?kind=material&fileName=guia.pdf`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' }, body: '%PDF-1.4\nPrueba\n%%EOF' })); assert.equal(uploaded.status, 200); const file = await uploaded.json();
    const id = await resource(source.sectionId, { fileKey: file.key, fileName: file.fileName }); await post({ action: 'update_status', id, status: 'published' });
    const draft = await resource(source.sectionId), archived = await resource(source.sectionId); await post({ action: 'update_status', id: archived, status: 'archived' });
    f.db.add('academic', 'resource', 'Tema 1', 'published', { area: 'complexive', subject: 'Ciencias', topic: 'Tema 1', period, plan: 'Gold', externalUrl: 'https://example.edu/tema' });
    await post({ action: 'set_additional_reference', id: 'academic', category: source.sectionId });
    f.db.add('legacy-missing-period', 'resource', 'Legado', 'draft', { area: 'resources', category: source.sectionId, externalUrl: 'https://example.edu' });
    f.db.add('legacy-empty-period', 'resource', 'Legado sin periodo', 'archived', { area: 'resources', category: source.sectionId, period: '', externalUrl: 'https://example.edu' });
    f.db.add('history', 'resource', 'Periodo anterior', 'published', { area: 'resources', category: source.sectionId, period: '2025-2026', externalUrl: 'https://example.edu/history' });
    const originals = [id, draft, archived, 'academic', 'legacy-missing-period', 'legacy-empty-period', 'history'].map(row => f.db.record(row));
    await retire(f.db, source.sectionId, null, 400); assert.equal(section(f.db, source.sectionId).status, 'published');
    const moved = await retire(f.db, source.sectionId, target.sectionId); assert.equal(moved.moved, 6);
    for (const old of originals.slice(0, 6)) { const after = f.db.record(old.id), field = old.id === 'academic' ? 'additionalCategory' : 'category'; assert.equal(after.status, old.status); assert.deepEqual(after.data, { ...old.data, [field]: target.sectionId }); }
    assert.deepEqual(f.db.record('history'), originals[6]); assert.equal(f.bucket.objects.size, 1);
    signIn('student'); const visible = await catalog(); assert.equal(resourceSections(visible, period).some(row => row.id === source.sectionId), false); assert.ok(visible.some(row => row.id === id)); assert.equal(visible.some(row => row.id === draft || row.id === archived), false); await download(file.key);
    signIn(); await post({ action: 'restore_resource_section', sectionId: source.sectionId, revision: section(f.db, source.sectionId).data.revision });
    assert.equal(f.db.record(id).data.category, target.sectionId); assert.ok(resourceSections(await catalog(), period).some(row => row.id === source.sectionId));
    signIn('student'); f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.plan','Bronce') WHERE id='group'").run(); await download(file.key, 403); assert.equal((await catalog()).some(row => row.id === id), false);
  } finally { f.db.sql.close(); }
});

test('removed built-in sections stay hidden for students and reject all subsequent content writes', async () => {
  const f = fixture(); try {
    await retire(f.db, 'planning'); const archived = section(f.db, 'planning');
    signIn('student'); const visible = await catalog(); assert.ok(visible.some(row => row.id === archived.id && row.status === 'archived')); assert.equal(resourceSections(visible, period).some(row => row.id === 'planning'), false);
    signIn(); await post({ action: 'create_record', kind: 'resource', title: 'Retired', data: { area: 'resources', category: 'planning' } }, 409);
    const id = await resource('other'); const before = f.db.record(id); await post({ action: 'update_additional_resource', id, title: 'Retired', data: { category: 'planning' } }, 409); assert.deepEqual(f.db.record(id), before);
    f.db.add('academic', 'resource', 'Original', 'published', { area: 'final_degree', subject: 'Ciencias', topic: 'Tema 1', period, externalUrl: 'https://example.edu' });
    await post({ action: 'set_additional_reference', id: 'academic', category: 'planning' }, 409); assert.equal(f.db.record('academic').data.additionalCategory, undefined);
    f.db.add('orphan', 'resource', 'Concurrent stale draft', 'draft', { area: 'resources', category: 'planning', period, externalUrl: 'https://example.edu' });
    await post({ action: 'update_status', id: 'orphan', status: 'published' }, 409); await post({ action: 'replace_additional_content', id: 'orphan', data: { externalUrl: 'https://example.edu/new' } }, 409); assert.equal(f.db.record('orphan').status, 'draft');
    await post({ action: 'restore_resource_section', sectionId: 'planning', revision: archived.data.revision }); assert.equal(section(f.db, 'planning').status, 'published');
  } finally { f.db.sql.close(); }
});

test('moving a course section preserves lesson revisions and each student completion', async () => {
  const f = fixture(); try {
    const target = await create('Talleres', 'courses');
    const id = (await post({ action: 'create_record', kind: 'course', title: 'Curso de ciencias', data: { category: 'courses', plan: 'Gold' } })).id;
    const lesson = (await post({ action: 'save_course_lesson', courseId: id, title: 'Lección uno', data: { order: 1, minutes: 10, materialType: 'Video', externalUrl: 'https://example.edu/lesson' } })).id;
    await post({ action: 'publish_course_lessons', courseId: id }); await post({ action: 'update_status', id, status: 'published' }); signIn('student');
    const progress = (await post({ action: 'set_course_lesson_progress', id: lesson, completed: true })).id; signIn();
    const beforeLesson = f.db.record(lesson), beforeProgress = f.db.record(progress), beforeCourse = f.db.record(id);
    await retire(f.db, 'courses', 'other', 400); await retire(f.db, 'courses', target.sectionId);
    assert.deepEqual(f.db.record(lesson), beforeLesson); assert.deepEqual(f.db.record(progress), beforeProgress); assert.deepEqual(f.db.record(id).data, { ...beforeCourse.data, category: target.sectionId }); assert.equal(f.db.record(id).status, 'published');
    const customCourse = (await post({ action: 'create_record', kind: 'course', title: 'Otro curso', data: { category: target.sectionId } })).id; assert.equal(f.db.record(customCourse).data.category, target.sectionId);
    signIn('student'); const rows = await catalog(); assert.equal(courseProgress(courseLessons(rows, id), rows).percent, 100); assert.ok(rows.some(row => row.id === id));
    signIn('other'); assert.equal((await catalog()).some(row => row.id === progress), false);
  } finally { f.db.sql.close(); }
});

test('renaming or moving course metadata into a custom course section preserves its lessons', async () => {
  const f = fixture(); try {
    const target = await create('Refuerzo', 'courses'); const id = (await post({ action: 'create_record', kind: 'course', title: 'Curso', data: { plan: 'Gold' } })).id;
    const lesson = (await post({ action: 'save_course_lesson', courseId: id, title: 'Primera', data: { order: 1, materialType: 'Video', externalUrl: 'https://example.edu' } })).id, before = f.db.record(lesson);
    await post({ action: 'update_additional_resource', id, title: 'Curso revisado', data: { category: target.sectionId, plan: 'Gold' } }); assert.equal(f.db.record(id).data.category, target.sectionId); assert.deepEqual(f.db.record(lesson), before);
    await post({ action: 'update_additional_resource', id, title: 'Wrong', data: { category: 'apa' } }, 400);
  } finally { f.db.sql.close(); }
});

test('retirement detects edited contents, late arrivals and a changing destination without partial moves', async () => {
  for (const scenario of ['edit', 'arrival', 'destination']) {
    const f = fixture(); try {
      const source = await create('Origen'), target = await create('Destino'), id = await resource(source.sectionId), sourceBefore = section(f.db, source.sectionId);
      const checked = beforeWrite(f.db, query => query.startsWith('WITH matched AS MATERIALIZED'), () => {
        if (scenario === 'edit') f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.description','Concurrent edit') WHERE id=?").run(id);
        else if (scenario === 'arrival') f.db.add('late', 'resource', 'Late arrival', 'draft', { area: 'resources', category: source.sectionId, period });
        else f.db.sql.prepare("UPDATE records SET status='archived' WHERE id=?").run(target.id);
      });
      await retire(f.db, source.sectionId, target.sectionId, 409); checked(); assert.deepEqual(section(f.db, source.sectionId), sourceBefore); assert.equal(f.db.record(id).data.category, source.sectionId); if (scenario === 'arrival') assert.equal(f.db.record('late').data.category, source.sectionId);
    } finally { f.db.sql.close(); }
  }
});

test('late resource creation and metadata writes cannot enter a section retired after their validation', async () => {
  for (const scenario of ['create', 'edit', 'publish', 'reference']) {
    const f = fixture(); try {
      const target = await create('Destino'), id = await resource(scenario === 'publish' ? target.sectionId : 'other');
      f.db.add('academic', 'resource', 'Materia', 'published', { area: 'complexive', subject: 'Ciencias', topic: 'Tema 1', period });
      const before = f.db.record(id), cfg = section(f.db, target.sectionId), count = f.db.sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='resource'").get().n;
      const matches = scenario === 'create' ? query => query.startsWith('INSERT INTO records (id,kind,group_id,title,status') : scenario === 'edit' ? query => query.startsWith("UPDATE records SET title=?,status='draft'") : scenario === 'publish' ? query => query.startsWith('UPDATE records SET status=?,updated_at=') : query => query.startsWith('UPDATE records SET data_json=json_set');
      const checked = beforeWrite(f.db, matches, () => f.db.sql.prepare("UPDATE records SET status='archived' WHERE id=?").run(cfg.id));
      const bodies = { create: { action: 'create_record', kind: 'resource', title: 'Concurrent', data: { area: 'resources', category: target.sectionId } }, edit: { action: 'update_additional_resource', id, title: 'Concurrent', data: { category: target.sectionId } }, publish: { action: 'update_status', id, status: 'published' }, reference: { action: 'set_additional_reference', id: 'academic', category: target.sectionId } };
      await post(bodies[scenario], 409); checked(); assert.deepEqual(f.db.record(id), before); assert.equal(f.db.record('academic').data.additionalCategory, undefined); assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='resource'").get().n, count);
    } finally { f.db.sql.close(); }
  }
});

test('concurrent reordering is all-or-nothing', async () => {
  const f = fixture(); try {
    await create(); const source = section(f.db, 'curriculum'), peer = section(f.db, 'planning');
    const checked = beforeWrite(f.db, query => query.startsWith('WITH checked AS MATERIALIZED'), () => f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.revision','Concurrent') WHERE id=?").run(peer.id));
    await post({ action: 'move_resource_section', sectionId: 'curriculum', revision: source.data.revision, direction: 'up' }, 409); checked(); assert.deepEqual(section(f.db, 'curriculum'), source); assert.equal(section(f.db, 'planning').data.order, peer.data.order);
  } finally { f.db.sql.close(); }
});

test('section limits, the last active section and duplicate restoration protect the catalog', async () => {
  const f = fixture(); try {
    await retire(f.db, 'planning'); await create('Planificaciones'); await post({ action: 'restore_resource_section', sectionId: 'planning', revision: section(f.db, 'planning').data.revision }, 409);
    const custom = resourceSections(await catalog(), period).find(row => row.title === 'Planificaciones'); await retire(f.db, custom.id); await post({ action: 'restore_resource_section', sectionId: 'planning', revision: section(f.db, 'planning').data.revision });
    for (const id of ['planning', 'curriculum', 'courses', 'apa']) await retire(f.db, id);
    await retire(f.db, 'other', null, 400); assert.equal(resourceSections(await catalog(), period).length, 1);
  } finally { f.db.sql.close(); }
  const g = fixture(); try {
    for (let index = 0; index < 45; index++) await create(`Sección ${index + 1}`);
    assert.equal(resourceSections(await catalog(), period).length, 50); await post({ action: 'save_resource_section', title: 'Exceso' }, 400);
    await retire(g.db, 'planning'); await create('Espacio liberado'); await post({ action: 'restore_resource_section', sectionId: 'planning', revision: section(g.db, 'planning').data.revision }, 409);
    assert.equal(resourceSections(await catalog(), period).length, 50);
  } finally { g.db.sql.close(); }
});
