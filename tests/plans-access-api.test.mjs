import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, GET, FILE_POST, FILE_GET, TestDatabase, state, signIn } from './helpers/platform-api.mjs';
import { PLAN_FEATURES, PLAN_NAMES, defaultPlanCatalog, canUsePlanFeature, planTemplateId, contentPlanFeature, groupReviewLimit } from '../lib/plans.ts';

const origin = 'https://access.test', period = '2026-2027';
class TestBucket {
  objects = new Map();
  async put(key, bytes, options) { this.objects.set(key, { bytes: new Uint8Array(bytes).slice(), ...options }); }
  async head(key) { return this.objects.get(key) || null; }
  async get(key) { const object = this.objects.get(key); return object && { body: object.bytes, size: object.bytes.length, customMetadata: object.customMetadata, arrayBuffer: async () => object.bytes.slice().buffer, httpEtag: '"test-object"', writeHttpMetadata(headers) { headers.set('content-type', object.httpMetadata.contentType); headers.set('content-disposition', object.httpMetadata.contentDisposition); } }; }
  async list() { return { objects: [...this.objects.keys()].map(key => ({ key })), truncated: false }; }
  async delete(key) { this.objects.delete(key); }
}
function fixture(plan = 'Gold') {
  const db = new TestDatabase(), bucket = new TestBucket(); state.env.DB = db; state.env.BUCKET = bucket;
  for (const who of ['teacher', 'student', 'other']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id,member_role) VALUES(?,?,?,?,?,?,?,?)').run(who, `auth-${who}`, `${who === 'teacher' ? 'profesor' : who}@example.test`, `Nombre académico ${who}`, who === 'teacher' ? 'admin' : 'student', 'active', who === 'teacher' ? null : who === 'other' ? 'group-other' : 'group', who === 'student' ? 'coordinator' : 'member');
  db.add('period-current', 'period', period, 'published', { current: true }); db.add('sim-ef-pilot', 'simulator', 'Sentinel', 'archived', {});
  const data = { plan, planStatus: 'active', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), permissions: [], accessPolicyVersion: 1 };
  db.add('group', 'group', 'Grupo principal', 'active', data); db.add('group-other', 'group', 'Otro grupo', 'active', { ...data, plan: 'Bronce' }); signIn(); return { db, bucket };
}
async function post(body, expected = 200) {
  const response = await POST(new Request(`${origin}/api/platform`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const payload = await response.json(); assert.equal(response.status, expected, JSON.stringify({ action: body.action, ...payload })); return payload;
}
async function catalog(expected = 200) { const response = await GET(), data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data; }
async function upload(kind = 'material', expected = 200) {
  const response = await FILE_POST(new Request(`${origin}/api/files?kind=${kind}&fileName=prueba.pdf`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' }, body: '%PDF-1.4\nPrueba\n%%EOF' })), payload = await response.json(); assert.equal(response.status, expected, JSON.stringify(payload)); return payload;
}
async function download(key, expected = 200) { const response = await FILE_GET(new Request(`${origin}/api/files?key=${encodeURIComponent(key)}`)); assert.equal(response.status, expected, await response.clone().text()); }
const profile = (db, id = 'student') => db.sql.prepare('SELECT * FROM profiles WHERE id=?').get(id);
const revision = db => db.record('group').data.accessRevision || 'initial';
async function template(db, plan, featureOverrides = {}, reviewLimit = defaultPlanCatalog()[plan].reviewLimit, expected = 200) {
  return post({ action: 'save_plan_template', plan, revision: db.record(planTemplateId(plan))?.data.revision || 'initial', featureOverrides, reviewLimit }, expected);
}
async function permissions(db, featureOverrides = {}, extra = {}, expected = 200) { return post({ action: 'save_group_permissions', id: 'group', revision: revision(db), permissionMode: 'custom', featureOverrides, reviewLimit: null, ...extra }, expected); }
async function support(category = 'planning', extra = {}) { return (await post({ action: 'create_record', kind: 'resource', title: 'Guía', data: { area: 'resources', category, plan: 'Gold', externalUrl: 'https://example.edu', ...extra } })).id; }
function academic(db, area = 'complexive') {
  const subject = 'Ciencias'; db.add(`subject-${area}`, 'subject', subject, 'published', { area, period });
  for (let index = 0; index < 5; index++) db.add(`question-${area}-${index}`, 'question', `Pregunta ${index}`, 'approved', { area, period, subject, topic: 'Tema 1', plan: 'Gold', format: 'Selección directa', prompt: `Pregunta ${area} ${index}`, options: ['Uno', 'Dos', 'Tres', 'Cuatro'], correctIndex: 0, explanation: 'Porque es uno', source: 'Material del tema' });
  for (const mode of ['subject', 'final']) db.add(`sim-${area}-${mode}`, 'simulator', `Simulador ${mode}`, 'published', { area, period, subject: mode === 'subject' ? subject : 'General', plan: 'Gold', mode, type: mode === 'subject' ? 'subject' : 'general', count: 5, formats: [], topics: [], distribution: mode === 'final' ? [{ subject, count: 5 }] : [], selectionMode: 'subjects', passScore: 14 });
}
function beforeWrite(db, matches, callback) {
  const prepare = db.prepare.bind(db); let fired = false;
  db.prepare = query => { const statement = prepare(query), bind = statement.bind; statement.bind = (...values) => { const bound = bind(...values), run = bound.run; bound.run = async () => { if (!fired && matches(query)) { fired = true; callback(); } return run(); }; return bound; }; return statement; };
  return () => assert.equal(fired, true);
}

test('unknown and anonymous emails cannot create profiles, see data, upload or administer access', async () => {
  const f = fixture(); try {
    const users = f.db.sql.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, records = f.db.sql.prepare('SELECT COUNT(*) AS n FROM records').get().n;
    signIn('stranger'); const data = await catalog(); assert.equal(data.authorized, false); assert.equal(data.profile.status, 'unregistered'); assert.deepEqual(data.records, []); assert.deepEqual(data.profiles, []);
    await post({ action: 'activate_plan', id: 'group', plan: 'Gold', permissions: ['all'], role: 'admin' }, 403); await upload('submission', 403);
    assert.equal(f.db.sql.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, users); assert.equal(f.db.sql.prepare('SELECT COUNT(*) AS n FROM records').get().n, records);
    state.headers = new Headers(); await catalog(401); await post({ action: 'save_plan_template', plan: 'Gold' }, 401); await upload('material', 401);
  } finally { f.db.sql.close(); }
});

test('a teacher invitation links only its exact normalized email, keeps the roster name, and never reactivates suspension', async () => {
  const f = fixture(); try {
    f.db.sql.prepare("UPDATE profiles SET auth_id=NULL,status='invited' WHERE id='student'").run(); signIn('student'); state.headers.set('oai-authenticated-user-email', 'STUDENT@EXAMPLE.TEST'); state.headers.set('oai-authenticated-user-full-name', 'Nombre%20de%20ChatGPT'); state.headers.set('oai-authenticated-user-full-name-encoding', 'percent-encoded-utf-8');
    const data = await catalog(); assert.equal(data.authorized, true); assert.equal(data.profile.full_name, 'Nombre académico student'); assert.equal(profile(f.db).auth_id, 'auth-student');
    signIn(); await post({ action: 'set_user_status', id: 'student', status: 'suspended' }); signIn('student'); const blocked = await catalog(); assert.equal(blocked.authorized, false); assert.deepEqual(blocked.records, []); await upload('submission', 403); assert.equal(profile(f.db).status, 'suspended');
    signIn(); await post({ action: 'set_user_status', id: 'student', status: 'active' }); signIn('student'); assert.equal((await catalog()).authorized, true);
  } finally { f.db.sql.close(); }
});

test('a changed email or a different identity cannot inherit or overwrite another roster account', async () => {
  const f = fixture(); try {
    const student = profile(f.db), other = profile(f.db, 'other'); signIn('student'); state.headers.set('oai-authenticated-user-email', 'new-address@example.test'); assert.equal((await catalog()).authorized, false); assert.deepEqual(profile(f.db), student);
    signIn('other'); state.headers.set('oai-authenticated-user-email', 'student@example.test'); await catalog(403); assert.deepEqual(profile(f.db), student); assert.deepEqual(profile(f.db, 'other'), other);
    f.db.sql.prepare("UPDATE profiles SET auth_id=NULL WHERE id='other'").run(); signIn('student'); state.headers.set('oai-authenticated-user-email', 'other@example.test'); await catalog(403); assert.equal(profile(f.db, 'other').auth_id, null); assert.deepEqual(profile(f.db), student);
    signIn(); assert.equal((await catalog()).profile.role, 'admin');
  } finally { f.db.sql.close(); }
});

test('a suspension concurrent with invitation linking cannot be overwritten by sign-in', async () => {
  const f = fixture(); try {
    f.db.sql.prepare("UPDATE profiles SET auth_id=NULL,status='invited' WHERE id='student'").run(); const checked = beforeWrite(f.db, query => query.startsWith('UPDATE profiles SET auth_id='), () => f.db.sql.prepare("UPDATE profiles SET status='suspended' WHERE id='student'").run());
    signIn('student'); await catalog(403); checked(); assert.equal(profile(f.db).status, 'suspended'); assert.equal(profile(f.db).auth_id, null);
  } finally { f.db.sql.close(); }
});

test('default benefits and all/manual grants respect group expiry and preserve role boundaries', () => {
  const plans = defaultPlanCatalog(), base = { planStatus: 'active', endsAt: '2099-01-01T00:00:00Z', accessPolicyVersion: 1 };
  for (const plan of PLAN_NAMES) for (const feature of PLAN_FEATURES) assert.equal(canUsePlanFeature({ ...base, plan }, feature.id, plans), PLAN_NAMES.indexOf(plan) >= PLAN_NAMES.indexOf(feature.minimum), `${plan}:${feature.id}`);
  assert.equal(groupReviewLimit({ plan: 'Plata' }, plans), 1); assert.equal(groupReviewLimit({ plan: 'Gold' }, plans), 3);
  for (const plan of PLAN_NAMES) for (const feature of PLAN_FEATURES) {
    assert.equal(canUsePlanFeature({ ...base, plan, featureOverrides: { [feature.id]: 'allow' } }, feature.id, plans, 'Gold'), true);
    assert.equal(canUsePlanFeature({ ...base, plan, permissions: ['all'], featureOverrides: { [feature.id]: 'deny' } }, feature.id, plans), false);
    assert.equal(canUsePlanFeature({ ...base, plan, endsAt: '2000-01-01', permissions: ['all'], featureOverrides: { [feature.id]: 'allow' } }, feature.id, plans), false);
  }
});

test('plan benefits change all matching groups; group exceptions win and resets keep data and dates', async () => {
  const f = fixture('Bronce'); try {
    const file = await upload(), id = await support('planning', { fileKey: file.key }); await post({ action: 'update_status', id, status: 'published' }); const original = f.db.record(id), group = f.db.record('group');
    signIn('student'); assert.equal((await catalog()).records.some(row => row.id === id), false); await download(file.key, 403); signIn();
    await template(f.db, 'Bronce', { 'resources.planning': 'allow' }); signIn('student'); assert.ok((await catalog()).records.some(row => row.id === id)); await download(file.key); signIn('other'); assert.ok((await catalog()).records.some(row => row.id === id)); signIn();
    await permissions(f.db, { 'resources.planning': 'deny' }); assert.equal(f.db.record('group').data.endsAt, group.data.endsAt); assert.equal(f.db.record('group').data.plan, 'Bronce'); assert.deepEqual(f.db.record(id), original);
    signIn('student'); assert.equal((await catalog()).records.some(row => row.id === id), false); await download(file.key, 403); signIn('other'); await download(file.key); signIn();
    await template(f.db, 'Bronce', { 'resources.planning': 'deny' }); await permissions(f.db, { 'resources.planning': 'allow' }); signIn('student'); await download(file.key); signIn('other'); await download(file.key, 403); signIn();
    await permissions(f.db, {}, { permissionMode: 'plan' }); assert.deepEqual(f.db.record('group').data.featureOverrides, {}); assert.deepEqual(f.db.record('group').data.permissions, []); assert.equal(f.db.record('group').data.endsAt, group.data.endsAt);
    await template(f.db, 'Bronce'); signIn('student'); assert.equal((await catalog()).records.some(row => row.id === id), false); await download(file.key, 403);
  } finally { f.db.sql.close(); }
});

test('course grants in Bronce apply to lesson downloads and progress and can be revoked independently', async () => {
  const f = fixture('Bronce'); try {
    const file = await upload(), id = (await post({ action: 'create_record', kind: 'course', title: 'Curso', data: { plan: 'Gold' } })).id;
    const lesson = (await post({ action: 'save_course_lesson', courseId: id, title: 'Lección', data: { order: 1, materialType: 'Documento', fileKey: file.key } })).id;
    await post({ action: 'publish_course_lessons', courseId: id }); await post({ action: 'update_status', id, status: 'published' }); signIn('student'); await download(file.key, 403); await post({ action: 'set_course_lesson_progress', id: lesson, completed: true }, 403); signIn();
    await template(f.db, 'Bronce', { 'resources.courses': 'allow' }); signIn('student'); await download(file.key); const progress = (await post({ action: 'set_course_lesson_progress', id: lesson, completed: true })).id, original = f.db.record(progress); signIn();
    await permissions(f.db, { 'resources.courses': 'deny' }); signIn('student'); const denied = await catalog(); assert.equal(denied.records.some(row => [id, lesson, progress].includes(row.id)), false); await download(file.key, 403); await post({ action: 'set_course_lesson_progress', id: lesson, completed: false }, 403); assert.deepEqual(f.db.record(progress), original);
    signIn(); await permissions(f.db, {}, { permissionMode: 'plan' }); signIn('student'); assert.ok((await catalog()).records.some(row => row.id === progress)); await download(file.key);
  } finally { f.db.sql.close(); }
});

test('APA custom sections use the same plan option in the catalog and direct downloads', async () => {
  const f = fixture('Bronce'); try {
    const section = await post({ action: 'save_resource_section', title: 'Referencias del curso', mode: 'apa' }), file = await upload(), id = await support(section.sectionId, { fileKey: file.key }); await post({ action: 'update_status', id, status: 'published' });
    assert.equal(contentPlanFeature(f.db.record(id), [{ id: section.sectionId, mode: 'apa' }]), 'resources.apa');
    await template(f.db, 'Bronce', { 'resources.library': 'allow', 'resources.apa': 'deny' }); signIn('student'); assert.equal((await catalog()).records.some(row => row.id === id), false); await download(file.key, 403); signIn();
    await permissions(f.db, { 'resources.apa': 'allow' }); signIn('student'); assert.ok((await catalog()).records.some(row => row.id === id)); await download(file.key);
  } finally { f.db.sql.close(); }
});

test('practice, subject simulators and final exams remain independently configurable in both areas', async () => {
  for (const area of ['complexive', 'final_degree']) {
    const f = fixture('Bronce'); try {
      academic(f.db, area); signIn('student'); await post({ action: 'check_practice_answer', questionId: `question-${area}-0`, selectedIndex: 0 }, 403); await post({ action: 'start_simulator_attempt', simulatorId: `sim-${area}-subject`, clientAttemptId: 'initial-denied-123' }, 403); signIn();
      await permissions(f.db, { [`${area}.practice`]: 'deny', [`${area}.simulator`]: 'allow', [`${area}.final_exam`]: 'deny' }); signIn('student'); const visible = await catalog(); assert.equal(visible.records.some(row => row.kind === 'question'), false); assert.ok(visible.records.some(row => row.id === `sim-${area}-subject`)); assert.equal(visible.records.some(row => row.id === `sim-${area}-final`), false);
      const started = await post({ action: 'start_simulator_attempt', simulatorId: `sim-${area}-subject`, clientAttemptId: 'subject-allowed-123' }); assert.equal(started.attempt.questions.length, 5); assert.ok(started.attempt.questions.every(row => !('correctIndex' in row))); await post({ action: 'start_simulator_attempt', simulatorId: `sim-${area}-final`, clientAttemptId: 'final-denied-123' }, 403); await post({ action: 'check_practice_answer', questionId: `question-${area}-0`, selectedIndex: 0 }, 403);
      const answers = Object.fromEntries(f.db.record(started.attempt.id).data.questions.map(row => [row.questionId, row.correctIndex])); signIn(); await permissions(f.db, { [`${area}.simulator`]: 'deny', [`${area}.final_exam`]: 'allow', [`${area}.practice`]: 'allow' }); signIn('student'); await post({ action: 'finish_simulator_attempt', attemptId: started.attempt.id, answers }, 403);
      const final = await post({ action: 'start_simulator_attempt', simulatorId: `sim-${area}-final`, clientAttemptId: 'final-allowed-123' }); assert.equal(final.attempt.questions.length, 5); assert.equal((await post({ action: 'check_practice_answer', questionId: `question-${area}-0`, selectedIndex: 0 })).feedback.correct, true);
    } finally { f.db.sql.close(); }
  }
});

test('work permissions, upload validation and configured correction limits agree', async () => {
  const f = fixture('Bronce'); try {
    await template(f.db, 'Bronce', { 'work.planning': 'allow', 'work.case_study': 'deny' }, 2); signIn('student'); const file = await upload('submission');
    await post({ action: 'submit_work', title: 'Trabajo', workType: 'case-study', fileKey: file.key }, 403);
    const body = { action: 'submit_work', title: 'Trabajo', workType: 'planning', fileKey: file.key }, initial = await post(body); assert.equal((await post(body)).id, initial.id); assert.equal((await post(body)).id, initial.id); await post(body, 403); assert.equal(f.db.record(initial.id).data.revisions, 2);
    signIn(); await permissions(f.db, { 'work.planning': 'deny', 'work.case_study': 'deny' }); signIn('student'); const before = f.bucket.objects.size; await upload('submission', 403); assert.equal(f.bucket.objects.size, before); await post(body, 403);
    signIn(); await permissions(f.db, { 'work.planning': 'allow', 'work.case_study': 'allow' }, { reviewLimit: 3 }); signIn('student'); assert.equal((await post(body)).id, initial.id); const other = await post({ ...body, workType: 'case-study' }); assert.notEqual(other.id, initial.id); assert.equal(f.db.record(initial.id).data.workType, 'planning'); assert.equal(f.db.record(other.id).data.workType, 'case-study');
  } finally { f.db.sql.close(); }
});

test('all features can be granted without changing the plan and expire together', async () => {
  const f = fixture('Bronce'); try {
    const grants = Object.fromEntries(PLAN_FEATURES.map(feature => [feature.id, 'allow'])), old = f.db.record('group').data;
    await permissions(f.db, grants); const group = f.db.record('group').data; assert.equal(group.plan, 'Bronce'); assert.equal(group.endsAt, old.endsAt); assert.ok(PLAN_FEATURES.every(feature => canUsePlanFeature(group, feature.id)));
    const id = await support(); await post({ action: 'update_status', id, status: 'published' }); f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.endsAt','2000-01-01','$.permissions',json('[\"all\"]')) WHERE id='group'").run(); signIn('student'); assert.equal((await catalog()).records.some(row => row.id === id), false); await upload('submission', 403);
    signIn(); await post({ action: 'activate_plan', id: 'group', revision: revision(f.db), plan: 'Plata', days: 14, permissionMode: 'plan' }); const reset = f.db.record('group').data; assert.equal(reset.plan, 'Plata'); assert.deepEqual(reset.featureOverrides, {}); assert.deepEqual(reset.permissions, []); assert.ok(Date.parse(reset.endsAt) > Date.now() + 13 * 86400000); assert.equal(profile(f.db).role, 'student');
  } finally { f.db.sql.close(); }
});

test('administration rejects forged options, invalid limits, stale revisions and student requests', async () => {
  const f = fixture(); try {
    const before = f.db.record('group');
    for (const overrides of [{ admin: 'allow' }, { 'resources.courses': ['allow'] }, { 'resources.courses': true }, [], null]) await template(f.db, 'Gold', overrides, 3, 400);
    for (const limit of [-1, 1.5, 101, '3']) await template(f.db, 'Gold', {}, limit, 400);
    for (const days of [0, -1, 366, 1.5, '30']) await post({ action: 'activate_plan', id: 'group', plan: 'Gold', days, permissionMode: 'plan' }, 400);
    await post({ action: 'activate_plan', id: 'group', plan: 'Gold', permissions: ['admin'] }, 400); await permissions(f.db, {}, { revision: 'stale' }, 409); assert.deepEqual(f.db.record('group'), before);
    const saved = await template(f.db, 'Gold', { 'resources.courses': 'deny' }); await post({ action: 'save_plan_template', plan: 'Gold', revision: 'initial', featureOverrides: {}, reviewLimit: 3 }, 409); await post({ action: 'update_status', id: saved.id, status: 'archived' }, 400); await post({ action: 'create_record', kind: 'plan_template', title: 'Bypass' }, 400);
    signIn('student'); for (const action of ['save_plan_template', 'save_group_permissions', 'activate_plan']) await post({ action, id: 'group', plan: 'Gold', permissionMode: 'custom', featureOverrides: { 'resources.courses': 'allow' }, reviewLimit: 3 }, 403);
    const data = await catalog(); assert.equal(data.records.some(row => row.kind === 'plan_template'), false); assert.equal(data.plans.Gold.featureOverrides['resources.courses'], 'deny');
  } finally { f.db.sql.close(); }
});

test('concurrent plan and group updates fail without overwriting reviewed settings or dates', async () => {
  for (const action of ['template', 'permissions', 'activate']) {
    const f = fixture('Bronce'); try {
      await template(f.db, 'Bronce'); const old = f.db.record('group').data, templateBefore = f.db.record(planTemplateId('Bronce')).data;
      const checked = beforeWrite(f.db, query => query.startsWith('UPDATE records SET data_json=?,updated_at=CURRENT_TIMESTAMP') && (action === 'template' ? query.includes("kind='plan_template'") : query.includes("kind='group'")), () => f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.concurrent','preserve') WHERE id=?").run(action === 'template' ? planTemplateId('Bronce') : 'group'));
      if (action === 'template') { await template(f.db, 'Bronce', { 'resources.courses': 'allow' }, 3, 409); assert.deepEqual(f.db.record(planTemplateId('Bronce')).data, { ...templateBefore, concurrent: 'preserve' }); }
      else if (action === 'permissions') await permissions(f.db, { 'resources.courses': 'allow' }, {}, 409);
      else await post({ action: 'activate_plan', id: 'group', revision: revision(f.db), plan: 'Gold', days: 30, permissionMode: 'plan' }, 409);
      checked(); if (action !== 'template') assert.deepEqual(f.db.record('group').data, { ...old, concurrent: 'preserve' });
    } finally { f.db.sql.close(); }
  }
});
