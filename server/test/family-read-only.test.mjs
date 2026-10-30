// Families read only (since 30 October 2026): a parent account may call no act()-wrapped mutator but its own bell (and a
// share link's view count); consent is recorded by the school (api.recordFamilyConsent); old family history still replays;
// what families wrote before stays only in the PDPA copy and goes with erasure. Run: npm run test:server.
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
let mom, round;

test('setup: class lists, a moment, a conference round', () => {
  api.importRoster(structuredClone(FX));
  mom = api.addStation('S2003', { title: 'Painted the mural', lineIds: [api.getStudent('S2003').laneOrder[0]], visibility: 'school' });
  round = api.openConferenceRound({ title: 'Term 1', slot: 15, days: [{ date: api.daysBefore(-5), from: '15:00', to: '16:00' }], location: 'Room 8A', advisorId: 'T104' }, 'T104');
  assert.ok(mom.id && round.id);
});

test('canAct: a parent is refused every mutator but its own bell', () => {
  assert.deepEqual([...PARENT_FNS].sort(), [...ALLOW].sort(), 'the allowlist is small and explicit');
  assert.ok(api.MUTATORS.length > 150, 'every act()-wrapped mutator');
  const slot = { date: api.daysBefore(-5), time: '15:00' };
  const shapes = [
    [], ['S2003'], ['S2001'], ['S2003', {}], ['S2003', {}, 'family'], ['S2003', 'x'], [mom.id], [mom.id, 'x'], [[mom.id]], [{ studentId: 'S2003' }],
    [mom.id, { key: `u:${parent.id}`, name: parent.name }, 'So proud', 'proud'], ['cr-1', 'approved', parent.name],
    [{ eventId: mom.id }, 'other', '', { key: 'fam:S2003', name: parent.name }], [round.id, 'S2003', slot, 'family'], ['cb-1', 'family'],
    [round.id, 'S2003', 'family', 'Read together', 'family'], ['S2003', { on: true, date: api.TODAY, how: 'email' }, null],
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
  // An old answer from a family still counts until the school records otherwise.
  api.getStore().consentReqs.push({ id: 'cr-old', studentId: 'S2003', kind: 'join', title: 'Join', status: 'approved' });
  api.recordFamilyConsent('S2003', { on: false }, 'T104');
  assert.equal(api.consentOnFile('S2003'), false, 'a record decides');
  api.recordFamilyConsent('S2003', { on: true, date: api.TODAY, how: 'email' }, null);
  assert.equal(api.familyConsentOf('S2003').by, null);
  for (const u of [parent, hana, fong]) assert.deepEqual(scopedSnapshot(u).store.familyConsent?.S2003?.on, true, `${u.kind} sees it`);
});

test('old history replays: removed changes do nothing and tell nobody', () => {
  const n0 = api.getStore().notifications.length, notes0 = (api.getStore().familyNotes || []).length;
  const run = (fn, args) => assert.doesNotThrow(() => api.runAction(fn, args, ['fn-old']), fn);
  run('addFamilyNote', [mom.id, { key: `u:${parent.id}`, name: parent.name }, 'So proud', 'proud']);
  run('editFamilyNote', ['fn-x', `u:${parent.id}`, 'x']);
  run('thankFamilyNote', ['fn-x']); run('setFamilyNoteHidden', ['fn-x', true]); run('deleteFamilyNote', ['fn-x', `u:${parent.id}`]);
  run('answerConsent', ['cr-old', 'declined', parent.name]); run('remindParent', ['S2003']);
  run('writeConfNote', [round.id, 'S2003', 'family', 'Read together', 'family']);
  run('reportItem', [{ familyNoteId: 'fn-x' }, 'other', '', { key: 'student' }]);
  assert.equal(api.getStore().notifications.length, n0);
  assert.equal((api.getStore().familyNotes || []).length, notes0);
  assert.equal(api.confNoteOf(round.id, 'S2003'), null);
  const b = api.runAction('bookConference', [round.id, 'S2003', { date: api.daysBefore(-5), time: '15:15' }, 'family'], ['cb-old']);
  assert.equal(b.by, 'family', 'an old family booking stays an ordinary booking');
  assert.ok(!api.getStore().notifications.some((n) => /^fam:/.test(n.to)), 'the family is not told');
});

test('what families wrote before: hidden from every screen, in the PDPA copy, gone with erasure', () => {
  const s = api.getStore();
  s.familyNotes = [{ id: 'fn-1', eventId: mom.id, studentId: 'S2003', by: `u:${parent.id}`, name: 'Mo Ito', text: 'FAMILY-NOTE-TEXT', reaction: null, at: '2026-10-01T10:00:00.000Z' }];
  s.notifications.unshift({ id: 'nt-fn', to: 'st:S2003', text: 'Mo Ito sent you encouragement for “Painted the mural”: FAMILY-NOTE-TEXT', kind: 'encourage', go: { persona: 'st:S2003', screen: 'map', param: mom.id }, at: '2026-10-01T10:00:00.000Z' });
  s.reports = [...(s.reports || []), { id: 'rp-fn', kind: 'familyNote', eventId: mom.id, familyNoteId: 'fn-1', studentId: 'S2003', reason: 'other', note: '', at: '2026-10-01T11:00:00.000Z', from: { key: 'student' }, status: 'open', history: [] }];
  s.reports.push({ id: 'rp-fam', kind: 'station', eventId: mom.id, studentId: 'S2003', reason: 'other', note: 'FAMILY-REPORT-WORDS', at: '2026-10-01T12:00:00.000Z', from: { key: 'fam:S2003', name: 'Mo Ito', role: 'Family' }, status: 'open', history: [] });
  assert.equal(scopedSnapshot(fong).store.reports.find((r) => r.id === 'rp-fam')?.note, '', 'a moderator still sees a family’s old report, without its words');
  assert.ok(!scopedSnapshot(parent).store.reports.length, 'the family gets none');
  for (const u of [parent, hana, fong, ellis, admin]) {
    const j = JSON.stringify(scopedSnapshot(u).store);
    assert.ok(!j.includes('FAMILY-NOTE-TEXT') && !j.includes('rp-fn') && !j.includes('FAMILY-REPORT-WORDS'), `${u.kind}: nothing family-written`);
  }
  assert.equal(api.reportItem({ familyNoteId: 'fn-1' }, 'other', '', { key: 'student' }), null, 'no new report on one');
  assert.ok(!canAct(admin, 'moderateReport', ['rp-fn', 'hide', '', null]) && !canAct(hana, 'reportItem', [{ familyNoteId: 'fn-1' }, 'other', '', { key: 'student' }]));
  const d = api.studentData('S2003');
  assert.deepEqual(d.own.familyNotes.map((n) => n.text), ['FAMILY-NOTE-TEXT'], 'in the PDPA copy');
  assert.equal(d.own.familyConsent.S2003.on, true, 'the consent record too');
  const removed = api.eraseStudent('S2003');
  assert.equal(removed.familyNotes, 1); assert.equal(removed.familyConsent, 1);
  assert.deepEqual(s.familyNotes, []); assert.equal(api.familyConsentOf('S2003'), null);
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
    for (const [fn, args] of [['setFamily', [{ email: true }]], ['addStation', ['S2001', { title: 'x' }]], ['answerConsent', ['cr-1', 'approved', 'Mo']], ['writeConfNote', ['r', 'S2001', 'family', 'x', 'family']]]) {
      assert.equal((await req('POST', '/api/action', { fn, args, rec: [] }, c)).status, 403, fn);
    }
    assert.equal((await req('POST', '/api/action', { fn: 'markNotificationsRead', args: [['fam:S2001']], rec: [] }, c)).status, 200, 'its own bell');
  } finally { srv.p.kill(); }
});
