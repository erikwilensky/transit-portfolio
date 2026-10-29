// School overview: aggregate counts, the fewer-than-5 rule and who may read it, against a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
// The fixture (Year 12: 2 students, Year 8: 1) plus 9C (6 students) and 10A (5 students).
const extra = (room, year, n, from) => Array.from({ length: n }, (_, i) => ({ id: `S${from + i}`, name: `Pupil ${room}${i}`, year, programme: 'MYP', homeroom: room, advisorId: 'T105', email: `p${from + i}@example.org` }));
const ROSTER = { ...BASE, students: [...BASE.students, ...extra('9C', 9, 6, 3000), ...extra('10A', 10, 5, 4000)] };
const SMALL = 'fewer than 5';
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

test('school overview: counts by Year and line, fewer than 5 hidden, leadership/coordinator/admin only', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-overview-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const act = async (cookie, fn, args) => { const r = await json(req('POST', '/api/action', { fn, args }, cookie)); assert.equal(r.status, 200, JSON.stringify(r)); return r; };
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const setup = async (email) => (await json(req('POST', '/api/auth/setup', { token: link[email].split('/setup/')[1], password: 'pass-word-123' }))).cookie;

    // Five of 9C sign up and add a Science moment (one with a reflection, one asks Ada to endorse); Fern adds a Computing one.
    const nine = [];
    for (let i = 0; i < 5; i++) {
      const c = await setup(`p${3000 + i}@example.org`); nine.push(c);
      await act(c, 'addStation', [`S${3000 + i}`, { title: `Moment ${i}`, lineIds: ['science'], ...(i === 0 ? { reflection: 'I learned a lot.' } : {}), ...(i === 1 ? { requestFrom: 'T100' } : {}) }]);
    }
    const fern = await setup('fern.gale@example.org');
    await act(fern, 'addStation', ['S2001', { title: 'Robot', lineIds: ['computing'] }]);
    const ada = await setup('ada.brook@example.org');
    const rq = (await json(req('GET', '/api/state', null, ada))).snapshot.store.requests.find((r) => r.studentId === 'S3001');
    await act(ada, 'endorse', [[rq.id], 'T100', 'Good work.']);
    const dan = await setup('dan.ellis@example.org'); // leadership
    const ben = await setup('ben.carter@example.org'); // teacher

    const o = await json(req('GET', '/api/overview', null, ac));
    assert.equal(o.status, 200);
    assert.deepEqual(o.ranges.map((r) => r.id), ['term', 'weeks4']);
    const term = o.ranges[0], y = Object.fromEntries(term.years.map((r) => [r.year, r]));
    assert.deepEqual(term.years.map((r) => r.year), [7, 8, 9, 10, 11, 12, 13]);
    assert.deepEqual({ ...y[9] }, { year: 9, students: 6, signedUp: 5, active: 5, withMoment: 5, moments: 5, perStudent: 0.8, reflections: 1, endorsements: 1, families: 0 });
    assert.deepEqual({ ...y[10] }, { year: 10, students: 5, signedUp: 0, active: 0, withMoment: 0, moments: 0, perStudent: 0, reflections: 0, endorsements: 0, families: 0 }, 'zero is shown');
    for (const k of ['students', 'signedUp', 'moments', 'perStudent']) assert.equal(y[12][k], SMALL, `Year 12 (2 students): ${k} hidden`);
    assert.equal(y[8].students, SMALL);
    assert.equal(y[7].students, 0);
    assert.equal(term.totals.students, 14); assert.equal(term.totals.signedUp, 6); assert.equal(term.totals.moments, 6);
    assert.equal(term.totals.withMoment, 6); assert.equal(term.totals.families, 0);
    const line = Object.fromEntries(term.lines.map((l) => [l.id, l]));
    assert.deepEqual([line.science.moments, line.science.endorsedPct], [5, 20]);
    assert.deepEqual([line.computing.moments, line.computing.endorsedPct], [SMALL, SMALL], 'one student on Computing');
    assert.equal(line.arts?.moments ?? 0, 0);
    const last = term.weeks.at(-1);
    assert.equal(last.to, o.today); assert.equal(last.moments, 6);
    assert.equal(o.ranges[1].weeks.length, 4);
    assert.deepEqual(o.quiet, [{ name: '10A', pct: 0 }], '9C is 83% active; 12B and 8A are under 5');

    // Nothing in the answer names a student, a homeroom outside the quiet list, or a teacher.
    const body = JSON.stringify(o);
    for (const s of ROSTER.students) { assert.ok(!body.includes(s.name), `no ${s.name}`); assert.ok(!body.includes(s.id), `no ${s.id}`); }
    for (const t of ROSTER.teachers) assert.ok(!body.includes(t.name));
    assert.ok(!body.includes('12B') && !body.includes('9C'));

    // CSV.
    const csv = await req('GET', '/api/overview?format=csv&range=weeks4', null, dan);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /school-overview-last-4-weeks-/);
    const text = await csv.text();
    assert.match(text, /^\ufeff?School overview: last 4 weeks/);
    assert.match(text, /\r\nYear 9,6,5,5,5,5,0\.8,1,1,0\r\n/);
    assert.match(text, /\r\nYear 12,fewer than 5,fewer than 5/);
    assert.match(text, /\r\n10A,0\r\n/);

    // Who may read it: leadership, a coordinator, the admin. Not a teacher, a student, or nobody.
    assert.equal((await req('GET', '/api/overview', null, dan)).status, 200);
    const coord = (await json(req('POST', '/api/admin/accounts', { email: 'eve@example.org', name: 'Ms Eve Fong', kind: 'coordinator', teacherId: 'T104' }, ac)));
    if (coord.status === 201 && coord.setupUrl) {
      const eve = (await json(req('POST', '/api/auth/setup', { token: coord.setupUrl.split('/setup/')[1], password: 'pass-word-123' }))).cookie;
      assert.equal((await req('GET', '/api/overview', null, eve)).status, 200, 'a coordinator may read it');
    } else assert.fail(`could not make a coordinator: ${JSON.stringify(coord)}`);
    assert.equal((await req('GET', '/api/overview', null, ben)).status, 403, 'a teacher gets 403');
    assert.equal((await req('GET', '/api/overview', null, ada)).status, 403, 'an advisor gets 403');
    assert.equal((await req('GET', '/api/overview', null, nine[0])).status, 403, 'a student gets 403');
    assert.equal((await req('GET', '/api/overview?format=csv', null, nine[0])).status, 403);
    assert.equal((await req('GET', '/api/overview')).status, 401);
  } finally { srv.p.kill(); }
});
