// Roster import and the clean pilot start. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = (f) => fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster', f), 'utf8');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-roster-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');

test('TP_START=empty: the school lines, nobody fictional, every key still there', () => {
  const s = api.getStore();
  assert.deepEqual(s.lines.map((l) => l.id), ['science', 'computing', 'environment', 'sport', 'service', 'music', 'design', 'languages', 'art']);
  for (const k of ['students', 'teachers', 'events', 'reflections', 'endorsements', 'requests', 'prompts', 'applications', 'inbox', 'pending', 'alumEvents', 'classTasks', 'roster', 'classes', 'enrolments']) assert.deepEqual(s[k], [], k);
  for (const k of ['drafts', 'notes', 'letters', 'github', 'casProjects']) assert.deepEqual(s[k], {}, k);
  assert.ok(s.integrations.length && s.integrations.every((i) => i.itemCount === 0));
  assert.ok(fs.existsSync(path.join(process.env.DATA_DIR, 'state.json')), 'saved at once');
  const json = api.snapshot();
  for (const name of ['Maya', 'Whitfield', 'Nair']) assert.ok(!json.includes(name), name);
});

test('importRoster: adds, then re-imports without duplicates', () => {
  const { roster } = api.parseRoster(FX('roster.json'));
  const first = api.importRoster(roster);
  assert.deepEqual(first.added, { teachers: 6, students: 3, classes: 5, enrolments: 7 });
  const s = api.getStore();
  assert.equal(s.classes.length, 5); assert.equal(s.enrolments.length, 7);
  assert.deepEqual(Object.keys(s.classes[0]).sort(), ['id', 'level', 'lineId', 'name', 'subject', 'teacherIds', 'year']);
  assert.deepEqual(Object.keys(s.enrolments[0]).sort(), ['classId', 'from', 'studentId', 'to']);
  assert.equal(api.getStudent('S2001').grade, 11);
  assert.deepEqual(api.getTeacher('T100').roles, ['teacher', 'advisor']);
  assert.ok(api.getDrafts().S2001, 'drafts list made');
  const again = api.importRoster(api.parseRoster(FX('roster.json')).roster);
  assert.deepEqual(again.added, { teachers: 0, students: 0, classes: 0, enrolments: 0 });
  assert.equal(s.students.length, 3);
  assert.throws(() => api.importRoster({ format: 'transit-roster/1', teachers: [], students: [{ id: 'x', name: 'x', year: 9, programme: 'MYP', homeroom: '9A', advisorId: 'NOPE' }], classes: [], enrolments: [] }), /problems/);
});

test('importRoster replays to the same record (runAction), and old saves without class lists load', () => {
  const before = api.snapshot();
  api.runAction('importRoster', [api.parseRoster(FX('roster.json')).roster], []);
  assert.equal(JSON.parse(api.snapshot()).store.classes.length, JSON.parse(before).store.classes.length);
  const old = JSON.parse(before); delete old.store.classes; delete old.store.enrolments;
  api.restore(JSON.stringify(old));
  assert.deepEqual(api.getStore().classes, []); assert.deepEqual(api.getStore().enrolments, []);
  api.restore(before);
  assert.equal(api.getClasses().length, 5);
});

test('canAct: importRoster is admin-only', () => {
  assert.equal(canAct({ kind: 'admin' }, 'importRoster', [{}]), true);
  assert.equal(canAct({ kind: 'leadership', teacherId: 'T103' }, 'importRoster', [{}]), false);
  assert.equal(canAct({ kind: 'student', studentId: 'S2001' }, 'importRoster', [{}]), false);
});

// ── The route, against a real pilot server ──
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1], out: () => out }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

