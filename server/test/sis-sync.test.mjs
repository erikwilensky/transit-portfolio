// Class list sync from the SIS (server/sis.mjs, server/routes/67-sis.mjs), against a mock SIS on localhost: a good feed, a
// mapped feed (SIS_MAP), a bad token, a 10% drop refused, and applying a new year's report runs the year handover. The
// token never reaches a data file, the activity log or the browser. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
const TOKEN = 'sis-secret-token-5d1f0c';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-sis-unit-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const S = await import('../sis.mjs');

// ── The mock SIS: /feed serves `feeds.main`, /mapped `feeds.mapped`; any other token is 401 ──
const feeds = { main: FX, mapped: null };
const seen = [];
const sis = http.createServer((req, res) => {
  seen.push(req.headers.authorization);
  if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401); return res.end('{"error":"bad token"}'); }
  const body = feeds[req.url.slice(1) === 'feed' ? 'main' : 'mapped'];
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
}).listen(0); sis.unref();
const SIS = `http://localhost:${sis.address().port}`;

// The fixture as another SIS might send it: its own names, US grades, nested class lists.
feeds.mapped = {
  meta: { year: '2026-27', generated: '2026-10-20T08:00:00Z' },
  staff: FX.teachers.map((t) => ({ staff_id: t.id, full_name: t.name, contact: { email: t.email }, roles: t.roles.map((r) => r.toUpperCase()).join('|'), dept: t.department })),
  pupils: FX.students.map((s) => ({ pupil_id: s.id, name: { display: s.name }, grade: s.year - 1, prog: s.programme, form: s.homeroom, tutor: { id: s.advisorId }, email: s.email })),
  sections: FX.classes.map((c) => ({ code: c.id, title: c.name, subject: c.subject, grade: c.year - 1, level: c.level, line: c.line, teachers: c.teacherIds.map((id) => ({ id })), pupils: FX.enrolments.filter((e) => e.classId === c.id).map((e) => ({ pupil_id: e.studentId, start: e.from })) })),
};
const MAP = {
  format: 'sis-map/1',
  school: { name: '=NIST International School', academicYear: 'meta.year', exportedAt: 'meta.generated', source: '=SIS API' },
  teachers: { from: 'staff', fields: { id: 'staff_id', name: 'full_name', email: 'contact.email', roles: { path: 'roles', split: '|', map: { TEACHER: 'teacher', ADVISOR: 'advisor', COUNSELLOR: 'counsellor', COORDINATOR: 'coordinator', LEADERSHIP: 'leadership' } }, department: 'dept' } },
  students: { from: 'pupils', fields: { id: 'pupil_id', name: 'name.display', year: { path: 'grade', add: 1 }, programme: 'prog', homeroom: 'form', advisorId: 'tutor.id' } },
  classes: { from: 'sections', fields: { id: 'code', name: 'title', year: { path: 'grade', add: 1 }, teacherIds: 'teachers[].id' } },
  enrolments: { from: 'sections[].pupils[]', fields: { studentId: 'pupil_id', classId: '^.code', from: 'start' } },
};

test('mapFeed: dotted paths, lists, the item one level up, fixed values, map/add/split', () => {
  const r = S.mapFeed(feeds.mapped, MAP);
  assert.equal(r.format, 'transit-roster/1');
  assert.deepEqual(r.school, { name: 'NIST International School', academicYear: '2026-27', exportedAt: '2026-10-20T08:00:00Z', source: 'SIS API' });
  assert.deepEqual(r.teachers[0], { id: 'T100', name: 'Ms Ada Brook', email: 'ada.brook@example.org', roles: ['teacher', 'advisor'], department: 'Biology' });
  assert.equal(r.students[2].year, 8); assert.equal(r.students[0].advisorId, 'T100');
  assert.deepEqual(r.classes[0].teacherIds, ['T100']); assert.equal(r.classes[4].line, 'computing');
  assert.equal(r.enrolments.length, 7); assert.deepEqual(r.enrolments[0], { studentId: 'S2001', classId: 'C-BIO12', from: '2026-08-12' });
  assert.throws(() => S.mapFeed({}, { ...MAP, classes: {} }), /no "from" for classes/);
});

