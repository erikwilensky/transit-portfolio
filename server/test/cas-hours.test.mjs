// CAS experiences and hours (api.logCasExperience, logCasHours, confirmCasHours, returnCasHours, setCasCode, setCasCoordinator,
// casCohort; server/routes/47-cas.mjs): who may log and confirm, the scoped copies (a supervisor sees only the entries naming
// them), replay, the cohort's flags, PDPA, and through the server the outside supervisor's one-time code.
// Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-cas-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, reachOf } = await import('../scope.mjs');

const fern = { kind: 'student', studentId: 'S2001' }; // Year 12, advised by Ms Brook
const gus = { kind: 'student', studentId: 'S2002' };  // Year 12
const y8 = { kind: 'student', studentId: 'S2003' };   // Year 8
const brook = { kind: 'advisor', teacherId: 'T100' }; // Fern's advisor
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern (12 CS) and S2003
const gray = { kind: 'advisor', teacherId: 'T105' }; // no classes, advises nobody here
const coord = { kind: 'coordinator', teacherId: 'T104' };
const admin = { kind: 'admin' };
const parent = { kind: 'parent', children: ['S2001'] };
const exp = { title: 'Coaching junior football', strand: 'A', from: '2026-09-01', outcomes: [4, 5, 9], summary: 'Saturdays', reflection: 'Patience matters.' };
let e1, h1, out;

test('setup', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['sport']; }
});

test('canAct: only a Year 12 or 13 student logs, on their own; nobody sets a code through /api/action', () => {
  assert.ok(canAct(fern, 'logCasExperience', ['S2001', exp]));
  assert.ok(!canAct(fern, 'logCasExperience', ['S2002', exp]), 'not for a classmate');
  assert.ok(!canAct(y8, 'logCasExperience', ['S2003', exp]), 'Year 8: no CAS');
  for (const u of [brook, coord, parent]) assert.ok(!canAct(u, 'logCasExperience', ['S2001', exp]));
  for (const u of [fern, brook, coord, admin]) assert.ok(!canAct(u, 'setCasCode', ['x', 'h', '2030-01-01']));
  assert.ok(canAct(admin, 'setCasCoordinator', ['T105', true]));
  assert.ok(!canAct(coord, 'setCasCoordinator', ['T105', true]));
  assert.throws(() => api.logCasExperience('S2003', exp), /Years 12 and 13/);
  assert.throws(() => api.logCasExperience('S2001', { ...exp, strand: 'X' }), /Creativity/);
  assert.throws(() => api.logCasExperience('S2001', { ...exp, hours: { date: api.TODAY, hours: 3, supervisor: { kind: 'outside', name: 'Sam', email: 'nope' } } }), /email/);
  assert.throws(() => api.logCasExperience('S2001', { ...exp, hours: { date: api.daysBefore(-2), hours: 3 } }), /future/);
  assert.equal(api.getStore().events.filter((e) => e.cas).length, 0, 'nothing half-made');
});

test('logCasExperience: a station on the CAS line, the first hours waiting, the supervisor told; replay is identical', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  out = api.logCasExperience('S2001', { ...exp, hours: { date: api.TODAY, hours: 2.5, note: 'First session', supervisor: { kind: 'staff', teacherId: 'T105' } } });
  api.setActionHook(null);
  e1 = out.event; h1 = out.entry;
  assert.equal(e1.type, 'cas'); assert.deepEqual(e1.lineIds, ['cas']); assert.deepEqual(e1.cas, { strand: 'A', outcomes: [4, 5], from: '2026-09-01', to: null });
  assert.ok(api.getLine('cas') && api.getStudent('S2001').laneOrder.includes('cas'), 'the CAS line, on her map');
  assert.ok(api.getStudentMap('S2001', 'advisor').events.some((e) => e.id === e1.id), 'her advisor sees the station');
  assert.equal(h1.status, 'pending'); assert.equal(h1.hours, 2.5);
  assert.ok(api.getStore().notifications.some((n) => n.to === 't:T105' && /Fern asked you to confirm 2.5 hours of CAS/.test(n.text) && n.go.screen === 'casconfirm'));
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  e1 = api.getEvent(e1.id); h1 = api.getCasEntry(h1.id);
  assert.ok(canAct(fern, 'logCasHours', ['S2001', e1.id, {}]));
  assert.ok(!canAct(gus, 'logCasHours', ['S2002', e1.id, {}]), 'not on someone else’s experience');
});