test('POST /api/admin/roster: preview, import, sign-in links once per person', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-roster-srv-')), TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  try {
    const r0 = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }) });
    const cookie = r0.headers.get('set-cookie').split(';')[0];
    const post = (body, c = cookie) => fetch(`${U}/api/admin/roster`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: c }, body: JSON.stringify(body) });
    const state0 = await (await fetch(`${U}/api/state`, { headers: { cookie } })).json();
    assert.equal(state0.snapshot.store.students.length, 0, 'clean start');

    const bad = await post({ roster: { ...JSON.parse(FX('roster.json')), enrolments: [{ studentId: 'S404', classId: 'C-BIO12' }] } });
    assert.equal(bad.status, 400);
    assert.deepEqual((await bad.json()).missing, { students: ['S404'] });

    const csv = { teachers: FX('teachers.csv'), students: FX('students.csv'), classes: FX('classes.csv'), enrolments: FX('enrolments.csv') };
    const dry = await (await post({ roster: csv, dryRun: true })).json();
    assert.deepEqual(dry.summary.added, { teachers: 6, students: 3, classes: 5, enrolments: 7 });
    assert.equal(dry.newAccounts.toCreate, 7, '5 staff and 2 students have emails');
    assert.equal((await (await fetch(`${U}/api/state`, { headers: { cookie } })).json()).snapshot.store.students.length, 0, 'a preview changes nothing');

    const j = await (await post({ roster: csv })).json();
    assert.equal(j.newAccounts.created.length, 7);
    const byEmail = Object.fromEntries(j.newAccounts.created.map((a) => [a.email, a]));
    assert.equal(byEmail['ada.brook@example.org'].role, 'Advisor');
    assert.equal(byEmail['dan.ellis@example.org'].role, 'Leadership');
    assert.equal(byEmail['chloe.dumas@example.org'].role, 'University counsellor');
    assert.equal(byEmail['fern.gale@example.org'].role, 'Student');
    assert.match(byEmail['fern.gale@example.org'].setupUrl, /^http:\/\/localhost:\d+\/#\/setup\/[\w-]{20,}$/);
    const fern = j.accounts.find((a) => a.email === 'fern.gale@example.org');
    assert.equal(fern.studentId, 'S2001'); assert.equal(fern.kind, 'student');
    assert.equal(j.accounts.find((a) => a.email === 'ada.brook@example.org').teacherId, 'T100');

    // The link works: Fern sets a password and signs in as her own record.
    const tok = byEmail['fern.gale@example.org'].setupUrl.split('/setup/')[1];
    const r1 = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, password: 'fern-pass-123' }) });
    assert.equal((await r1.json()).user.record.student.name, 'Fern Gale');
    const fernCookie = r1.headers.get('set-cookie').split(';')[0];
    assert.equal((await post({ roster: csv }, fernCookie)).status, 403, 'only an admin imports');
    const act = await fetch(`${U}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: fernCookie }, body: JSON.stringify({ fn: 'importRoster', args: [JSON.parse(FX('roster.json'))] }) });
    assert.equal(act.status, 403);

    // Again: nothing added, nobody gets a second account.
    const k = await (await post({ roster: JSON.parse(FX('roster.json')) })).json();
    assert.deepEqual(k.summary.added, { teachers: 0, students: 0, classes: 0, enrolments: 0 });
    assert.equal(k.newAccounts.created.length, 0); assert.equal(k.newAccounts.skipped, 7);
    const st = (await (await fetch(`${U}/api/state`, { headers: { cookie } })).json()).snapshot.store;
    assert.equal(st.students.length, 3); assert.equal(st.classes.length, 5); assert.equal(st.enrolments.length, 7);
  } finally { srv.p.kill(); }
});

test('demo mode ignores TP_START=empty', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-roster-demo-')), TP_MODE: 'demo', TP_START: 'empty', LOG_REQUESTS: '0' });
  try {
    const st = (await (await fetch(`http://localhost:${port}/api/state`)).json()).snapshot.store;
    assert.ok(st.students.length > 5);
    assert.equal((await fetch(`http://localhost:${port}/api/admin/roster`, { method: 'POST', body: '{}' })).status, 403);
  } finally { srv.p.kill(); }
});
