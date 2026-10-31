// Families read only: a parent account may call no act()-wrapped mutator but its own bell (and a share link's view
// count); consent is recorded by the school (api.recordFamilyConsent); the removed family features are gone from the record.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-famro-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct, PARENT_FNS } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const parent = { id: 'u-par', kind: 'parent', name: 'Mo Ito', children: ['S2001', 'S2003'] };
const fong = { kind: 'coordinator', teacherId: 'T104' }; // advises S2003 (Year 8)
const brook = { kind: 'advisor', teacherId: 'T100' };    // advises S2001, S2002
const ellis = { kind: 'leadership', teacherId: 'T103' }; // whole-school, advises nobody
const admin = { kind: 'admin', admin: true };
const hana = { kind: 'student', studentId: 'S2003' };
// The only mutators a parent may call: its own bell, and counting a share link it opens. Language, display, notification
// settings and password are its account's own routes (/api/auth/prefs, /api/auth/password), not mutators.
const ALLOW = ['markNotificationsRead', 'clearReadNotifications', 'recordView'];
let mom, conf;

test('setup: class lists, a moment, a conference', () => {
  api.importRoster(structuredClone(FX));
  mom = api.addStation('S2003', { title: 'Painted the mural', lineIds: [api.getStudent('S2003').laneOrder[0]], visibility: 'school' });
  conf = api.addConference({ title: 'Term 1', from: api.daysBefore(-5), advisorId: 'T104' }, 'T104');
  assert.ok(mom.id && conf.id);
});

test('canAct: a parent is refused every mutator but its own bell', () => {
  assert.deepEqual([...PARENT_FNS].sort(), [...ALLOW].sort(), 'the allowlist is small and explicit');
  assert.ok(api.MUTATORS.length > 150, 'every act()-wrapped mutator');
  const shapes = [
    [], ['S2003'], ['S2001'], ['S2003', {}], ['S2003', {}, 'family'], ['S2003', 'x'], [mom.id], [mom.id, 'x'], [[mom.id]], [{ studentId: 'S2003' }],
    [{ eventId: mom.id }, 'other', '', { key: 'fam:S2003', name: parent.name }], [{ title: 'x', from: api.TODAY, advisorId: 'T104' }, null], [conf.id, null],
    [conf.id, 'S2003', 'student', 'x', 'student'], [conf.id, 'S2003', {}, true], ['S2003', { on: true, date: api.TODAY, how: 'email' }, null],
    ['th'], [{ lang: 'th' }], [{ email: true }], [['fam:S2003']], ['fam:S2003'],
  ];
  const leaks = [];
  for (const fn of api.MUTATORS) {
    if (ALLOW.includes(fn)) continue;
    for (const args of shapes) if (canAct(parent, fn, args)) leaks.push(`${fn}(${JSON.stringify(args)})`);
  }
  assert.deepEqual(leaks, [], 'a parent changes nothing in the record');
  assert.ok(canAct(parent, 'markNotificationsRead', [['fam:S2003', 'fam:S2001']]), 'its own bell');
  assert.ok(canAct(parent, 'clearReadNotifications', [['fam:S2003']]));
  assert.ok(!canAct(parent, 'markNotificationsRead', [['st:S2003']]), 'not the student’s bell');
  assert.ok(!canAct(parent, 'clearReadNotifications', [['t:T104']]));
  assert.ok(canAct(parent, 'recordView', ['tok', 'S2003']));
});

test('recordFamilyConsent: an admin or the student’s advisor, as themselves; consentOnFile follows it', () => {
  const ok = (u, by) => canAct(u, 'recordFamilyConsent', ['S2003', { on: true, date: api.TODAY, how: 'email' }, by]);
  assert.ok(ok(admin, null) && ok(fong, 'T104'));
  assert.ok(!ok(fong, 'T100') && !ok(brook, 'T100') && !ok(ellis, 'T103') && !ok(hana, null) && !ok(parent, null), 'nobody else, whole-school roles included');
  assert.equal(api.consentOnFile('S2003'), false, 'Year 8: waiting');
  assert.equal(api.consentOnFile('S2001'), true, 'from Year 10 the student decides');
  assert.throws(() => api.recordFamilyConsent('S2003', { on: true, date: '2099-01-01', how: 'email' }, 'T104'), /date/);
  assert.throws(() => api.recordFamilyConsent('S2003', { on: true, date: api.TODAY, how: 'fax' }, 'T104'), /how/);
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const c = api.recordFamilyConsent('S2003', { on: true, date: api.daysBefore(2), how: 'paper', note: 'Signed form in the file' }, 'T104');
  api.setActionHook(null);
  assert.deepEqual([c.on, c.how, c.by, c.note], [true, 'paper', 'T104', 'Signed form in the file']);
  assert.equal(api.consentOnFile('S2003'), true);
  assert.equal(api.getStore().notifications.length, n0, 'nobody is notified');
  assert.match(api.getActivity('S2003')[0].text, /^Recorded family consent \(on paper, /);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'replays exactly');
  api.recordFamilyConsent('S2003', { on: false }, 'T104');
  assert.equal(api.consentOnFile('S2003'), false, 'withdrawn');
  api.recordFamilyConsent('S2003', { on: true, date: api.TODAY, how: 'email' }, null);
  assert.equal(api.familyConsentOf('S2003').by, null);
  for (const u of [parent, hana, fong]) assert.deepEqual(scopedSnapshot(u).store.familyConsent?.S2003?.on, true, `${u.kind} sees it`);
});