test('scope: the student, CAS coordinators and the named supervisor only; the supervisor without the rest of her record', () => {
  const casOf = (u) => scopedSnapshot(u).store.casHours;
  assert.deepEqual(casOf(fern).map((x) => x.id), [h1.id]);
  assert.equal(casOf(fern)[0].about, undefined);
  assert.deepEqual(casOf(gus), []);
  const g = scopedSnapshot(gray).store;
  assert.deepEqual(g.casHours.map((x) => x.id), [h1.id]);
  assert.deepEqual(g.casHours[0].about, { name: 'Fern Gale', year: 12, title: 'Coaching junior football', strand: 'A' });
  assert.ok(!g.students.some((s) => s.id === 'S2001') && !g.events.some((e) => e.id === e1.id), 'Mr Gray does not get Fern’s record or map');
  assert.ok(!reachOf(gray).has('S2001'));
  assert.deepEqual(casOf(brook), [], 'her advisor: not the hours entries');
  assert.deepEqual(casOf(carter), [], 'her teacher: not the hours entries');
  assert.deepEqual(casOf(parent), []);
  assert.deepEqual(casOf(coord).map((x) => x.id), [h1.id]);
  assert.deepEqual(casOf(admin).map((x) => x.id), [h1.id]);
});

test('confirming: the named supervisor as himself, a CAS coordinator for anyone; nobody else', () => {
  assert.ok(canAct(gray, 'confirmCasHours', [h1.id, 'T105', { via: 'supervisor' }]));
  assert.ok(!canAct(gray, 'confirmCasHours', [h1.id, 'T100', { via: 'supervisor' }]), 'only as himself');
  assert.ok(!canAct(gray, 'confirmCasHours', [h1.id, 'T105', { via: 'coordinator' }]), 'not a CAS coordinator');
  assert.ok(!canAct(gray, 'confirmCasHours', [h1.id, 'T105', { via: 'code' }]));
  assert.ok(!canAct(carter, 'confirmCasHours', [h1.id, 'T101', { via: 'supervisor' }]), 'her teacher is not the supervisor');
  assert.ok(!canAct(brook, 'confirmCasHours', [h1.id, 'T100', { via: 'supervisor' }]), 'her advisor is not the supervisor');
  assert.ok(!canAct(fern, 'confirmCasHours', [h1.id, null, { via: 'code' }]), 'never the student');
  assert.ok(canAct(coord, 'confirmCasHours', [h1.id, 'T104', { via: 'coordinator' }]));
  assert.ok(!canAct(coord, 'confirmCasHours', [h1.id, 'T104', { via: 'supervisor' }]));
  assert.ok(canAct(admin, 'returnCasHours', [h1.id, null, { via: 'coordinator' }]));
  assert.throws(() => api.returnCasHours(h1.id, 'T105', { via: 'supervisor' }), /what is not right/);
  api.confirmCasHours(h1.id, 'T105', { via: 'supervisor' });
  assert.equal(api.getCasEntry(h1.id).status, 'confirmed');
  assert.deepEqual([api.getCasEntry(h1.id).decided.via, api.getCasEntry(h1.id).decided.name], ['supervisor', 'Mr Finn Gray']);
  assert.ok(api.getStore().notifications.some((n) => n.to === 'st:S2001' && /^Mr Gray confirmed your 2.5 hours of CAS/.test(n.text)));
  assert.throws(() => api.confirmCasHours(h1.id, 'T105', { via: 'supervisor' }), /already/);
  assert.throws(() => api.withdrawCasHours(h1.id, 'S2001'), /Confirmed hours stay/);
});

