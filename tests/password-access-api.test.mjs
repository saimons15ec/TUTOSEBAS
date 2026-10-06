import test from 'node:test';
import assert from 'node:assert/strict';
import { TestDatabase, state, signIn, GET as PLATFORM_GET, POST as PLATFORM_POST, FILE_GET } from './helpers/platform-api.mjs';
import { assertTrustedMutation } from '../lib/security.ts';

const { POST, GET } = await import('../app/api/auth/route.ts');
const { GET: BACKUP_GET } = await import('../app/api/security/backup/route.ts');
const { getApplicationUser } = await import('../lib/application-auth.ts');
const { readPasswordSession, setRegisteredPassword, validateNewPassword, authMode } = await import('../lib/password-auth.ts');

const origin = 'https://portal.example.test';
const initial = 'Temporal unica Rio 2026!';
const finalPassword = 'Frase privada Agua 2026!';
const administrator = { id: 'teacher', auth_id: 'auth-teacher', email: 'profesor@example.test', full_name: 'Profesor', role: 'admin', status: 'active' };
function fixture() {
  const previousEnv = { ...state.env }; const previousFetch = globalThis.fetch;
  const database = new TestDatabase();
  Object.assign(state.env, { DB: database, APP_AUTH_MODE: 'sites', APP_ORIGIN: origin, SUPABASE_URL: 'https://example-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'test'.repeat(6), SUPABASE_SECRET_KEY: 'sb_secret_' + 'synthetic'.repeat(5) });
  state.env.BUCKET = { list: async () => ({ objects: [], truncated: false }) };
  database.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id,member_role) VALUES(?,?,?,?,?,?,?,?)').run('teacher', 'auth-teacher', administrator.email, 'Profesor académico', 'admin', 'active', null, 'member');
  database.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id,member_role) VALUES(?,?,?,?,?,?,?,?)').run('student', 'auth-student', 'student@example.test', 'Nombre del registro', 'student', 'invited', 'group', 'member');
  database.add('period-current', 'period', '2026-2027', 'published', { current: true }); database.add('sim-ef-pilot', 'simulator', 'Histórico', 'archived', {});
  database.add('group', 'group', 'Grupo de prueba', 'active', { plan: 'Gold', planStatus: 'active', endsAt: '2099-01-01', accessPolicyVersion: 1 });
  const users = new Map(); const calls = []; let responseOverride;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ path: url.pathname, method: options.method, headers: options.headers });
    assert.equal(url.origin, 'https://example-project.supabase.co'); assert.equal(options.redirect, 'error');
    assert.ok(options.signal); assert.ok(!options.headers.authorization); // New API keys use apikey, never Bearer.
    if (responseOverride) return responseOverride(url, options, body);
    if (url.pathname === '/auth/v1/token') {
      const user = [...users.values()].find(user => user.email === body.email && user.password === body.password);
      return user ? Response.json({ user: { id: user.id, email: user.email, email_confirmed_at: '2026-01-01' }, access_token: 'NEVER_RETURN_THIS', refresh_token: 'NEVER_RETURN_THIS_EITHER' }) : Response.json({ msg: 'private provider error' }, { status: 400 });
    }
    assert.equal(options.headers.apikey, state.env.SUPABASE_SECRET_KEY);
    if (options.method === 'POST') {
      const id = crypto.randomUUID(); if ([...users.values()].some(u => u.email === body.email)) return Response.json({ msg: 'existing user' }, { status: 422 });
      users.set(id, { id, email: body.email, password: body.password }); return Response.json({ id, email: body.email, email_confirmed_at: '2026-01-01' });
    }
    const id = url.pathname.split('/').pop(); const user = users.get(id); assert.ok(user);
    if (options.method === 'PUT') user.password = body.password;
    return Response.json({ id, email: user.email, email_confirmed_at: '2026-01-01' });
  };
  signIn('teacher');
  return { database, users, calls, override: callback => { responseOverride = callback; }, close: () => { database.sql.close(); globalThis.fetch = previousFetch; for (const key of Object.keys(state.env)) delete state.env[key]; Object.assign(state.env, previousEnv); signIn('teacher'); } };
}
async function request(body, cookie, expected = 200, extra = {}) {
  const headers = new Headers({ origin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '192.0.2.1', ...(cookie ? { cookie } : {}), ...extra });
  if (state.env.APP_AUTH_MODE === 'password') state.headers = new Headers(cookie ? { cookie } : {});
  const response = await POST(new Request(origin + '/api/auth', { method: 'POST', headers, body: JSON.stringify(body) }));
  const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value));
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { value, response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function provision(f, id = 'student') { await setRegisteredPassword(id, initial, administrator); }
async function ready(f, id = 'student') {
  await provision(f, id); state.env.APP_AUTH_MODE = 'password';
  const email = id === 'student' ? 'student@example.test' : administrator.email;
  const login = await request({ action: 'login', email, password: initial });
  return request({ action: 'change_password', currentPassword: initial, password: finalPassword }, login.cookie);
}

test('keeps Sites authentication until the independent provider is configured', async () => {
  const f = fixture(); try { delete state.env.SUPABASE_SECRET_KEY; const identity = await getApplicationUser(); assert.equal(identity.userId, 'auth-teacher'); const r = await GET(new Request(origin + '/api/auth')); assert.equal((await r.json()).configured, false); await request({ action: 'login', email: administrator.email, password: initial }, null, 503); assert.equal(f.calls.length, 0); } finally { f.close(); }
});
test('independent authentication ignores spoofed Sites identities and has no development fallback', async () => {
  const f = fixture(); try { state.env.APP_AUTH_MODE = 'password'; signIn('teacher'); assert.equal(await getApplicationUser(), null); assert.equal((await PLATFORM_GET()).status, 401); assert.equal((await FILE_GET(new Request(origin + '/api/files?key=private'))).status, 401); state.env.APP_AUTH_MODE = 'unknown'; assert.throws(authMode); } finally { f.close(); }
});
test('independent deployment cannot accidentally use the Sites header bridge', async () => {
  const f = fixture(); try { state.env.APP_DEPLOYMENT = 'independent'; signIn('teacher'); assert.throws(authMode, error=>error.status===503); await assert.rejects(getApplicationUser(), error=>error.status===503); state.env.APP_AUTH_MODE='password'; assert.equal(await getApplicationUser(),null); } finally { f.close(); }
});
test('only registered and provisioned emails can sign in; no public signup', async () => {
  const f = fixture(); try { state.env.APP_AUTH_MODE = 'password'; for (const email of ['stranger@example.test', 'student@example.test']) await request({ action: 'login', email, password: initial }, null, 401); await request({ action: 'signup', email: 'stranger@example.test', password: initial }, null, 400); assert.equal(f.calls.length, 0); assert.equal(f.database.sql.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, 2); } finally { f.close(); }
});
test('first login grants only password change, not academic content or files', async () => {
  const f = fixture(); try { await provision(f); state.env.APP_AUTH_MODE = 'password'; const r = await request({ action: 'login', email: ' STUDENT@example.test ', password: initial }); assert.equal(r.value.mustChangePassword, true); state.headers = new Headers({ cookie: r.cookie }); assert.equal((await PLATFORM_GET()).status, 428); assert.equal((await FILE_GET(new Request(origin + '/api/files?key=private'))).status, 428); const info = await GET(new Request(origin + '/api/auth', { headers: { cookie: r.cookie } })); assert.equal((await info.json()).mustChangePassword, true); } finally { f.close(); }
});
test('changing initial password keeps the profile, historical identity, name and group', async () => {
  const f = fixture(); try { const r = await ready(f); state.headers = new Headers({ cookie: r.cookie }); const identity = await getApplicationUser(); assert.equal(identity.userId, 'auth-student'); assert.equal(identity.profileId, 'student'); const response = await PLATFORM_GET(); assert.equal(response.status, 200); const workspace = await response.json(); assert.equal(workspace.profile.full_name, 'Nombre del registro'); assert.equal(workspace.profile.group_id, 'group'); assert.equal(workspace.profile.status, 'active'); assert.equal(workspace.accessMethod, 'password'); const p = f.database.sql.prepare("SELECT auth_id FROM profiles WHERE id='student'").get(); assert.equal(p.auth_id, 'auth-student'); assert.equal(workspace.profile.role, 'student'); } finally { f.close(); }
});
test('sessions are random host-only secure HttpOnly cookies; D1 stores only their digest', async () => {
  const f = fixture(); try { const r = await ready(f); const cookie = r.response.headers.get('set-cookie'); for (const term of ['__Host-tutosebas-session=', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) assert.ok(cookie.includes(term)); assert.ok(!cookie.includes('Domain=')); const raw = r.cookie.split('=')[1]; assert.equal(raw.length, 64); const stored = f.database.sql.prepare('SELECT token_hash FROM auth_sessions').all(); assert.ok(stored.every(s => s.token_hash !== raw && /^[0-9a-f]{64}$/.test(s.token_hash))); const dump = JSON.stringify(f.database.sql.prepare('SELECT * FROM auth_identities').all()); for (const secret of [initial, finalPassword, 'NEVER_RETURN_THIS', state.env.SUPABASE_SECRET_KEY]) assert.ok(!dump.includes(secret)); assert.ok(!JSON.stringify(r.value).includes('token')); } finally { f.close(); }
});
test('rejects bad current passwords, weak replacements and replacing with the same password', async () => {
  const f = fixture(); try { const r = await ready(f); await request({ action: 'change_password', currentPassword: 'incorrect', password: initial }, r.cookie, 401); await request({ action: 'change_password', currentPassword: finalPassword, password: '123456' }, r.cookie, 400); await request({ action: 'change_password', currentPassword: finalPassword, password: finalPassword }, r.cookie, 400); assert.ok(await readPasswordSession(r.cookie)); for (const v of [null, false, 15, 'a'.repeat(20), 'á'.repeat(37)]) assert.throws(() => validateNewPassword(v)); } finally { f.close(); }
});
test('logout revokes the server session and cannot be replayed', async () => {
  const f = fixture(); try { const r = await ready(f); const logout = await request({ action: 'logout' }, r.cookie); assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/); assert.equal(await readPasswordSession(r.cookie), null); state.headers = new Headers({ cookie: r.cookie }); assert.equal((await PLATFORM_GET()).status, 401); } finally { f.close(); }
});
test('sessions stop at absolute expiry and idle timeout, and forged or duplicate cookies fail', async () => {
  const f = fixture(); try { const r = await ready(f); f.database.sql.prepare('UPDATE auth_sessions SET last_seen_at=?').run(Math.floor(Date.now()/1000) - 1801); assert.equal(await readPasswordSession(r.cookie), null); f.database.sql.prepare('UPDATE auth_sessions SET last_seen_at=?,expires_at=?').run(Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)-1); assert.equal(await readPasswordSession(r.cookie), null); assert.equal(await readPasswordSession('__Host-tutosebas-session='+'f'.repeat(64)), null); assert.equal(await readPasswordSession(r.cookie+'; '+r.cookie), null); } finally { f.close(); }
});
test('suspension revokes sessions; reactivation requires a new login', async () => {
  const f = fixture(); try { const r = await ready(f); state.env.APP_AUTH_MODE = 'sites'; signIn('teacher'); const suspend = await PLATFORM_POST(new Request(origin + '/api/platform', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'set_user_status', id: 'student', status: 'suspended' }) })); assert.equal(suspend.status, 200); state.env.APP_AUTH_MODE = 'password'; assert.equal(await readPasswordSession(r.cookie), null); await request({ action: 'login', email: 'student@example.test', password: finalPassword }, null, 401); f.database.sql.prepare("UPDATE profiles SET status='active' WHERE id='student'").run(); assert.equal(await readPasswordSession(r.cookie), null); await request({ action: 'login', email: 'student@example.test', password: finalPassword }); } finally { f.close(); }
});
test('teacher reset keeps academic records, revokes sessions, and requires a new private password', async () => {
  const f = fixture(); try { const r = await ready(f); f.database.add('history', 'attempt', 'Historial', 'completed', { score: 18 }, 'group', 'student'); await setRegisteredPassword('student', initial, administrator); assert.equal(await readPasswordSession(r.cookie), null); assert.equal(f.database.record('history').data.score, 18); await request({ action: 'login', email: 'student@example.test', password: finalPassword }, null, 401); const next = await request({ action: 'login', email: 'student@example.test', password: initial }); assert.equal(next.value.mustChangePassword, true); } finally { f.close(); }
});
test('student cannot assign passwords; administrator must reauthenticate before a reset', async () => {
  const f = fixture(); try { const student = await ready(f); await request({ action: 'set_password', profileId: 'teacher', password: initial }, student.cookie, 403); await assert.rejects(setRegisteredPassword('student', initial, { ...administrator, role: 'student' })); const teacher = await ready(f, 'teacher'); await request({ action: 'set_password', profileId: 'student', currentPassword: 'wrong', password: initial }, teacher.cookie, 401); await request({ action: 'set_password', profileId: 'student', currentPassword: finalPassword, password: initial }, teacher.cookie); assert.ok(await readPasswordSession(teacher.cookie)); } finally { f.close(); }
});
test('new credentials cannot be created for an unknown or suspended profile', async () => {
  const f = fixture(); try { await assert.rejects(setRegisteredPassword('missing', initial, administrator)); f.database.sql.prepare("UPDATE profiles SET status='suspended' WHERE id='student'").run(); await assert.rejects(setRegisteredPassword('student', initial, administrator)); assert.equal(f.calls.length, 0); } finally { f.close(); }
});
test('provider identity and email must both match; a token body alone is insufficient', async () => {
  const f = fixture(); try { await provision(f); state.env.APP_AUTH_MODE = 'password'; f.override(() => Response.json({ user: { id: crypto.randomUUID(), email: 'student@example.test', email_confirmed_at: '2026-01-01' } })); await request({ action: 'login', email: 'student@example.test', password: initial }, null, 401); f.override(() => Response.json({ user: { id: [...f.users.keys()][0], email: 'other@example.test', email_confirmed_at: '2026-01-01' } })); await request({ action: 'login', email: 'student@example.test', password: initial }, null, 401); assert.equal(f.database.sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n, 0); } finally { f.close(); }
});
test('rejects cross-site, missing Origin, and forwarded-host spoofing before the provider call', async () => {
  const f = fixture(); try { state.env.APP_AUTH_MODE = 'password'; for (const headers of [{ origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' }]) await request({ action: 'login', email: 'student@example.test', password: initial }, null, 403, headers); assert.equal(f.calls.length, 0); assert.throws(() => assertTrustedMutation(new Request(origin+'/api/platform', { headers: { origin: 'https://evil.test', host: 'evil.test', 'x-forwarded-host': 'evil.test' } }))); } finally { f.close(); }
});
test('rate limits apply before remote authentication and do not expose provider descriptions', async () => {
  const f = fixture(); try { await provision(f); state.env.APP_AUTH_MODE = 'password'; for (let i=0;i<8;i++) { const r=await request({ action: 'login', email: 'student@example.test', password: 'incorrect' }, null, 401); assert.ok(!JSON.stringify(r.value).includes('private provider error')); } await request({ action: 'login', email: 'student@example.test', password: initial }, null, 429); assert.equal(f.calls.filter(r=>r.path.endsWith('/token')).length, 8); } finally { f.close(); }
});
test('provider failure during reset fails closed and can be repaired by the teacher', async () => {
  const f = fixture(); try { const r = await ready(f); f.override(() => Response.json({ message: state.env.SUPABASE_SECRET_KEY }, { status: 500 })); await assert.rejects(setRegisteredPassword('student', initial, administrator), e=>e.status===503 && !e.message.includes(state.env.SUPABASE_SECRET_KEY)); assert.equal(await readPasswordSession(r.cookie), null); assert.equal(f.database.sql.prepare("SELECT state FROM auth_identities WHERE profile_id='student'").get().state, 'blocked'); f.override(null); await setRegisteredPassword('student', initial, administrator); assert.equal(f.database.sql.prepare("SELECT state FROM auth_identities WHERE profile_id='student'").get().state, 'ready'); } finally { f.close(); }
});
test('logical backup contains identity links, never password or active session tokens', async () => {
  const f = fixture(); try { await ready(f); state.env.APP_AUTH_MODE = 'sites'; signIn('teacher'); const backup = await BACKUP_GET(); assert.equal(backup.status, 200); const data = await backup.json(); assert.equal(data.schemaVersion, 3); assert.equal(data.authIdentities.length, 1); assert.equal(data.counts.authIdentities, 1); assert.ok(!('authSessions' in data)); const text = JSON.stringify(data); for (const secret of [initial, finalPassword, state.env.SUPABASE_SECRET_KEY, 'NEVER_RETURN_THIS']) assert.ok(!text.includes(secret)); } finally { f.close(); }
});
test('email changes and missing provider configuration invalidate independent sessions', async () => {
  const f = fixture(); try { const r=await ready(f); f.database.sql.prepare("UPDATE profiles SET email='new@example.test' WHERE id='student'").run(); assert.equal(await readPasswordSession(r.cookie), null); delete state.env.SUPABASE_SECRET_KEY; state.headers = new Headers({ cookie: r.cookie, 'oai-authenticated-user-email': administrator.email, 'oai-authenticated-user-id': 'auth-teacher' }); await assert.rejects(getApplicationUser(), e=>e.status===503); } finally { f.close(); }
});
test('question creation and approval reject implicit correct alternatives', async () => {
  const f = fixture(); try { f.database.add('subject', 'subject', 'Ciencias', 'published', { area: 'complexive', period: '2026-2027' }); const data={ area: 'complexive', period: '2026-2027', subject: 'Ciencias', topic: 'Tema 1', format: 'Selección directa', prompt: '¿Qué alternativa?', options: ['Uno','Dos','Tres','Cuatro'], explanation: 'Explicación académica.', source: 'Libro, sección 1' };
    for (const value of [null,false,'',[],{},'0']) { const r=await PLATFORM_POST(new Request(origin+'/api/platform', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_record', kind: 'question', title: 'Prueba', data: { ...data, correctIndex: value } }) })); assert.equal(r.status,400); }
    f.database.add('invalid-question','question','Revisión','pending',{...data,correctIndex:null}); const r=await PLATFORM_POST(new Request(origin+'/api/platform',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'update_status',id:'invalid-question',status:'approved'})}));assert.equal(r.status,400);assert.equal(f.database.record('invalid-question').status,'pending');
  } finally { f.close(); }
});