test('the nightly time: once a day, at or after SIS_SYNC_AT in Bangkok, within 3 hours', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(S.dueDay(at('2026-10-30T18:59:00Z'), '02:00', 'Asia/Bangkok', null), null, '01:59 Bangkok');
  assert.equal(S.dueDay(at('2026-10-30T19:00:00Z'), '02:00', 'Asia/Bangkok', null), '2026-10-31', '02:00 Bangkok');
  assert.equal(S.dueDay(at('2026-10-30T19:00:00Z'), '02:00', 'Asia/Bangkok', '2026-10-31'), null, 'already ran today');
  assert.equal(S.dueDay(at('2026-10-30T22:30:00Z'), '02:00', 'Asia/Bangkok', null), null, '05:30 is too late');
  assert.equal(S.dueDay(at('2026-10-30T19:00:00Z'), null, 'Asia/Bangkok', null), null, 'off');
  assert.equal(S.config({ SIS_SYNC_AT: '2:30' }).at, '02:30');
  assert.equal(S.config({ SIS_SYNC_AT: 'off' }).at, null);
  assert.equal(S.config({}).at, '02:00');
});

// ── Against real pilot servers ──
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
async function start(env) {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-sis-'));
  if (env.map) fs.writeFileSync(path.join(dir, 'sis-map.json'), JSON.stringify(env.map));
  const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0', SIS_TOKEN: TOKEN, SIS_SYNC_AT: 'off', ...(env.map ? { SIS_MAP: 'sis-map.json' } : {}), ...env.env } });
  const out = await new Promise((resolve, reject) => {
    let o = '';
    const t = setTimeout(() => reject(new Error(o)), 15000);
    p.stdout.on('data', (d) => { o += d; if (/server on :/.test(o)) { clearTimeout(t); resolve(o); } });
    p.stderr.on('data', (d) => { o += d; });
  });
  const U = `http://localhost:${port}`;
  const r0 = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: out.match(/#\/setup\/(\S+)/)[1], password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }) });
  const cookie = r0.headers.get('set-cookie').split(';')[0];
  const call = async (method, url, body, c = cookie) => { const r = await fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', cookie: c }, body: body ? JSON.stringify(body) : undefined }); const text = await r.text(); return { status: r.status, text, body: JSON.parse(text || '{}') }; };
  const files = () => fs.readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.jsonl')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const audit = () => fs.readdirSync(dir).filter((f) => /^audit-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  return { p, U, dir, call, files, audit, state: async () => (await call('GET', '/api/state')).body.snapshot.store };
}

test('good feed: Check now builds a report; nothing changes until Apply; the year handover runs; refusals and Dismiss', async () => {
  feeds.main = FX;
  const srv = await start({ env: { SIS_URL: `${SIS}/feed` } });
  try {
    const v0 = (await srv.call('GET', '/api/admin/sis')).body;
    assert.deepEqual([v0.configured, v0.connected, v0.lastChecked, v0.reports.length], [true, false, null, 0]);
    const c = await srv.call('POST', '/api/admin/sis/check');
    assert.equal(c.status, 200);
    const rep = c.body.reports[0];
    assert.equal(c.body.connected, true); assert.equal(rep.status, 'ready'); assert.equal(rep.by.name, 'Pat Admin'); assert.equal(rep.mapped, false);
    assert.deepEqual(Object.fromEntries(Object.entries(rep.added).map(([k, v]) => [k, v.n])), { students: 3, teachers: 6, classes: 5 });
    assert.equal(rep.enrolments.joins.n, 7); assert.equal(rep.accounts.toCreate, 7);
    assert.equal(seen.at(-1), `Bearer ${TOKEN}`, 'the token goes to the SIS as Bearer');
    assert.equal((await srv.state()).students.length, 0, 'nothing applied by a check');

    const ap = await srv.call('POST', `/api/admin/sis/reports/${rep.id}/apply`, {});
    assert.equal(ap.status, 200);
    assert.equal(ap.body.newAccounts.created.length, 7, 'setup links as from an import');
    assert.equal(ap.body.sis.reports[0].status, 'applied'); assert.equal(ap.body.sis.reports[0].applied.by.name, 'Pat Admin');
    assert.equal((await srv.state()).students.length, 3);
    assert.equal((await srv.call('POST', `/api/admin/sis/reports/${rep.id}/apply`, {})).status, 409, 'applied once only');

    // The same feed again: nothing to do.
    const same = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(same.status, 'nothing');

    // Next year: Gus moves to Finn, leaves Biology, Hana changes homeroom and name, a new student and a new class.
    const next = structuredClone(FX);
    next.school = { ...next.school, academicYear: '2027-28', exportedAt: '2027-08-10' };
    Object.assign(next.students[1], { advisorId: 'T105' });
    Object.assign(next.students[2], { homeroom: '8B', name: 'Hana Ito-Brook' });
    next.students.push({ id: 'S2004', name: 'Ivy Jones', year: 7, programme: 'MYP', homeroom: '7A', advisorId: 'T105' });
    next.enrolments = next.enrolments.filter((e) => !(e.studentId === 'S2002' && e.classId === 'C-BIO12'));
    feeds.main = next;
    const r2 = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(r2.status, 'ready');
    assert.deepEqual(r2.added.students.items.map((x) => x.id), ['S2004']);
    const hana = r2.changed.students.items.find((x) => x.id === 'S2003');
    assert.deepEqual(hana.changes.map((x) => x.field).sort(), ['homeroom', 'name']);
    assert.deepEqual(r2.changed.students.items.find((x) => x.id === 'S2002').changes, [{ field: 'advisor', from: 'Ms Ada Brook', to: 'Mr Finn Gray' }]);
    assert.deepEqual(r2.enrolments.ends.items.map((x) => [x.studentId, x.classId]), [['S2002', 'C-BIO12']]);
    assert.deepEqual([r2.handover.newYear, r2.handover.changes, r2.handover.groups[0]], [true, 1, { from: 'Ms Ada Brook', to: 'Mr Finn Gray', n: 1 }]);

    // A manual import in between makes the report stale.
    const stale = await srv.call('POST', '/api/admin/roster', { roster: FX });
    assert.equal(stale.status, 200);
    assert.equal((await srv.call('POST', `/api/admin/sis/reports/${r2.id}/apply`, {})).status, 409, 'stale report refused');
    const r3 = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(r3.status, 'ready');
    assert.equal((await srv.call('GET', '/api/admin/sis')).body.reports.find((x) => x.id === r2.id).status, 'replaced', 'a new check replaces the waiting one');
    const a3 = await srv.call('POST', `/api/admin/sis/reports/${r3.id}/apply`, {});
    assert.equal(a3.status, 200);
    const st = await srv.state();
    assert.ok(st.handovers.some((h) => h.studentId === 'S2002' && h.from === 'T100' && h.to === 'T105' && h.newYear), 'the handover is noted');
    assert.equal(st.yearStart?.year, '2027-28');
    assert.ok(st.enrolments.find((e) => e.studentId === 'S2002' && e.classId === 'C-BIO12').to, 'the ended class place stays as history');
    assert.equal(st.students.find((s) => s.id === 'S2003').homeroom, '8B');

    // 10% drop: two of four students gone → refused, never staged.
    feeds.main = { ...next, students: next.students.slice(0, 2), enrolments: next.enrolments.filter((e) => ['S2001', 'S2002'].includes(e.studentId)) };
    const r4 = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(r4.status, 'refused'); assert.deepEqual([r4.drop.students, r4.drop.of], [2, 4]);
    assert.match(r4.warnings[0], /more than 10%/);
    assert.equal((await srv.call('POST', `/api/admin/sis/reports/${r4.id}/apply`, {})).status, 409);
    assert.equal((await srv.state()).students.length, 4, 'nothing changed');

    // A validation error: an advisor that is not in the feed.
    feeds.main = { ...next, students: next.students.map((s) => (s.id === 'S2004' ? { ...s, advisorId: 'T999' } : s)) };
    const r5 = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(r5.status, 'invalid'); assert.match(r5.errors[0], /T999/); assert.deepEqual(r5.missing, { teachers: ['T999'] });

    // Dismiss.
    feeds.main = { ...next, students: next.students.map((s) => (s.id === 'S2004' ? { ...s, homeroom: '7B' } : s)) };
    const r6 = (await srv.call('POST', '/api/admin/sis/check')).body.reports[0];
    assert.equal(r6.status, 'ready'); assert.equal(r6.changed.students.n, 1);
    const d = await srv.call('POST', `/api/admin/sis/reports/${r6.id}/dismiss`);
    assert.equal(d.body.sis.reports[0].status, 'dismissed'); assert.equal(d.body.sis.reports[0].dismissed.by.name, 'Pat Admin');
    assert.equal((await srv.state()).students.find((s) => s.id === 'S2004').homeroom, '7A');

    // Only the last 10 reports are kept.
    for (let i = 0; i < 6; i++) await srv.call('POST', '/api/admin/sis/check');
    assert.equal((await srv.call('GET', '/api/admin/sis')).body.reports.length, 10);

    // Admins only; the activity log; the token is nowhere.
    const log = srv.audit();
    assert.ok(log.filter((e) => e.action === 'sis-fetch').length >= 10);
    assert.ok(log.some((e) => e.action === 'sis-apply' && e.detail.report === r3.id && e.actor.name === 'Pat Admin'));
    assert.ok(log.some((e) => e.action === 'sis-dismiss' && e.target.id === r6.id));
    const all = srv.files() + JSON.stringify((await srv.call('GET', '/api/admin/sis')).body);
    assert.ok(!all.includes(TOKEN) && !all.includes(SIS), 'no token or SIS address in data files, the log or the API');
    const anon = await fetch(`${srv.U}/api/admin/sis`);
    assert.equal(anon.status, 401);
  } finally { srv.p.kill(); }
});

test('mapped feed (SIS_MAP): the same class lists from another shape', async () => {
  const srv = await start({ env: { SIS_URL: `${SIS}/mapped` }, map: MAP });
  try {
    const v = (await srv.call('POST', '/api/admin/sis/check')).body;
    const rep = v.reports[0];
    assert.equal(v.mapped, true); assert.equal(rep.mapped, true); assert.equal(rep.status, 'ready');
    assert.deepEqual(rep.counts, { teachers: 6, students: 3, classes: 5, enrolments: 7 });
    assert.equal((await srv.call('POST', `/api/admin/sis/reports/${rep.id}/apply`, {})).status, 200);
    const st = await srv.state();
    assert.equal(st.students.find((s) => s.id === 'S2003').grade, 7, 'Year 8 (grade 7 in their SIS, +1)');
    assert.equal(rep.added.teachers.items.find((t) => t.id === 'T104').info, 'coordinator, advisor', 'roles split and mapped');
    assert.equal(st.enrolments.length, 7);
  } finally { srv.p.kill(); }
});

test('bad token: the last error, not connected, no report; a feed that needs a map without one', async () => {
  const srv = await start({ env: { SIS_URL: `${SIS}/feed`, SIS_TOKEN: 'wrong' } });
  try {
    const v = (await srv.call('POST', '/api/admin/sis/check')).body;
    assert.equal(v.connected, false); assert.equal(v.reports.length, 0);
    assert.match(v.error, /refused the token \(HTTP 401\)/); assert.match(v.lastError.message, /SIS_TOKEN/);
    assert.ok(srv.audit().some((e) => e.action === 'sis-fetch' && e.result === 'refused' && /refused the token/.test(e.detail.error)));
    assert.ok(!srv.files().includes('wrong'));
  } finally { srv.p.kill(); }
  const srv2 = await start({ env: { SIS_URL: `${SIS}/mapped` } });
  try {
    assert.match((await srv2.call('POST', '/api/admin/sis/check')).body.error, /no SIS_MAP/);
  } finally { srv2.p.kill(); }
  const srv3 = await start({ env: {} });
  try {
    const v = (await srv3.call('GET', '/api/admin/sis')).body;
    assert.equal(v.configured, false);
    assert.equal((await srv3.call('POST', '/api/admin/sis/check')).status, 409);
  } finally { srv3.p.kill(); }
});

test('the nightly check runs by itself at SIS_SYNC_AT, as nobody', async () => {
  feeds.main = FX;
  const { day, mins } = S.localNow(Date.now(), 'Asia/Bangkok');
  const hhmm = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const srv = await start({ env: { SIS_URL: `${SIS}/feed`, SIS_SYNC_AT: hhmm } });
  try {
    let v;
    for (let i = 0; i < 40 && !(v = (await srv.call('GET', '/api/admin/sis')).body).reports.length; i++) await new Promise((r) => setTimeout(r, 200));
    assert.equal(v.reports[0].status, 'ready'); assert.equal(v.reports[0].by, null);
    assert.equal(JSON.parse(fs.readFileSync(path.join(srv.dir, 'sis-sync.json'), 'utf8')).status.lastScheduledDay, day);
    assert.equal((await srv.state()).students.length, 0, 'still nothing applied');
    assert.ok(srv.audit().some((e) => e.action === 'sis-fetch' && e.actor === null && e.detail.how === 'schedule'));
  } finally { srv.p.kill(); sis.close(); }
});