test('a teacher marked as CAS coordinator: Years 12 and 13 in reach, every entry, confirms for others', () => {
  assert.ok(!reachOf(carter).has('S2002'));
  api.setCasCoordinator('T101', true);
  assert.ok(reachOf(carter).has('S2001') && reachOf(carter).has('S2002'), 'Years 12 and 13');
  assert.ok(api.isCasCoordinator(carter));
  assert.ok(scopedSnapshot(carter).store.teachers.find((t) => t.id === 'T101').casCoordinator);
  assert.deepEqual(scopedSnapshot(carter).store.casHours.map((x) => x.id), [h1.id]);
  const h2 = api.logCasHours('S2001', e1.id, { date: api.TODAY, hours: 1, supervisor: { kind: 'outside', name: 'Khun Dee', email: 'Dee@Example.org' } });
  assert.equal(h2.supervisor.email, 'dee@example.org');
  assert.ok(canAct(carter, 'confirmCasHours', [h2.id, 'T101', { via: 'coordinator' }]));
  api.importRoster(structuredClone(FX));
  assert.ok(api.getTeacher('T101').casCoordinator, 'a later class list keeps the mark');
  api.setCasCoordinator('T101', false);
  assert.ok(!canAct(carter, 'confirmCasHours', [h2.id, 'T101', { via: 'coordinator' }]));
  assert.ok(!reachOf(carter).has('S2002'));
  api.withdrawCasHours(h2.id, 'S2001');
  assert.equal(api.getCasEntry(h2.id), null);
});

test('the CAS grid’s nudge with a comment-bank phrase: a coordinator (or a teacher marked as one) uses a school phrase and nudges', () => {
  const ph = api.addPhrase('school', 'T104', { text: 'Hi {first name}, could you add a reflection?', kind: 'next' });
  const text = api.fillPhrase(ph.text, 'Fern');
  assert.equal(text, 'Hi Fern, could you add a reflection?');
  assert.ok(canAct(coord, 'usePhrase', [ph.id, 'T104']) && canAct(coord, 'casNudge', ['S2001', 'your CAS hours', text, 'Ms Fong']));
  api.setCasCoordinator('T101', true);
  assert.ok(canAct(carter, 'usePhrase', [ph.id, 'T101']), 'a teacher marked as CAS coordinator uses the school bank');
  assert.ok(canAct(carter, 'casNudge', ['S2002', 'LO1', text, 'Mr Carter']), 'and nudges a Year 12 student they do not teach');
  api.setCasCoordinator('T101', false);
  assert.ok(!canAct(carter, 'casNudge', ['S2002', 'LO1', text, 'Mr Carter']), 'not once unmarked');
  for (const u of [fern, parent]) assert.ok(!canAct(u, 'usePhrase', [ph.id, 'T104']), `${u.kind}: never`);
  api.usePhrase(ph.id, 'T104'); api.casNudge('S2001', 'your CAS hours', text, 'Ms Fong');
  assert.equal(api.getStore().phraseUses.T104[ph.id], 1);
  assert.equal(api.getCasNudges('S2001').at(-1).text, text, 'sent as written, with her name filled in');
  assert.deepEqual(scopedSnapshot(fern).store.phrases, [], 'the student never gets the bank');
});

test('casCohort: strands, outcomes, hours and flags', () => {
  const row = (sid) => api.casCohort().find((r) => r.student.id === sid);
  const f = row('S2001');
  assert.deepEqual([f.confirmed, f.pending, f.covered], [2.5, 0, 2]);
  assert.deepEqual(f.flags, ['service', 'outcome'], 'a reflection today, no Service, outcomes missing');
  assert.deepEqual(row('S2002').flags, ['nothing']);
  assert.equal(row('S2003'), undefined, 'Year 8 is not in the cohort');
  assert.deepEqual(api.casCohort({ advisorId: 'T100' }).map((r) => r.student.id).sort(), ['S2001', 'S2002']);
  const { event } = api.logCasExperience('S2001', { title: 'Beach clean', strand: 'S', from: api.TODAY, outcomes: [1, 2, 3, 6, 7] });
  assert.deepEqual(row('S2001').flags, []);
  api.getStore().reflections.filter((r) => r.eventId === e1.id).forEach((r) => { r.date = api.daysBefore(50); });
  assert.deepEqual(row('S2001').flags, ['reflection'], 'no reflection in six weeks');
  assert.ok(event.id);
});

test('PDPA: a copy has her hours; erasure removes them', () => {
  const copy = api.studentData('S2001');
  assert.ok(copy.own.casHours.some((x) => x.id === h1.id));
  const snap = api.snapshot();
  api.eraseStudent('S2001');
  assert.ok(!api.getCasHours().some((x) => x.studentId === 'S2001'));
  api.restore(snap);
});

