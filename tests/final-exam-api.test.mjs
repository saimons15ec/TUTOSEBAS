import assert from 'node:assert/strict';
import test from 'node:test';
import { completedReportAttempts } from '../lib/reporting.ts';

import { POST, GET, QUESTION_FORMATS, TestDatabase, state, signIn } from './helpers/platform-api.mjs';

const period = '2026-2027';
const subjectsByArea = {
  complexive: ['Fundamentos de Lengua y Literatura', 'Didáctica de la Lengua y la Literatura', 'Lectura y Escritura Académica'],
  final_degree: ['Didáctica Ciencias Naturales', 'Lengua', 'Didáctica de la Educación Física'],
};
function fixture(area) {
  const db = new TestDatabase(); state.env.DB = db;
  for (const identity of ['teacher', 'student', 'other']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id) VALUES(?,?,?,?,?,?,?)').run(identity, `auth-${identity}`, `${identity === 'teacher' ? 'profesor' : identity}@example.test`, identity, identity === 'teacher' ? 'admin' : 'student', 'active', identity === 'teacher' ? null : 'group');
  db.add('period-current', 'period', period, 'published', { current: true });
  db.add('sim-ef-pilot', 'simulator', 'Fixture sentinel', 'archived', {});
  db.add('group', 'group', 'Test group', 'active', { plan: 'Gold', planStatus: 'active', endsAt: new Date(Date.now() + 86400000).toISOString(), permissions: [] });
  const subjects = subjectsByArea[area], blocks = [];
  subjects.forEach((subject, subjectIndex) => {
    db.add(`subject-${subjectIndex}`, 'subject', subject, 'published', { area, period });
    for (const topicNumber of [1, 10]) {
      const blockId = `block-${subjectIndex}-${topicNumber}`, topic = `Tema ${topicNumber}`;
      blocks.push({ blockId, subject, count: topicNumber === 1 ? [4, 3, 3][subjectIndex] : [3, 3, 4][subjectIndex] });
      db.add(blockId, 'question_block', `${subject} · ${topic}`, 'approved', { area, period, subject, topic });
      QUESTION_FORMATS.forEach((format, formatIndex) => {
        for (let i = 0; i < 3; i++) db.add(`question-${subjectIndex}-${topicNumber}-${formatIndex}-${i}`, 'question', `Question ${i}`, 'approved', {
          area, period, subject, topic, importBlockId: blockId, format, plan: 'Bronce', prompt: `Enunciado ${format} ${i}`, caseContext: format === 'Caso práctico' ? 'Situación contextualizada para analizar.' : '',
          options: ['Alternativa uno', 'Alternativa dos', 'Alternativa tres', 'Alternativa cuatro'], correctIndex: (formatIndex + i) % 4, explanation: `Explicación ${format} ${i}`, source: `${topic} · Sección ${i + 1}`, shuffleOptions: format !== 'Ordenar',
        });
      });
    }
  });
  db.add('foreign-block', 'question_block', 'Otra área', 'approved', { area: area === 'complexive' ? 'final_degree' : 'complexive', period, subject: subjects[0], topic: 'Tema 1' });
  db.add('historical-block', 'question_block', 'Otro periodo', 'approved', { area, period: '2025-2026', subject: subjects[0], topic: 'Tema 1' });
  for (const [id, overrides, status] of [['foreign-question', { area: area === 'complexive' ? 'final_degree' : 'complexive' }, 'approved'], ['historical-question', { period: '2025-2026' }, 'approved'], ['pending-question', {}, 'pending']]) db.add(id, 'question', id, status, { area, period, subject: subjects[0], topic: 'Tema 1', importBlockId: 'block-0-1', format: 'Selección directa', ...overrides });
  return { db, area, subjects, blocks };
}
async function post(body, expected = 200) {
  const response = await POST(new Request('https://exam.test/api/platform', { method: 'POST', headers: { origin: 'https://exam.test', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const payload = await response.json(); assert.equal(response.status, expected, JSON.stringify({ action: body.action, error: payload.error, score: payload.result?.score })); return payload;
}
function configuration(f, selectionMode, formatCoverage = 'quota') {
  return { area: f.area, period, mode: 'final', subject: 'General', count: 20, selectionMode, coverAllSubjects: true, topics: [], formats: [], formatCoverage, formatDistribution: QUESTION_FORMATS.map(format => ({ format, count: 4 })), distribution: f.subjects.map((subject, i) => ({ subject, count: [7, 6, 7][i] })), blockDistribution: f.blocks, plan: 'Gold', passScore: 14 };
}

for (const area of ['complexive', 'final_degree']) for (const selectionMode of ['subjects', 'blocks']) for (const formatCoverage of ['pool', 'varied', 'quota']) {
  test(`final exam API publishes, resumes and grades exactly once (${area}, ${selectionMode}, ${formatCoverage})`, async () => {
    const f = fixture(area);
    try {
      signIn(); const created = await post({ action: 'create_record', kind: 'simulator', title: `Final ${area}`, status: 'draft', data: configuration(f, selectionMode, formatCoverage) });
      await post({ action: 'update_status', id: created.id, status: 'published' });
      signIn('student');
      const catalog = await (await GET()).json(); assert.ok(catalog.records.some(row => row.id === created.id));
      assert.ok(catalog.records.filter(row => row.kind === 'question').every(row => !('correctIndex' in row.data) && !('explanation' in row.data)));
      assert.ok(catalog.records.every(row => !('data_json' in row)), 'The raw storage JSON must never bypass filtered student data');
      const started = await post({ action: 'start_simulator_attempt', simulatorId: created.id, clientAttemptId: crypto.randomUUID() });
      assert.equal(started.resumed, false); assert.equal(started.attempt.questions.length, 20);
      assert.equal(new Set(started.attempt.questions.map(row => row.questionId)).size, 20);
      assert.ok(started.attempt.questions.every(row => !('correctIndex' in row) && !('explanation' in row)));
      const session = f.db.record(started.attempt.id);
      assert.deepEqual(f.subjects.map(subject => session.data.questions.filter(row => row.subject === subject).length), [7, 6, 7]);
      assert.ok(session.data.questions.every(row => row.questionId.startsWith('question-')));
      if (selectionMode === 'blocks') for (const entry of f.blocks) assert.equal(session.data.questions.filter(row => f.db.record(row.questionId).data.importBlockId === entry.blockId).length, entry.count);
      if (formatCoverage === 'quota') assert.deepEqual(QUESTION_FORMATS.map(format => session.data.questions.filter(row => row.format === format).length), [4, 4, 4, 4, 4]);
      if (formatCoverage === 'varied') assert.equal(new Set(session.data.questions.map(row => row.format)).size, 5);
      const resumed = await post({ action: 'start_simulator_attempt', simulatorId: created.id, clientAttemptId: crypto.randomUUID() });
      assert.equal(resumed.resumed, true); assert.deepEqual(resumed.attempt, started.attempt);
      const answers = session.data.questions.map(row => ({ questionId: row.questionId, selectedIndex: row.correctIndex }));
      await post({ action: 'finish_simulator_attempt', attemptId: started.attempt.id, answers: answers.slice(1) }, 400);
      signIn('other'); await post({ action: 'finish_simulator_attempt', attemptId: started.attempt.id, answers }, 404);
      signIn('student');
      f.db.sql.exec("UPDATE records SET status='pending' WHERE kind='question'");
      const finished = await post({ action: 'finish_simulator_attempt', attemptId: started.attempt.id, answers });
      assert.equal(finished.result.score, 20); assert.equal(finished.result.correct, 20); assert.equal(finished.result.passed, true);
      assert.ok(finished.result.review.every(row => Number.isInteger(row.correctIndex) && row.explanation));
      const repeated = await post({ action: 'finish_simulator_attempt', attemptId: started.attempt.id, answers: [] });
      assert.deepEqual(repeated, finished);
      assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS total FROM records WHERE kind='attempt'").get().total, 1);
      assert.equal(f.db.record(started.attempt.id).status, 'completed');
      const history = await (await GET()).json(); assert.ok(history.records.some(row => row.id === finished.id && row.data.score === 20)); assert.ok(completedReportAttempts(history.records.filter(row=>row.kind==='attempt')).some(row=>row.id===finished.id));
    } finally { f.db.sql.close(); }
  });
}

for (const area of ['complexive', 'final_degree']) {
  test(`final exam API rejects invalid configuration, access and answers (${area})`, async () => {
    const f = fixture(area);
    try {
      signIn();
      for (const distribution of [
        [{ subject: f.subjects[0], count: 0 }],
        [{ subject: f.subjects[0], count: 101 }],
        [{ subject: f.subjects[0], count: 1.5 }],
        [{ subject: f.subjects[0], count: 5 }, { subject: f.subjects[0], count: 5 }],
        f.subjects.map(subject => ({ subject, count: 100 })),
      ]) {
        await post({ action: 'create_record', kind: 'simulator', title: 'Invalid count', data: { ...configuration(f, 'subjects', 'pool'), distribution } }, 400);
      }
      for (const blockId of ['foreign-block', 'historical-block', 'unknown-block']) {
        await post({ action: 'create_record', kind: 'simulator', title: 'Invalid block', data: { ...configuration(f, 'blocks', 'pool'), blockDistribution: [{ blockId, count: 5 }] } }, 400);
      }
      const incomplete = await post({ action: 'create_record', kind: 'simulator', title: 'Missing matter', data: { ...configuration(f, 'subjects', 'pool'), distribution: [{ subject: f.subjects[0], count: 5 }] } });
      await post({ action: 'update_status', id: incomplete.id, status: 'published' }, 400); assert.equal(f.db.record(incomplete.id).status, 'draft');
      const impossible = await post({ action: 'create_record', kind: 'simulator', title: 'Missing stock', data: { ...configuration(f, 'subjects', 'pool'), formats: ['Ordenar'], distribution: f.subjects.map(subject => ({ subject, count: 30 })) } });
      await post({ action: 'update_status', id: impossible.id, status: 'published' }, 400); assert.equal(f.db.record(impossible.id).status, 'draft');
      const created = await post({ action: 'create_record', kind: 'simulator', title: 'Protected final', data: configuration(f, 'subjects') });
      await post({ action: 'update_status', id: created.id, status: 'published' });
      signIn('student');
      await post({ action: 'start_simulator_attempt', simulatorId: incomplete.id, clientAttemptId: crypto.randomUUID() }, 404);
      f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.endsAt',?) WHERE id='group'").run('2025-01-01T00:00:00Z');
      await post({ action: 'start_simulator_attempt', simulatorId: created.id, clientAttemptId: crypto.randomUUID() }, 403);
      f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.endsAt',?) WHERE id='group'").run(new Date(Date.now()+86400000).toISOString());
      const started = await post({ action: 'start_simulator_attempt', simulatorId: created.id, clientAttemptId: crypto.randomUUID() });
      const saved = f.db.record(started.attempt.id), answers = saved.data.questions.map(row => ({ questionId: row.questionId, selectedIndex: row.correctIndex }));
      for (const selectedIndex of [null, false, true, '', '0', [], {}, undefined, 0.5, -1, 4]) {
        await post({ action: 'finish_simulator_attempt', attemptId: saved.id, answers: answers.map((answer, i) => i ? answer : { ...answer, selectedIndex }) }, 400);
        assert.equal(f.db.record(saved.id).status, 'in_progress');
        assert.equal(f.db.sql.prepare("SELECT COUNT(*) AS total FROM records WHERE kind='attempt'").get().total, 0);

      }
      const partial = await post({ action: 'finish_simulator_attempt', attemptId: saved.id, answers: answers.map((answer, i) => i < 10 ? answer : { ...answer, selectedIndex: (answer.selectedIndex+1)%4 }) });
      assert.equal(partial.result.score,10); assert.equal(partial.result.passed,false);
      const next = await post({ action: 'start_simulator_attempt', simulatorId: created.id, clientAttemptId: crypto.randomUUID() });
      f.db.sql.prepare("UPDATE records SET data_json=json_set(data_json,'$.expiresAt',?) WHERE id=?").run('2025-01-01T00:00:00Z',next.attempt.id);
      await post({ action: 'finish_simulator_attempt', attemptId: next.attempt.id, answers: [] }, 409); assert.equal(f.db.record(next.attempt.id).status,'expired');
    } finally { f.db.sql.close(); }
  });
}
