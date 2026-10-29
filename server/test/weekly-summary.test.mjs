// The "This week" summary: the week computation (src/week.js) and the dates GET /api/advisor/progress adds for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { atInWeek, dayIn, inWeek, isMonday, weekday, weekLabel, weekOf } from '../../src/week.js';

test('a week runs Monday to Sunday, from any day in it', () => {
  for (const d of ['2026-10-26', '2026-10-28', '2026-10-31', '2026-11-01']) assert.deepEqual(weekOf(d), { from: '2026-10-26', to: '2026-11-01', upto: d }, d);
  assert.deepEqual(weekOf('2026-11-02'), { from: '2026-11-02', to: '2026-11-08', upto: '2026-11-02' }, 'Monday starts a new week');
  assert.equal(weekday('2026-10-26'), 0); assert.equal(weekday('2026-11-01'), 6);
  assert.ok(isMonday('2026-10-26') && !isMonday('2026-10-29') && !isMonday('2026-11-01'));
});

test('last week, across a month and a year end', () => {
  assert.deepEqual(weekOf('2026-10-29', 1), { from: '2026-10-19', to: '2026-10-25', upto: '2026-10-25' }, 'a past week runs to its Sunday');
  assert.deepEqual(weekOf('2026-11-03', 1), { from: '2026-10-26', to: '2026-11-01', upto: '2026-11-01' });
  assert.deepEqual(weekOf('2027-01-01'), { from: '2026-12-28', to: '2027-01-03', upto: '2027-01-01' });
  assert.deepEqual(weekOf('2027-01-04', 1), { from: '2026-12-28', to: '2027-01-03', upto: '2027-01-03' });
  assert.deepEqual(weekOf('2028-03-01'), { from: '2028-02-28', to: '2028-03-05', upto: '2028-03-01' }, 'a leap year');
  assert.equal(weekLabel(weekOf('2026-10-29')), '26 Oct to 1 Nov');
});

test('days and times are counted in Bangkok, and the current week stops at today', () => {
  const w = weekOf('2026-10-29');
  assert.ok(inWeek('2026-10-26', w) && inWeek('2026-10-29', w));
  assert.ok(!inWeek('2026-10-30', w), 'a moment dated later this week has not happened yet');
  assert.ok(!inWeek('2026-10-25', w) && !inWeek(null, w));
  assert.equal(dayIn('2026-10-25T17:30:00Z'), '2026-10-26', 'Sunday 17:30 UTC is Monday 00:30 in Bangkok');
  assert.ok(atInWeek('2026-10-25T17:30:00Z', w), 'so it counts in the new week');
  assert.ok(!atInWeek('2026-10-25T16:59:00Z', w), 'one minute before Bangkok midnight is last week');
  assert.ok(atInWeek('2026-10-25T16:59:00Z', weekOf('2026-10-29', 1)));
  assert.ok(!atInWeek(null, w));
});

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

test('advisor progress says when each advisee signed up and when their family joined', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-weekly-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const t0 = new Date().toISOString();
    const fern = await setup(link['fern.gale@example.org'], 'fern-pass-123');
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;
    const fernId = (await json(req('GET', '/api/auth/me', null, fern.cookie))).user.studentId;
    const letters = await json(req('POST', '/api/admin/family/letters', { homerooms: ['12B'] }, ac));
    const tok = letters.letters.find((l) => l.studentId === fernId).url.split('/family/')[1];
    assert.equal((await json(req('POST', '/api/family/join', { token: tok, name: 'Fam Gale', email: 'fam@family.example', password: 'fam-pass-123' }))).status, 200);
    const a = await json(req('GET', '/api/advisor/progress', null, ada));
    const f = a.students.find((s) => s.name === 'Fern Gale'), g = a.students.find((s) => s.name === 'Gus Hale');
    assert.ok(f.signedUpAt >= t0 && f.familyAt.length === 1 && f.familyAt[0] >= t0, JSON.stringify(f));
    assert.deepEqual([g.signedUpAt, g.familyAt], [null, []], 'nothing yet for Gus');
    // A new password later keeps the first sign-up time.
    const before = f.signedUpAt;
    assert.equal((await req('POST', '/api/auth/password', { current: 'fern-pass-123', password: 'fern-pass-456' }, fern.cookie)).status, 200);
    assert.equal((await json(req('GET', '/api/advisor/progress', null, ada))).students.find((s) => s.name === 'Fern Gale').signedUpAt, before);
    assert.equal((await req('GET', '/api/advisor/progress', null, fern.cookie)).status, 403, 'students still cannot read it');
  } finally { srv.p.kill(); }
});