// ── Through the server: the outside supervisor's code ──
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

test('through the server: a code for an outside supervisor, confirmed once with their email; never for anyone else', async () => {
  const port = await freePort(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-cas-http-'));
  const srv = await start({ PORT: String(port), DATA_DIR: dataDir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, u, body, cookie) => fetch(`${U}${u}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json().catch(() => ({}))), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (u, password) => json(req('POST', '/api/auth/setup', { token: u.split('/setup/')[1], password }));
  const act = (cookie, fn, args) => json(req('POST', '/api/action', { fn, args, rec: [] }, cookie));
  const state = async (cookie) => (await json(req('GET', '/api/state', null, cookie))).snapshot.store;
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fernC = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const gusC = (await setup(link['gus.hale@example.org'], 'gus-pass-123')).cookie;
    const benC = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const made = await act(fernC, 'logCasExperience', ['S2001', { title: 'Temple soup kitchen', strand: 'S', from: '2026-09-10', outcomes: [6], hours: { date: '2026-10-01', hours: 3, note: 'Served lunch', supervisor: { kind: 'outside', name: 'Khun Malee Dee', email: 'malee@example.org' } } }]);
    assert.equal(made.status, 200);
    const entryId = made.result.entry.id;
    assert.equal((await act(benC, 'confirmCasHours', [entryId, 'T101', { via: 'supervisor' }])).status, 403, 'not his to confirm');
    assert.equal((await act(fernC, 'setCasCode', [entryId, 'x'.repeat(64), '2099-01-01'])).status, 403, 'nobody sets a code by hand');
    assert.equal((await json(req('POST', '/api/cas/code', { entryId }, gusC))).status, 404, 'a classmate cannot make her code');
    const c1 = await json(req('POST', '/api/cas/code', { entryId }, fernC));
    assert.equal(c1.status, 200); assert.match(c1.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const c2 = await json(req('POST', '/api/cas/code', { entryId }, fernC));
    assert.equal((await req('GET', `/api/public/cas/${c1.code}`)).status, 404, 'a new code replaces the old one');
    const mine = (await state(fernC)).casHours.find((x) => x.id === entryId);
    assert.ok(mine.code && !mine.code.hash && mine.code.expires, 'her copy knows a code exists, never its hash');
    assert.ok(!JSON.stringify(await state(ac)).includes(c2.code.replace('-', '')));
    const view = await json(req('GET', `/api/public/cas/${c2.code.toLowerCase()}`));
    assert.equal(view.status, 200);
    assert.deepEqual([view.student, view.year, view.title, view.hours, view.supervisor], ['Fern', 12, 'Temple soup kitchen', 3, 'Khun Malee Dee']);
    assert.ok(!JSON.stringify(view).includes('malee@example.org') && !JSON.stringify(view).includes('Gale'), 'no email, no surname');
    assert.equal((await json(req('POST', `/api/public/cas/${c2.code}`, { email: 'someone@else.org', ok: true }))).status, 400, 'the wrong email');
    const ok = await json(req('POST', `/api/public/cas/${c2.code}`, { email: ' Malee@Example.org ', ok: true, comment: 'Great helper' }));
    assert.equal(ok.status, 'confirmed');
    const done = (await state(fernC)).casHours.find((x) => x.id === entryId);
    assert.deepEqual([done.decided.via, done.decided.name, done.decided.comment, done.decided.by], ['code', 'Khun Malee Dee', 'Great helper', null]);
    assert.ok((await state(fernC)).notifications.some((n) => /^Khun Malee confirmed your 3 hours of CAS/.test(n.text)));
    assert.equal((await req('GET', `/api/public/cas/${c2.code}`)).status, 404, 'one time only');
    assert.equal((await json(req('POST', '/api/cas/code', { entryId }, fernC))).status, 400, 'no code for confirmed hours');
    const log = fs.readdirSync(dataDir).filter((f) => f.startsWith('audit-')).flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    assert.equal(log.filter((x) => x.action === 'cas-code').length, 2);
    assert.equal(log.filter((x) => x.action === 'cas-confirm' && x.detail.result === 'confirmed').length, 1);
    assert.ok(!JSON.stringify(log).includes(c2.code.replace('-', '')), 'the code is never in the activity log');
  } finally { srv.p.kill(); }
});
