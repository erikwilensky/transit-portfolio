// Each person's own language (POST /api/auth/prefs), against a real pilot server. Run: npm run test:server.
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

test('language per account: your own only, kept on the account, across restarts; the shared setting is not for families', async () => {
  const port = await freePort();
  const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-prefs-'));
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
    const [fern, gus] = (await json(req('POST', '/api/advisor/family/letters', {}, ada))).letters;
    const join = (l, body) => json(req('POST', '/api/family/join', { token: l.url.split('/#/family/')[1], ...body }));
    const mo = await join(fern, { name: 'Mo Gale', email: 'mo@family.example', password: 'mo-pass-1234' });
    const kim = await join(gus, { name: 'Kim Hale', email: 'kim@family.example', password: 'kim-pass-1234' });
    assert.equal(mo.status, 200); assert.equal(kim.status, 200);
    assert.equal((await me(mo.cookie)).lang, undefined, 'no choice yet');

    // Two parents choose different languages; each keeps their own.
    const a = await json(req('POST', '/api/auth/prefs', { lang: 'th' }, mo.cookie));
    assert.equal(a.status, 200); assert.equal(a.user.lang, 'th');
    assert.equal((await json(req('POST', '/api/auth/prefs', { lang: 'en' }, kim.cookie))).user.lang, 'en');
    assert.equal((await me(mo.cookie)).lang, 'th');
    assert.equal((await me(kim.cookie)).lang, 'en');

    // Only your own: no account id is taken, so naming someone else changes nothing of theirs.
    const kimId = (await me(kim.cookie)).id;
    const sneaky = await json(req('POST', '/api/auth/prefs', { lang: 'th', id: kimId, accountId: kimId }, mo.cookie));
    assert.equal(sneaky.user.id, (await me(mo.cookie)).id);
    assert.equal((await me(kim.cookie)).lang, 'en', "the other parent's language is unchanged");
    assert.equal((await req('POST', '/api/auth/prefs', { lang: 'th' })).status, 401, 'signed out');
    assert.equal((await req('POST', '/api/auth/prefs', { lang: 'fr' }, kim.cookie)).status, 400);
    assert.equal((await me(kim.cookie)).lang, 'en');
    // The admin's own account too, and nobody else's.
    assert.equal((await json(req('POST', '/api/auth/prefs', { lang: 'th' }, ac))).user.kind, 'admin');
    assert.equal((await me(mo.cookie)).lang, 'th'); assert.equal((await me(kim.cookie)).lang, 'en');

    // The demo's one shared family language is not something a family (or a teacher) can change in a pilot.
    assert.equal((await req('POST', '/api/action', { fn: 'setLang', args: ['th'], rec: [] }, mo.cookie)).status, 403);
    assert.equal((await req('POST', '/api/action', { fn: 'setLang', args: ['th'], rec: [] }, ada)).status, 403);

    // Kept in accounts.json: still there after a restart, and in the admin's list (never the hash).
    await stop(srv);
    srv = await start(env);
    assert.equal((await me(mo.cookie)).lang, 'th');
    assert.equal((await me(kim.cookie)).lang, 'en');
    const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'accounts.json'), 'utf8'));
    assert.deepEqual(saved.filter((x) => x.kind === 'parent').map((x) => [x.email, x.lang]).sort(), [['kim@family.example', 'en'], ['mo@family.example', 'th']]);
  } finally { srv.p.kill(); }
});
