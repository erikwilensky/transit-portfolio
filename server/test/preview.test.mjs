// Admin "See as": GET /api/admin/preview/:accountId, against a real pilot server. Run: npm run test:server.
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

test('See as: admin only, that account\'s scoped record, no secrets, audited', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-preview-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; const text = await r.text(); return { status: r.status, text, ...JSON.parse(text || '{}'), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fern = await setup(link['fern.gale@example.org'], 'fern-pass-123');
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const ada = await setup(link['ada.brook@example.org'], 'ada-pass-123');
    const accounts = (await json(req('GET', '/api/admin/accounts', null, ac))).accounts;
    const idOf = (email) => accounts.find((a) => a.email === email).id;

    // A student: their own record only, as /api/auth/me would give it to them.
    const s = await json(req('GET', `/api/admin/preview/${idOf('fern.gale@example.org')}`, null, ac));
    assert.equal(s.status, 200);
    assert.equal(s.user.name, 'Fern Gale');
    assert.equal(s.user.kind, 'student');
    assert.equal(s.user.record.student.id, s.user.studentId);
    assert.deepEqual(s.snapshot.store.students.map((x) => x.id), [s.user.studentId]);
    assert.equal(typeof s.rev, 'number');
    for (const secret of ['"password"', '"salt"', '"hash"', '"setup"', 'fern-pass-123', 'tp_session', fern.cookie.split('=')[1]]) assert.ok(!s.text.includes(secret), `no ${secret} in the reply`);

    // An advisor: their advisees.
    const a = await json(req('GET', `/api/admin/preview/${idOf('ada.brook@example.org')}`, null, ac));
    assert.equal(a.status, 200);
    assert.equal(a.user.kind, 'advisor');
    assert.deepEqual(a.snapshot.store.students.map((x) => x.name).sort(), ['Fern Gale', 'Gus Hale']);
    assert.ok(!a.text.includes(ada.cookie.split('=')[1]) && !a.text.includes('"hash"'));

    // Not for a teacher, a student or anyone signed out; an unknown account is 404.
    assert.equal((await req('GET', `/api/admin/preview/${idOf('fern.gale@example.org')}`, null, ben)).status, 403);
    assert.equal((await req('GET', `/api/admin/preview/${idOf('ben.carter@example.org')}`, null, fern.cookie)).status, 403);
    assert.equal((await req('GET', `/api/admin/preview/${idOf('fern.gale@example.org')}`)).status, 401);
    assert.equal((await req('GET', '/api/admin/preview/u-nobody', null, ac)).status, 404);

    // The admin is still the admin, and each start is in the audit log (who, whom, when).
    assert.equal((await json(req('GET', '/api/auth/me', null, ac))).user.name, 'Pat Admin');
    const me = (await json(req('GET', '/api/auth/me', null, ac))).user.id;
    const lines = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.action === 'preview');
    assert.deepEqual(lines.map((l) => [l.by, l.accountId, l.kind]), [[me, idOf('fern.gale@example.org'), 'student'], [me, idOf('ada.brook@example.org'), 'advisor']]);
    assert.ok(lines.every((l) => !Number.isNaN(Date.parse(l.at))));
  } finally { srv.p.kill(); }
});
