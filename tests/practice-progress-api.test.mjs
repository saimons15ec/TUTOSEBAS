import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, GET, TestDatabase, state, signIn } from './helpers/platform-api.mjs';
import { practiceMetrics } from '../lib/practice-progress.ts';

const period = '2026-2027', origin = 'https://practice.test';
function fixture(area = 'complexive') {
  const db = new TestDatabase(); state.env.DB = db;
  for (const who of ['teacher', 'student', 'other']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id) VALUES(?,?,?,?,?,?,?)').run(who, `auth-${who}`, `${who === 'teacher' ? 'profesor' : who}@example.test`, who, who === 'teacher' ? 'admin' : 'student', 'active', who === 'teacher' ? null : 'group');
  db.add('period-current', 'period', period, 'published', { current: true }); db.add('sim-ef-pilot', 'simulator', 'Sentinel', 'archived', {});
  db.add('group', 'group', 'Grupo', 'active', { plan: 'Gold', accessPolicyVersion: 1, planStatus: 'active', endsAt: new Date(Date.now() + 86400000).toISOString() });
  const formats = ['Selección directa', 'Completar', 'Relacionar', 'Ordenar', 'Caso práctico'];
  const ids = formats.map((format, i) => { const id = `q-${i}`; db.add(id, 'question', id, 'approved', { area, subject: 'Ciencias', period, topic: i < 3 ? 'Tema 1' : 'Tema 2', topicId: i < 3 ? 'topic-1' : 'topic-2', format, plan: 'Bronce', prompt: `Pregunta ${i}`, options: ['A', 'B', 'C', 'D'], correctIndex: i % 4, explanation: `Explicación ${i}`, source: 'Libro privado' }); return id; });
  signIn('student'); return { db, ids, area, scope: { area, subject: 'Ciencias', period } };
}
async function post(body, expected = 200) {
  const response = await POST(new Request(`${origin}/api/platform`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(body) })), result = await response.json(); assert.equal(response.status, expected, JSON.stringify({ action: body.action, ...result })); return result;
}
async function catalog() { const response = await GET(); assert.equal(response.status, 200); return await response.json(); }
const start = (ids, clientPracticeId = crypto.randomUUID(), expected = 200) => post({ action: 'start_practice_session', clientPracticeId, questionIds: ids, userId: 'other', correct: 999 }, expected);
const answer = (practiceId, questionId, selectedIndex, expected = 200) => post({ action: 'check_practice_answer', practiceId, questionId, selectedIndex, correct: true, score: 20, completed: true, answered: 100, userId: 'other' }, expected);