test('the removed family features are gone: no mutators, no collections, no family reporter', () => {
  for (const fn of ['addFamilyNote', 'editFamilyNote', 'deleteFamilyNote', 'thankFamilyNote', 'setFamilyNoteHidden', 'answerConsent', 'remindParent', 'bookConference', 'cancelConference', 'openConferenceRound']) {
    assert.ok(!api.MUTATORS.includes(fn), `${fn} is gone`);
    assert.throws(() => api.runAction(fn, []), /Not a change/);
  }
  assert.ok(!('getConsentReqs' in api) && !('familyWrittenNotice' in api) && !('getFamilyNote' in api));
  // A saved record from before loses the old collections on load.
  const snap = JSON.parse(api.snapshot());
  Object.assign(snap.store, { familyNotes: [{ id: 'fn-1', studentId: 'S2003' }], consentReqs: [{ id: 'cr-1', studentId: 'S2003' }], confRounds: [], confBookings: [], confBlocks: [] });
  api.restore(JSON.stringify(snap));
  for (const k of ['familyNotes', 'consentReqs', 'confRounds', 'confBookings', 'confBlocks']) assert.ok(!(k in api.getStore()), `${k} dropped`);
  assert.throws(() => api.reportItem({ eventId: mom.id }, 'other', '', { key: 'fam:S2003', name: 'Mo Ito' }), /Who is reporting/);
  assert.equal(scopedSnapshot(parent).store.conferences.length, 0, 'no conferences for a family');
});

test('the consent record is in the student’s PDPA copy and goes with erasure', () => {
  assert.equal(api.studentData('S2003').own.familyConsent.S2003.on, true);
  assert.equal(api.eraseStudent('S2003').familyConsent, 1);
  assert.equal(api.familyConsentOf('S2003'), null);
});

// Over HTTP: the account routes still work for a family; feedback, uploads and record changes do not.
const freePort = () => new Promise((r) => { const v = net.createServer().listen(0, () => { const { port } = v.address(); v.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
test('a family account: own language, display and password yes; feedback, uploads and changes no', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-famro-http-')), TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie, headers = {}) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json().catch(() => ({}))), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const ada = (await json(req('POST', '/api/auth/setup', { token: link['ada.brook@example.org'].split('/setup/')[1], password: 'ada-pass-123' }))).cookie;
    const letter = (await json(req('POST', '/api/advisor/family/letters', { studentIds: ['S2001'] }, ada))).letters[0];
    const mo = await json(req('POST', '/api/family/join', { token: letter.url.split('/#/family/')[1], name: 'Mo Gale', email: 'mo@family.example', password: 'mo-pass-1234' }));
    assert.equal(mo.status, 200);
    const c = mo.cookie;
    assert.equal((await req('POST', '/api/auth/prefs', { lang: 'th' }, c)).status, 200, 'language');
    assert.equal((await req('POST', '/api/auth/prefs', { display: { size: 'large', contrast: true, font: false, motion: 'auto' } }, c)).status, 200, 'display');
    assert.equal((await req('POST', '/api/auth/prefs', { notify: { kinds: { milestones: 'off' } } }, c)).status, 200, 'notification settings');
    assert.equal((await req('POST', '/api/auth/password', { current: 'mo-pass-1234', password: 'mo-pass-5678' }, c)).status, 200, 'password');
    assert.equal((await req('POST', '/api/feedback', { kind: 'idea', message: 'More photos please' }, c)).status, 403, 'no pilot feedback');
    assert.equal((await req('POST', '/api/feedback', { kind: 'idea', message: 'More photos please' }, ada)).status, 201, 'staff keep theirs');
    assert.equal((await req('POST', '/api/upload', 'x', c, { 'content-type': 'text/plain', 'x-filename': 'a.txt' })).status, 403, 'no uploads');
    for (const [fn, args] of [['setFamily', [{ email: true }]], ['addStation', ['S2001', { title: 'x' }]], ['writeConfNote', ['r', 'S2001', 'student', 'x', 'student']]]) {
      assert.equal((await req('POST', '/api/action', { fn, args, rec: [] }, c)).status, 403, fn);
    }
    assert.equal((await req('POST', '/api/action', { fn: 'answerConsent', args: ['cr-1', 'approved', 'Mo'], rec: [] }, c)).status, 400, 'a removed change is not a change at all');
    assert.equal((await req('POST', '/api/action', { fn: 'markNotificationsRead', args: [['fam:S2001']], rec: [] }, c)).status, 200, 'its own bell');
  } finally { srv.p.kill(); }
});
