// Safeguarding (api.reportItem, api.moderateReport): who may report and moderate, who receives reports (scope), what a
// hidden item disappears from, Remove photo (and its file), replay, PDPA copy and erasure. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-safe-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api, changed } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { publicSnapshot, publicVerify } = await import('../routes/40-public.mjs');
const { buildCopy, eraseStudent } = await import('../routes/50-pdpa.mjs');
const reports = await import('../routes/70-reports.mjs');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const brook = { kind: 'teacher', teacherId: 'T100' };    // Fern's advisor
const gray = { kind: 'advisor', teacherId: 'T105' };     // out of reach
const coord = { kind: 'coordinator', teacherId: 'T104' };
const couns = { kind: 'counsellor', teacherId: 'T102' };
const parent = { kind: 'parent', name: 'Rose Gale', children: ['S2001'] };
const otherParent = { kind: 'parent', name: 'Ann Hale', children: ['S2002'] };
const FILE = 'a'.repeat(32) + '.jpg';
let robot, secret, gusMoment, cm, rep1;

test('setup: Fern has a publishable moment with an uploaded photo, shared on a link', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', FILE), 'x');
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', `${FILE}.json`), '{}');
  robot = api.addStation('S2001', { title: 'Line-following robot', lineIds: ['computing'], visibility: 'publishable', image: `api/files/${FILE}` });
  secret = api.addStation('S2001', { title: 'Diary', lineIds: ['computing'], visibility: 'private' });
  gusMoment = api.addStation('S2002', { title: 'Choir', lineIds: ['computing'] });
  cm = api.addMomentComment(robot.id, 'T100', 'Who else built it?');
  api.setStudentDrafts('S2001', [{ id: 'pr-1', studentId: 'S2001', title: 'Fern', audience: 'general', shareLinks: [{ token: 'tok-sg', expiresAt: '2099-01-01', created: '2026-10-01' }] }]);
  changed({ fn: 'setup' });
  assert.ok(publicSnapshot('tok-sg').store.events.some((e) => e.id === robot.id));
});

test('canAct reportItem: the student their own; staff in reach; a parent only what the family view shows', () => {
  const R = (t, from) => ['reportItem', [t, 'inappropriate', '', from]];
  assert.ok(canAct(fern, ...R({ eventId: robot.id }, { key: 'student' })), 'the student, own moment');
  assert.ok(canAct(fern, ...R({ commentId: cm.id }, { key: 'student' })), 'the student, a comment on it');
  assert.ok(!canAct(gus, ...R({ eventId: robot.id }, { key: 'student' })), 'not someone else’s');
  assert.ok(!canAct(fern, ...R({ eventId: robot.id }, { key: 'T100' })), 'only as yourself');
  assert.ok(!canAct(fern, ...R({ eventId: secret.id }, { key: 'student' })), 'not a private moment');
  assert.ok(canAct(brook, ...R({ eventId: robot.id }, { key: 'T100' })), 'staff in reach');
  assert.ok(!canAct(brook, ...R({ eventId: robot.id }, { key: 'T101' })), 'staff only as themselves');
  assert.ok(!canAct(gray, ...R({ eventId: robot.id }, { key: 'T105' })), 'staff out of reach');
  assert.ok(canAct(coord, ...R({ eventId: gusMoment.id }, { key: 'T104' })), 'whole-school staff');
  assert.ok(canAct(parent, ...R({ eventId: robot.id }, { key: 'fam:S2001', name: 'Rose Gale' })), 'a parent, a moment the family sees');
  assert.ok(!canAct(parent, ...R({ eventId: robot.id }, { key: 'fam:S2001', name: 'Someone' })), 'a parent only as themselves');
  assert.ok(!canAct(parent, ...R({ commentId: cm.id }, { key: 'fam:S2001', name: 'Rose Gale' })), 'never a comment');
  assert.ok(!canAct(otherParent, ...R({ eventId: robot.id }, { key: 'fam:S2001', name: 'Ann Hale' })), 'not another family’s child');
  const adv = api.addStation('S2001', { title: 'Advisor only', lineIds: ['computing'], visibility: 'advisor' });
  assert.ok(!canAct(parent, ...R({ eventId: adv.id }, { key: 'fam:S2001', name: 'Rose Gale' })), 'not what the family view leaves out (Year 12: school level)');
  assert.ok(!canAct(fern, 'reportItem', [{ eventId: 'nope' }, 'other', '', { key: 'student' }]));
});

