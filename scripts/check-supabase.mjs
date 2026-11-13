// Read-only check of the Supabase credentials in .env / .env.local (or the
// host environment). Prints metadata and status codes only, never the key.
//   npm run check:supabase
import fs from 'node:fs';

const env = { ...process.env };
for (const file of ['.env', '.env.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = (env.SUPABASE_PROJECT_URL || '').replace(/\/+$/, '');
const key = env.SUPABASE_ANON_KEY || '';
const row = (k, v) => console.log(`${k.padEnd(30)} ${v}`);
let failed = false;
const check = (label, pass, detail = '') => {
  row(label, `${pass ? 'ok' : 'FAIL'}${detail ? `  ${detail}` : ''}`);
  if (!pass) failed = true;
};

check('SUPABASE_PROJECT_URL set', Boolean(url));
check('SUPABASE_ANON_KEY set', Boolean(key));
if (!url || !key) process.exit(1);

let host = '';
try {
  host = new URL(url).host;
} catch {
  check('URL parses', false);
  process.exit(1);
}
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  check('key role is anon', payload.role === 'anon', `(role: ${payload.role})`);
  check('key matches project', payload.ref === host.split('.')[0]);
  check('key not expired', !payload.exp || payload.exp * 1000 > Date.now());
} catch {
  check('key is a readable JWT', false);
}

const probe = async (path, apikey) => {
  try {
    return (await fetch(`${url}${path}`, { headers: { apikey }, signal: AbortSignal.timeout(15000) })).status;
  } catch (e) {
    return `network error (${e.cause?.code ?? e.message})`;
  }
};
const good = await probe('/auth/v1/settings', key);
const bad = await probe('/auth/v1/settings', 'wrong-key');
check('Supabase accepts the key', good === 200, `(HTTP ${good})`);
check('Supabase rejects a wrong key', bad === 401 || bad === 403, `(HTTP ${bad})`);

process.exit(failed ? 1 : 0);
