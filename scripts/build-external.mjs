import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const path = resolve(process.argv[2] || 'deployment/cloudflare.production.json');
const settings = JSON.parse(readFileSync(path, 'utf8'));
if (settings.vars?.APP_DEPLOYMENT !== 'independent' || settings.vars?.APP_AUTH_MODE !== 'password') throw new Error('Independent hosting must explicitly require password authentication.');
if (settings.vars?.SUPABASE_SECRET_KEY || settings.vars?.SUPABASE_PUBLISHABLE_KEY) throw new Error('Configure API keys as runtime secrets, never in the deployment JSON.');
if (!settings.d1_databases?.some(row=>row.binding==='DB') || !settings.r2_buckets?.some(row=>row.binding==='BUCKET')) throw new Error('DB and BUCKET bindings are required.');
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit', env: { ...process.env, TUTOSEBAS_BUILD_TARGET: 'independent', TUTOSEBAS_EXTERNAL_CONFIG: path },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