test('reportItem: stored with the reporter, moderators hear (without the reporter), replays the same', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  rep1 = api.reportItem({ eventId: robot.id }, 'personal', 'Her address is on the poster.', { key: 'T100' });
  api.setActionHook(null);
  assert.deepEqual([rep1.kind, rep1.eventId, rep1.studentId, rep1.status, rep1.from.name, rep1.from.key], ['station', robot.id, 'S2001', 'open', 'Ms Ada Brook', 'T100']);
  const sent = api.getStore().notifications.slice(0, 3);
  assert.deepEqual(sent.map((n) => n.to).sort(), ['role:coordinator', 'role:counsellor', 'role:leadership']);
  for (const n of sent) { assert.match(n.text, /^New report: “Line-following robot” \(Fern Gale\)\. Personal information shown\.$/); assert.ok(!n.text.includes('Brook')); }
  assert.deepEqual(sent[0].go, { persona: sent[0].to, screen: 'reports', param: rep1.id });
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.equal(api.reportItem({ eventId: robot.id }, 'other', '', { key: 'T100' }).id, rep1.id, 'one open report per person per item');
  assert.throws(() => api.reportItem({ eventId: robot.id }, 'nope', '', { key: 'T100' }), /Pick a reason/);
  assert.throws(() => api.reportItem({ commentId: cm.id }, 'other', '', { key: 'fam:S2001' }), /Families do not see comments/);
});

test('rate limit: 20 reports an hour per person', () => {
  const evs = Array.from({ length: 21 }, (_, i) => api.addStation('S2002', { title: `R${i}`, lineIds: ['computing'] }));
  for (const e of evs.slice(0, 20)) api.reportItem({ eventId: e.id }, 'other', '', { key: 'T104' });
  assert.throws(() => api.reportItem({ eventId: evs[20].id }, 'other', '', { key: 'T104' }), (e) => e.status === 429);
  for (const e of evs) api.deleteStation(e.id);
  api.getStore().reports = api.getStore().reports.filter((r) => r.from.key !== 'T104');
});

test('the queue: moderators only, as themselves; teachers refused; reporters see only their own, without names', () => {
  const M = (u, by) => canAct(u, 'moderateReport', [rep1.id, 'hide', '', by]);
  assert.ok(M(coord, 'T104'), 'a coordinator');
  assert.ok(M(couns, 'T102'), 'a counsellor');
  assert.ok(M({ kind: 'leadership', teacherId: 'T103' }, 'T103'), 'leadership');
  assert.ok(M({ kind: 'admin' }, null), 'an admin');
  assert.ok(!M(coord, 'T102'), 'only as yourself');
  assert.ok(!M(brook, 'T100'), 'a teacher is refused');
  assert.ok(!M(fern, null) && !M(parent, null), 'students and families are refused');
  assert.equal(scopedSnapshot(coord).store.reports.length, 1);
  assert.equal(scopedSnapshot(coord).store.reports[0].from.name, 'Ms Ada Brook', 'moderators see who reported');
  assert.deepEqual(scopedSnapshot(fern).store.reports, [], 'the student never receives a report someone else made');
  assert.ok(!JSON.stringify(scopedSnapshot(fern).store).includes('Her address is on the poster'));
  const mine = scopedSnapshot(brook).store.reports;
  assert.equal(mine.length, 1);
  assert.ok(!mine[0].from.name && !mine[0].note && !mine[0].history.length, 'the reporter’s copy has no names, note or history');
  assert.deepEqual(scopedSnapshot(gray).store.reports, []);
  const fr = api.reportItem({ eventId: robot.id }, 'unkind', '', { key: 'student' });
  assert.deepEqual(scopedSnapshot(fern).store.reports.map((r) => r.id), [fr.id], 'a student sees the report they made');
  api.getStore().reports = api.getStore().reports.filter((r) => r.id !== fr.id);
});