for (const area of ['complexive', 'final_degree']) test(`practice persists mixed formats and topics, completes only all answers and preserves exact server results (${area})`, async () => {
  const f = fixture(area); try {
    const client = crypto.randomUUID(), started = await start(f.ids, client), id = started.practice.id; assert.equal(started.progress.data.answered, 0); assert.equal(started.practice.status, 'in_progress'); assert.equal((await start(f.ids, client)).practice.id, id);
    for (let i = 0; i < f.ids.length; i++) {
      const result = await answer(id, f.ids[i], i === 0 ? 0 : (i + 1) % 4); assert.equal(result.feedback.correct, i === 0); assert.equal(result.progress.data.correct, 1); assert.equal(result.progress.data.answered, i + 1); assert.equal(result.progress.status, i === f.ids.length - 1 ? 'completed' : 'in_progress');
      const again = await answer(id, f.ids[i], i === 0 ? 0 : (i + 1) % 4); assert.deepEqual(again.progress.data, result.progress.data);
    }
    const saved = f.db.record(id); assert.equal(saved.created_by, 'student'); assert.equal(saved.group_id, 'group'); assert.equal(saved.data.answers.length, 5); assert.ok(saved.data.completedAt); assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='attempt'").get().n, 0);
    await answer(id, f.ids[0], 1, 409); const list = (await catalog()).records, progress = list.filter(row => row.kind === 'practice_session'); assert.equal(progress.length, 1); assert.deepEqual(practiceMetrics(progress, f.scope, null, ''), { started: 1, completed: 1, answered: 5, correct: 1, accuracy: 20 });
    const topic = { ...f.scope, id: 'topic-1', title: 'Tema 1 renombrado', legacy: false, aliases: ['Tema 1'] }; assert.deepEqual(practiceMetrics(progress, f.scope, topic, 'Completar'), { started: 1, completed: 1, answered: 1, correct: 0, accuracy: 0 });
    assert.equal(practiceMetrics(progress, { ...f.scope, period: '2025-2026' }, null, '').accuracy, null); assert.equal(practiceMetrics(progress, { ...f.scope, subject: 'Lengua' }, null, '').started, 0);
    const next = await start(f.ids); assert.notEqual(next.practice.id, id); await answer(next.practice.id, f.ids[0], 0); const current = practiceMetrics((await catalog()).records, f.scope, null, ''); assert.deepEqual(current, { started: 2, completed: 1, answered: 6, correct: 2, accuracy: 33 });
  } finally { f.db.sql.close(); }
});
test('practice records remain private within the same group and never expose keys, question revisions or other answers', async () => {
  const f = fixture(); try {
    const started = await start(f.ids), id = started.practice.id; await answer(id, f.ids[0], 0); const mine = (await catalog()).records.find(row => row.id === id);
    for (const key of ['questions', 'answers', 'revision', 'correctIndex', 'explanation', 'source', 'clientPracticeId']) assert.equal(key in mine.data, false); assert.equal('data_json' in mine, false);
    signIn('other'); assert.equal((await catalog()).records.some(row => row.id === id), false); await answer(id, f.ids[1], 1, 403);
    const own = await start(f.ids); assert.notEqual(own.practice.id, id); signIn('student'); assert.equal((await catalog()).records.some(row => row.id === own.practice.id), false);
    f.db.sql.prepare("UPDATE records SET status='published' WHERE id=?").run(id); signIn('other'); assert.equal((await catalog()).records.some(row => row.id === id), false);
  } finally { f.db.sql.close(); }
});
test('practice rejects invalid selections, nonstudents, unapproved or changed questions and mismatched scope', async () => {
  const f = fixture(); try {
    for (const ids of [[], [f.ids[0], f.ids[0]], ['unknown'], ['bad.id'], Array(101).fill(f.ids[0])]) await start(ids, crypto.randomUUID(), ids[0] === 'unknown' ? 404 : 400);
    signIn(); await start(f.ids, crypto.randomUUID(), 403); signIn('student'); const client = crypto.randomUUID(), started = await start(f.ids, client), id = started.practice.id;
    await start([f.ids[0]], client, 409);
    f.db.add('q-outside', 'question', 'Otra pregunta', 'approved', { ...f.db.record(f.ids[0]).data }); await answer(id, 'q-outside', 0, 403); await answer(id, f.ids[0], 4, 400);
    f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.prompt','Editado') WHERE id=?").run(f.ids[2]); await answer(id, f.ids[0], 0, 409); assert.equal(f.db.record(id).data.answers.length, 0);
    f.db.sql.prepare("UPDATE records SET status='pending' WHERE id=?").run(f.ids[2]); await start(f.ids, crypto.randomUUID(), 403);
    f.db.sql.prepare("UPDATE records SET status='approved',data_json=json_set(data_json,'$.period','2025-2026') WHERE id=?").run(f.ids[2]); await start(f.ids, crypto.randomUUID(), 403);
    f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.period',?,'$.subject','Lengua') WHERE id=?").run(period, f.ids[2]); await start(f.ids, crypto.randomUUID(), 400);
    state.headers = new Headers(); await start(f.ids, crypto.randomUUID(), 401);
  } finally { f.db.sql.close(); }
});
test('revoked plan, group, account and active period deny further progress without losing previous answers', async () => {
  const f = fixture(); try {
    const id = (await start(f.ids)).practice.id; await answer(id, f.ids[0], 0); const initial = f.db.record(id).data_json;
    const group = f.db.record('group').data;
    for (const change of ["UPDATE profiles SET status='suspended' WHERE id='student'", "UPDATE profiles SET group_id=NULL WHERE id='student'", "UPDATE records SET data_json=json_set(data_json,'$.endsAt','2000-01-01') WHERE id='group'", "UPDATE records SET data_json=json_set(data_json,'$.featureOverrides',json('{\"complexive.practice\":\"deny\"}')) WHERE id='group'", "UPDATE records SET title='2027-2028' WHERE id='period-current'"]) {
      f.db.sql.exec(change); await answer(id, f.ids[1], 1, 403); assert.equal(f.db.record(id).data_json, initial); f.db.sql.exec("UPDATE profiles SET status='active',group_id='group' WHERE id='student'"); f.db.sql.prepare("UPDATE records SET data_json=? WHERE id='group'").run(JSON.stringify(group)); f.db.sql.prepare("UPDATE records SET title=? WHERE id='period-current'").run(period);
    }
    await answer(id, f.ids[1], 1); assert.equal(f.db.record(id).data.answers.length, 2);
  } finally { f.db.sql.close(); }
});
test('starting practice uses atomic period, profile and plan snapshots without partial records', async () => {
  const f = fixture(); try {
    const prepare = f.db.prepare.bind(f.db); let fire = true;
    f.db.prepare = query => { const statement = prepare(query); if (!query.startsWith('INSERT INTO records(id,kind,title,status,data_json,group_id,created_by)')) return statement; const bind = statement.bind; statement.bind = (...values) => { const bound = bind(...values), run = bound.run; bound.run = async () => { if (fire) { fire = false; f.db.sql.prepare("UPDATE records SET title='2027-2028' WHERE id='period-current'").run(); } return run(); }; return bound; }; return statement; };
    await start(f.ids, crypto.randomUUID(), 409); assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='practice_session'").get().n, 0); f.db.prepare = prepare;
  } finally { f.db.sql.close(); }
});
test('atomic practice guards stop concurrent revocation and preserve competing answers', async () => {
  const f = fixture(); try {
    let id = (await start(f.ids)).practice.id; const prepare = f.db.prepare.bind(f.db); let mutate = () => f.db.sql.exec("UPDATE records SET data_json=json_set(data_json,'$.endsAt','2000-01-01') WHERE id='group'");
    f.db.prepare = query => { const statement = prepare(query); if (!query.startsWith('UPDATE records SET status=?,data_json=?') || !query.includes("kind='practice_session'")) return statement; const bind = statement.bind; statement.bind = (...values) => { const bound = bind(...values), run = bound.run; bound.run = async () => { if (mutate) { const mutation = mutate; mutate = null; mutation(); } return run(); }; return bound; }; return statement; };
    await answer(id, f.ids[0], 0, 403); assert.equal(f.db.record(id).data.answers.length, 0);
    f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.endsAt',?) WHERE id='group'").run(new Date(Date.now() + 86400000).toISOString());
    const row = f.db.record(id); mutate = () => { const data = JSON.parse(row.data_json); data.answers.push({ questionId: f.ids[1], selectedIndex: 1, correct: true, answeredAt: new Date().toISOString() }); f.db.sql.prepare('UPDATE records SET data_json=? WHERE id=?').run(JSON.stringify(data), id); };
    await answer(id, f.ids[0], 0); const after = f.db.record(id); assert.equal(after.data.answers.length, 2); assert.deepEqual(new Set(after.data.answers.map(a => a.questionId)), new Set([f.ids[0], f.ids[1]]));
    f.db.prepare = prepare;
  } finally { f.db.sql.close(); }
});
