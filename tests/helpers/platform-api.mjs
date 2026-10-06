import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Exercise the real API, context, authorization and grading against isolated SQLite.
// Only the Cloudflare binding and request-header bridges are provided by this test.
const root = fileURLToPath(new URL('../../', import.meta.url));
export const state = { env: { ADMIN_EMAILS: 'profesor@example.test' }, headers: new Headers() };
globalThis.__tutosebasExamCheck = state;
const virtual = text => `data:text/javascript,${encodeURIComponent(text)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') return { url: virtual('export const env = globalThis.__tutosebasExamCheck.env;'), shortCircuit: true };
    if (specifier === 'next/headers') return { url: virtual('export async function headers() { return globalThis.__tutosebasExamCheck.headers; }'), shortCircuit: true };
    if (specifier === 'next/navigation') return { url: virtual('export function redirect(url) { throw new Error(`Unexpected redirect: ${url}`); }'), shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = resolve(root, specifier.slice(2));
      const found = [path, `${path}.ts`, `${path}.tsx`].find(file => existsSync(file));
      assert.ok(found, `Unresolved alias ${specifier}`);
      return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/app/data/quiz.json')) return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    return nextLoad(url, context);
  },
});
export const { POST, GET } = await import(pathToFileURL(`${root}/app/api/platform/route.ts`).href);
export const { QUESTION_FORMATS } = await import(pathToFileURL(`${root}/lib/question-blocks.ts`).href);

export class TestDatabase {
  sql = new DatabaseSync(':memory:');
  constructor() { const journal = JSON.parse(readFileSync(`${root}/drizzle/meta/_journal.json`, 'utf8')); for (const entry of journal.entries) this.sql.exec(readFileSync(`${root}/drizzle/${entry.tag}.sql`, 'utf8')); }
  prepare(query) {
    const make = values => ({
      query, values, bind: (...input) => make(input),
      first: async column => { const row = this.sql.prepare(query).get(...values); return row ? column ? row[column] : row : null; },
      all: async () => ({ results: this.sql.prepare(query).all(...values), success: true, meta: {} }),
      run: async () => ({ success: true, meta: { changes: Number(this.sql.prepare(query).run(...values).changes) } }),
    });
    return make([]);
  }
  async batch(statements) {
    this.sql.exec('BEGIN');
    try { const results = statements.map(statement => { const prepared = this.sql.prepare(statement.query); return prepared.columns().length ? { success: true, results: prepared.all(...statement.values), meta: {} } : { success: true, meta: { changes: Number(prepared.run(...statement.values).changes) } }; }); this.sql.exec('COMMIT'); return results; }
    catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
  add(id, kind, title, status, data, group = null, owner = 'teacher') {
    this.sql.prepare('INSERT INTO records(id,kind,title,status,data_json,group_id,created_by) VALUES(?,?,?,?,?,?,?)').run(id, kind, title, status, JSON.stringify(data), group, owner);
  }
  record(id) { const row = this.sql.prepare('SELECT * FROM records WHERE id=?').get(id); return row && { ...row, data: JSON.parse(row.data_json) }; }
}

export const { POST: FILE_POST, GET: FILE_GET } = await import(pathToFileURL(`${root}/app/api/files/route.ts`).href);
export const { POST: RECONCILE_POST } = await import(pathToFileURL(`${root}/app/api/security/files/reconcile/route.ts`).href);
export function signIn(identity = 'teacher') {
  state.headers = new Headers({ 'oai-authenticated-user-id': `auth-${identity}`, 'oai-authenticated-user-email': `${identity === 'teacher' ? 'profesor' : identity}@example.test` });
}