test('hide: gone from the family, public share, verify and school views; kept for the student and staff; the student hears', () => {
  const code = api.verifyCode(robot.id);
  assert.equal(publicVerify(code).event.id, robot.id);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  api.moderateReport(rep1.id, 'hide', 'Checking with Fern.', 'T104');
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'replays the same');
  const r = api.getReport(rep1.id);
  assert.equal(r.status, 'hidden');
  assert.deepEqual(r.history.map((h) => [h.action, h.note, h.by]), [['hide', 'Checking with Fern.', 'Ms Eve Fong']]);
  assert.equal(api.getEvent(robot.id).hidden.by, 'Ms Eve Fong');
  const n = api.getStore().notifications.find((x) => x.to === 'st:S2001');
  assert.equal(n.text, 'A teacher has hidden “Line-following robot” while they look at it.');
  assert.deepEqual(n.go, { persona: 'st:S2001', screen: 'map', param: robot.id });
  const ids = (u) => scopedSnapshot(u).store.events.map((e) => e.id);
  assert.ok(!ids(parent).includes(robot.id), 'not in the family’s copy');
  assert.ok(!JSON.stringify(scopedSnapshot(parent).store).includes('Line-following robot'), 'not even in the activity');
  assert.ok(!api.getStudentMap('S2001', api.familyViewer('S2001'), { family: true }).events.some((e) => e.id === robot.id), 'not in the family view');
  assert.ok(!publicSnapshot('tok-sg').store.events.some((e) => e.id === robot.id), 'not on the share link');
  assert.throws(() => publicVerify(code), (e) => e.status === 404, 'not on the verify page');
  assert.ok(!api.schoolEvents().some((e) => e.id === robot.id), 'not in school-wide lists');
  assert.ok(ids(fern).includes(robot.id) && ids(brook).includes(robot.id) && ids(coord).includes(robot.id), 'the student and staff keep it');
  assert.ok(!canAct(parent, 'reportItem', [{ eventId: robot.id }, 'other', '', { key: 'fam:S2001', name: 'Rose Gale' }]), 'a family cannot report what it no longer sees');
  api.editStation(robot.id, { hidden: null, title: 'Line-following robot' });
  assert.ok(api.getEvent(robot.id).hidden, 'a student’s edit cannot unhide it');
});

test('a hidden comment: staff, and the student only when they wrote it', () => {
  const mine = api.addMomentComment(robot.id, 'student', 'This is mean to Gus.');
  const r1 = api.reportItem({ commentId: cm.id }, 'unkind', '', { key: 'student' });
  const r2 = api.reportItem({ commentId: mine.id }, 'unkind', '', { key: 'T100' });
  api.moderateReport(r1.id, 'hide', '', 'T104');
  api.moderateReport(r2.id, 'hide', '', 'T104');
  assert.match(api.getStore().notifications.find((x) => x.to === 'st:S2001').text, /^A teacher has hidden a comment on “Line-following robot”/);
  const cs = (u) => scopedSnapshot(u).store.momentComments.map((c) => c.id);
  assert.ok(!cs(fern).includes(cm.id) && cs(fern).includes(mine.id), 'the student keeps their own, not the hidden staff one');
  assert.ok(cs(brook).includes(cm.id) && cs(brook).includes(mine.id) && cs(coord).includes(cm.id), 'staff keep both');
  assert.throws(() => api.moderateReport(r1.id, 'photo', '', 'T104'), /comment has no photo/);
  api.moderateReport(r1.id, 'unhide', 'Fine.', 'T104');
  assert.ok(cs(fern).includes(cm.id));
});

test('Remove photo: the photo leaves the moment and its file is deleted', () => {
  const up = path.join(process.env.DATA_DIR, 'uploads', FILE);
  const info = { fn: 'moderateReport', args: [rep1.id, 'photo', '', 'T104'] };
  reports.removedPhotos({ fn: 'setup' }); // the files in use now
  api.moderateReport(...info.args);
  assert.ok(!api.getEvent(robot.id).evidence.some(api.isPhoto));
  assert.ok(!api.snapshot().includes(FILE), 'nothing keeps its address');
  assert.deepEqual(reports.removedPhotos(info), [FILE]);
  assert.ok(!fs.existsSync(up) && !fs.existsSync(`${up}.json`));
  assert.equal(api.getReport(rep1.id).status, 'photo-removed');
  assert.match(api.getStore().notifications.find((x) => x.to === 'st:S2001').text, /removed the photo/);
  assert.throws(() => api.moderateReport(rep1.id, 'photo', '', 'T104'), /no photo/);
  api.moderateReport(rep1.id, 'none', 'Done.', 'T104');
  assert.deepEqual(api.getReport(rep1.id).history.map((h) => h.action), ['hide', 'photo', 'none']);
});

test('PDPA: the copy has reasons and outcomes, never who reported; erasure removes them', async () => {
  const d = api.studentData('S2001');
  assert.ok(d.own.reports.length >= 1);
  for (const r of d.own.reports) { assert.ok(!('from' in r)); assert.ok(r.reason && Array.isArray(r.history)); }
  assert.ok(!JSON.stringify(d.own.reports).includes('Ada Brook'));
  const z = Object.fromEntries(buildCopy('S2001').entries.map((e) => [e.name, String(e.data)]));
  assert.ok(z['reports.json'] && z['reports.json'].includes('personal') && !z['reports.json'].includes('Brook'), 'reports.json: reasons and outcomes only');
  api.reportItem({ eventId: gusMoment.id }, 'other', '', { key: 'T104' });
  eraseStudent('S2001', 'u-admin');
  assert.ok(!(api.getStore().reports || []).some((r) => r.studentId === 'S2001'));
  assert.equal(api.getStore().reports.filter((r) => r.studentId === 'S2002').length, 1, 'other students’ reports stay');
});
