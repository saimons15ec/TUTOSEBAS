import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { unzipSync, strFromU8 } from 'fflate';
import { TestDatabase, state, signIn } from './helpers/platform-api.mjs';
const { privateBackupStream } = await import('../lib/private-backup.ts');
const { sha256Hex } = await import('../lib/security-storage.ts');
const { GET } = await import('../app/api/security/backup/full/route.ts');
const python = process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python3';
const validator = resolve('scripts/verify-private-backup.py');
const tempRoot = resolve('work/test-private-backup');
mkdirSync(tempRoot, { recursive: true });
async function fixture() {
  const database = new TestDatabase(); state.env.DB = database;
  database.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status) VALUES(?,?,?,?,?,?)').run('teacher','auth-teacher','profesor@example.test','Profesor','admin','active');
  database.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status) VALUES(?,?,?,?,?,?)').run('student','auth-student','student@example.test','Estudiante','student','active');
  database.add('period-current','period','2026-2027','published',{current:true}); database.add('sim-ef-pilot','simulator','Histórico','archived',{});
  const contents = new Map([['materials/shared/2026-10/private-one.pdf', new TextEncoder().encode('%PDF- archivo sintético')], ['materials/shared/2026-10/private-two.bin', new Uint8Array([0,1,2,3,4,255])]]);
  for (const [key, value] of contents) database.sql.prepare('INSERT INTO file_objects(object_key,kind,owner_id,original_name,stored_name,content_type,size_bytes,sha256,status) VALUES(?,?,?,?,?,?,?,?,?)').run(key,'material','teacher','Privado','privado.pdf','application/pdf',value.length,await sha256Hex(value),'active');
  const storage = { list: async () => ({ objects: [...contents].map(([key, value])=>({key,size:value.length})), truncated: false }), get: async key => contents.has(key) ? { arrayBuffer: async () => contents.get(key).slice().buffer } : null };
  state.env.BUCKET = storage; signIn('teacher');
  return { database, contents, storage, close: () => database.sql.close() };
}
async function bytes(f) { return new Uint8Array(await new Response((await privateBackupStream(f.database, f.storage)).stream).arrayBuffer()); }
test('complete private backup contains all tables, exact private bytes and a checksum manifest', async()=>{
  const f=await fixture();try{const archive=unzipSync(await bytes(f));const backup=JSON.parse(strFromU8(archive['backup.json']));const manifest=JSON.parse(strFromU8(archive['manifest.json']));assert.equal(backup.counts.profiles,2);assert.equal(manifest.objects.length,2);for(const item of manifest.objects){assert.deepEqual(archive[item.path],f.contents.get(item.key));assert.equal(await sha256Hex(archive[item.path]),item.sha256);}assert.ok(!('authSessions'in backup));assert.ok(!('rateLimits'in backup));}finally{f.close();}
});
test('restores a complete backup into isolated SQLite and checks files without touching the source',async()=>{
  const f=await fixture(),dir=mkdtempSync(join(tempRoot,'tutosebas-restore-'));try{const path=join(dir,'backup.zip');writeFileSync(path,await bytes(f));const before=f.database.sql.prepare('SELECT COUNT(*) AS n FROM records').get().n;const out=join(dir,'restored');const result=JSON.parse(execFileSync(python,[validator,path,'--restore-to',out],{encoding:'utf8'}));assert.equal(result.verified,true);assert.equal(result.restored,true);const restored=new DatabaseSync(join(out,'tutosebas.sqlite3'));assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,2);assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0);assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM records').get().n,before);restored.close();assert.ok(existsSync(join(out,'data-import.sql')));const manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));for(const item of manifest.objects)assert.deepEqual(new Uint8Array(readFileSync(join(out,item.path))),f.contents.get(item.key));assert.equal(f.database.sql.prepare('SELECT COUNT(*) AS n FROM records').get().n,before);const again=spawnSync(python,[validator,path,'--restore-to',out]);assert.equal(again.status,1);}finally{f.close();rmSync(dir,{recursive:true,force:true});}
});
test('complete backup endpoint rejects students and unauthenticated access',async()=>{
 const f=await fixture();try{signIn('student');assert.equal((await GET()).status,403);state.headers=new Headers();assert.equal((await GET()).status,401);signIn('teacher');const response=await GET();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('content-type'),'application/zip');assert.ok(unzipSync(new Uint8Array(await response.arrayBuffer()))['manifest.json']);}finally{f.close();}
});
test('does not silently omit a missing active file',async()=>{
 const f=await fixture();try{f.contents.delete([...f.contents.keys()][0]);await assert.rejects(privateBackupStream(f.database,f.storage),e=>e.status===409);}finally{f.close();}
});
test('a changed or corrupt file aborts the stream instead of producing a valid backup',async()=>{
 const f=await fixture();try{f.database.sql.prepare('UPDATE file_objects SET sha256=?').run('f'.repeat(64));await assert.rejects(bytes(f));}finally{f.close();}
});
test('verification rejects a truncated ZIP',async()=>{
 const f=await fixture(),dir=mkdtempSync(join(tempRoot,'tutosebas-bad-backup-'));try{const archive=await bytes(f);const path=join(dir,'truncated.zip');writeFileSync(path,archive.subarray(0,archive.length-100));assert.equal(spawnSync(python,[validator,path]).status,1);}finally{f.close();rmSync(dir,{recursive:true,force:true});}
});
