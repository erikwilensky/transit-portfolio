// Sign-up progress by homeroom and for advisors, against a real pilot server. Run: npm run test:server.
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

test('sign-up progress: counts per homeroom and staff; advisors see only their advisees', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-progress-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const p0 = await json(req('GET', '/api/admin/progress', null, ac));
    assert.equal(p0.status, 200);
    assert.deepEqual(p0.homerooms.map((r) => [r.name, r.year, r.students, r.signedUp, r.waiting]), [['8A', 8, 1, 0, 0], ['12B', 12, 2, 0, 2]], 'Year then homeroom; Hana has no account');

    // Fern signs up (and so signs in), adds a moment, and her family joins; Gus does nothing.
    const fern = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;
    const dan = (await setup(link['dan.ellis@example.org'], 'dan-pass-123')).cookie;
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const me = await json(req('GET', '/api/auth/me', null, fern));
    assert.ok(me.user.lastSignInAt, 'sign-in is noted on the account');
    const add = await json(req('POST', '/api/action', { fn: 'addStation', args: [me.user.studentId, { title: 'First moment', lineIds: [] }] }, fern));
    assert.equal(add.status, 200, JSON.stringify(add));
    const letters = await json(req('POST', '/api/admin/family/letters', { homerooms: ['12B'] }, ac));
    const fernLetter = letters.letters.find((l) => l.studentId === me.user.studentId);
    assert.equal((await json(req('POST', '/api/family/join', { token: fernLetter.url.split('/family/')[1], name: 'Fam Gale', email: 'fam@family.example', password: 'fam-pass-123' }))).status, 200);

    const p1 = await json(req('GET', '/api/admin/progress?homeroom=12B', null, ac));
    const r12 = p1.homerooms.find((r) => r.name === '12B');
    assert.deepEqual({ ...r12 }, { name: '12B', year: 12, students: 2, signedUp: 1, waiting: 1, active: 1, moments: 1, families: 1 });
    assert.deepEqual(p1.totals.students, 3); assert.equal(p1.totals.signedUp, 1);
    assert.deepEqual(p1.students.map((s) => [s.name, s.signedUp, s.active, s.moment, s.families, !!s.lastSignIn]), [['Fern Gale', true, true, true, 1, true], ['Gus Hale', false, false, false, 0, false]]);
    const staff = Object.fromEntries(p1.staff.rows.map((r) => [r.kind, r]));
    assert.deepEqual([staff.advisor.total, staff.advisor.signedUp, staff.advisor.active], [2, 1, 1], 'Ada and Finn advise; Ada signed up');
    assert.equal(p1.staff.total.total, 5); assert.equal(p1.staff.total.signedUp, 3);
    assert.equal((await json(req('GET', '/api/admin/progress', null, ac))).students, undefined, 'no student list without a homeroom');

    // Leadership may read it; nobody else.
    assert.equal((await req('GET', '/api/admin/progress', null, dan)).status, 200);
    for (const c of [ada, ben, fern]) assert.equal((await req('GET', '/api/admin/progress', null, c)).status, 403);
    assert.equal((await req('GET', '/api/admin/progress')).status, 401);

    // Ada: her two advisees only. Ben teaches nobody's advisory; Fern is a student.
    const a = await json(req('GET', '/api/advisor/progress', null, ada));
    assert.deepEqual([a.total, a.signedUp, a.families, a.active], [2, 1, 1, 1]);
    assert.deepEqual(a.students.map((s) => s.name), ['Fern Gale', 'Gus Hale']);
    assert.equal((await req('GET', '/api/advisor/progress', null, ben)).status, 403);
    assert.equal((await req('GET', '/api/advisor/progress', null, fern)).status, 403);
    assert.equal((await req('GET', '/api/advisor/progress', null, ac)).status, 403, 'the admin has no advisees');

    // A paused leaver is not counted.
    const gus = (await json(req('GET', '/api/admin/accounts', null, ac))).accounts.find((x) => x.email === 'gus.hale@example.org');
    await req('POST', `/api/admin/accounts/${gus.id}/pause`, {}, ac);
    assert.equal((await json(req('GET', '/api/admin/progress', null, ac))).homerooms.find((r) => r.name === '12B').students, 1);
  } finally { srv.p.kill(); }
});
