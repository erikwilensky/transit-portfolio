// Display options per account (POST /api/auth/prefs { display }), against a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const stop = (srv) => new Promise((r) => { srv.p.once('exit', r); srv.p.kill(); });

test('display options per account: checked, your own only, kept with the language, across restarts', async () => {
  const port = await freePort();
  const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-display-'));
  const env = { PORT: String(port), DATA_DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' };
  let srv = await start(env);
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const me = (c) => json(req('GET', '/api/auth/me', null, c)).then((j) => j.user);
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const ada = (await json(req('POST', '/api/auth/setup', { token: link['ada.brook@example.org'].split('/setup/')[1], password: 'ada-pass-123' }))).cookie;
    assert.equal((await me(ada)).display, undefined, 'no choice yet');
    const big = { size: 'larger', contrast: true, font: true, motion: 'on' };
    const r = await json(req('POST', '/api/auth/prefs', { display: big }, ada));
    assert.equal(r.status, 200); assert.deepEqual(r.user.display, big);
    assert.equal(r.user.lang, undefined, 'the language is left alone');
    assert.equal((await json(req('POST', '/api/auth/prefs', { lang: 'th' }, ada))).status, 200);
    assert.deepEqual((await me(ada)).display, big, 'and a language change leaves the display alone');
    assert.equal((await me(ada)).lang, 'th');
    // Only known values, all four, nothing extra kept.
    for (const display of [{ ...big, size: 'huge' }, { ...big, contrast: 'yes' }, { size: 'large' }, [], 'large', null, { ...big, motion: 'fast' }]) {
      assert.equal((await req('POST', '/api/auth/prefs', { display }, ada)).status, 400, JSON.stringify(display));
    }
    assert.equal((await req('POST', '/api/auth/prefs', { display: { ...big, size: 'large', extra: 1 } }, ada)).status, 400);
    assert.equal((await req('POST', '/api/auth/prefs', {}, ada)).status, 400, 'nothing to set');
    assert.deepEqual((await me(ada)).display, big);
    assert.equal((await req('POST', '/api/auth/prefs', { display: big })).status, 401, 'signed out');
    // Your own only: the admin's account is untouched by Ada's choice.
    assert.equal((await me(ac)).display, undefined);
    await stop(srv);
    srv = await start(env);
    assert.deepEqual((await me(ada)).display, big, 'kept in accounts.json');
  } finally { srv.p.kill(); }
});
