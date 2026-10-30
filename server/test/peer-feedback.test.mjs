// Kind feedback from classmates (api.setPeerFeedback, givePeerFeedback, thankPeerFeedback, hidePeerFeedback,
// setPeerFeedbackYear; reportItem on feedback): eligibility, permissions, scope, rate limit, reports, PDPA.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
// One more Year 10 student, in no class with the Year 12s; Hana (S2003) is Year 8.
FX.students.push({ id: 'S2004', name: 'Ivy Jones', year: 10, programme: 'MYP', homeroom: '10A', advisorId: 'T105' });
FX.classes.push({ id: 'C-ENG10', name: '10 English', subject: 'English', year: 10, teacherIds: ['T105'] });
FX.enrolments.push({ studentId: 'S2004', classId: 'C-ENG10' });
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-peer-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const hana = { kind: 'student', studentId: 'S2003' }, ivy = { kind: 'student', studentId: 'S2004' };
const brook = { kind: 'teacher', teacherId: 'T100' }; // teaches 12 Biology (Fern, Gus) and advises both
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern in CS, not Gus
const gray = { kind: 'advisor', teacherId: 'T105' };   // Ivy's advisor
const coord = { kind: 'coordinator', teacherId: 'T104' };
const admin = { kind: 'admin' };
const parent = { kind: 'parent', children: ['S2001'] };
const parts = [{ phrase: 'liked', text: 'you explained the pump test step by step.' }, { phrase: 'try', text: 'a diagram next time.' }];
let ev, evIvy, evHana, fb;

test('setup: class lists, a school-visible moment each', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science']; }
  ev = api.addStation('S2001', { title: 'Osmosis practical', lineIds: ['science'], visibility: 'school', image: '/api/files/0123456789abcdef0123456789abcdef.png' });
  evIvy = api.addStation('S2004', { title: 'Poetry reading', lineIds: ['science'], visibility: 'school' });
  evHana = api.addStation('S2003', { title: 'Robot arm', lineIds: ['science'], visibility: 'school' });
  assert.deepEqual(api.sharedClasses('S2001', 'S2002'), ['C-BIO12', 'C-MAT12']);
  assert.deepEqual(api.sharedClasses('S2001', 'S2004'), []);
  assert.deepEqual(['S2001', 'S2002', 'S2003', 'S2004'].map(api.peerEligible), [true, true, false, true]);
});

test('opting in: the owner only, school-visible moments only, Year 9 and up', () => {
  assert.ok(canAct(fern, 'setPeerFeedback', [ev.id, true]));
  for (const u of [gus, brook, coord, admin, parent]) assert.ok(!canAct(u, 'setPeerFeedback', [ev.id, true]), u.kind);
  const priv = api.addStation('S2001', { title: 'Diary', lineIds: ['science'], visibility: 'private' });
  assert.throws(() => api.setPeerFeedback(priv.id, true), /school can see/);
  assert.throws(() => api.setPeerFeedback(evHana.id, true), /not on for your Year/);
  api.setPeerFeedback(ev.id, true); api.setPeerFeedback(evIvy.id, true);
  assert.ok(api.getEvent(ev.id).peerFeedback && api.peerOpen(api.getEvent(ev.id)));
});

test('who sees the moment: classmates in a shared class only', () => {
  const pm = (u) => scopedSnapshot(u).store.peerMoments;
  assert.deepEqual(pm(gus).map((m) => [m.eventId, m.name, m.title, m.image, m.classId]), [[ev.id, 'Fern', 'Osmosis practical', '/api/files/0123456789abcdef0123456789abcdef.png', 'C-BIO12']]);
  assert.ok(!('summary' in pm(gus)[0]) && !('studentName' in pm(gus)[0]));
  assert.deepEqual(pm(ivy), [], 'not in a class with Fern');
  assert.deepEqual(pm(hana), [], 'Year 8: no feature');
  assert.deepEqual(pm(fern), [], 'her own is not listed; Ivy is not a classmate');
  assert.ok(!scopedSnapshot(gus).store.events.some((e) => e.id === ev.id), 'the moment itself does not reach him');
});

test('giving: a classmate as themselves; never staff, admins, outsiders or Year 8', () => {
  const args = [ev.id, 'S2002', parts];
  assert.ok(canAct(gus, 'givePeerFeedback', args));
  assert.ok(!canAct(gus, 'givePeerFeedback', [ev.id, 'S2001', parts]), 'only as himself');
  assert.ok(!canAct(fern, 'givePeerFeedback', [ev.id, 'S2001', parts]), 'not on her own');
  assert.ok(!canAct(ivy, 'givePeerFeedback', [ev.id, 'S2004', parts]), 'no shared class');
  assert.ok(!canAct(hana, 'givePeerFeedback', [ev.id, 'S2003', parts]));
  for (const u of [brook, coord, admin, parent]) assert.ok(!canAct(u, 'givePeerFeedback', args), u.kind);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'liked', text: '' }]), /finish each/);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'liked', text: 'a' }, { phrase: 'liked', text: 'b' }]), /one or two/);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [...parts, { phrase: 'think', text: 'x' }]), /one or two/);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'nice', text: 'x' }]), /one or two/);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'liked', text: 'x'.repeat(201) }]), /200 characters/);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2004', parts), /classmates/);
  assert.throws(() => api.givePeerFeedback(evHana.id, 'S2002', parts), /not open/);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, a, rec) => { step = { fn, args: a, rec }; });
  fb = api.givePeerFeedback(...args);
  api.setActionHook(null);
  assert.deepEqual([fb.studentId, fb.fromId, fb.fromName, fb.classId, fb.parts.length], ['S2001', 'S2002', 'Gus', 'C-BIO12', 2]);
  assert.match(api.getStore().notifications[0].text, /^Gus gave you kind feedback on “Osmosis practical”/);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'replays the same');
});

test('the giver’s own copy can run it first (the browser has only peerMoments)', () => {
  const before = api.snapshot();
  api.restore(JSON.stringify(scopedSnapshot(gus)));
  assert.ok(!api.getEvent(ev.id));
  let step = null; api.setActionHook((fn, a, rec) => { step = { fn, args: a, rec }; });
  const f = api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'question', text: 'how long did it take?' }]);
  api.setActionHook(null);
  api.restore(before);
  const g = api.runAction(step.fn, step.args, step.rec);
  assert.equal(g.id, f.id);
  api.restore(before);
});

test('scope: owner (first name, no id), giver, class teacher, advisors, whole school; nobody else', () => {
  const pf = (u) => scopedSnapshot(u).store.peerFeedback;
  const own = pf(fern);
  assert.deepEqual(own.map((f) => [f.id, f.fromName, 'fromId' in f]), [[fb.id, 'Gus', false]]);
  assert.deepEqual(pf(gus).map((f) => f.id), [fb.id]);
  for (const u of [brook, coord, admin]) assert.deepEqual(pf(u).map((f) => f.id), [fb.id], u.kind);
  for (const u of [ivy, hana, carter, gray, parent]) assert.deepEqual(pf(u), [], u.kind);
  assert.deepEqual(scopedSnapshot(parent).store.peerMoments, []);
});

test('the rate limit: 10 a day per student', () => {
  const before = api.snapshot();
  for (let i = api.peerGivenBy('S2002').length; i < api.PEER_DAY_LIMIT; i++) api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'think', text: `idea ${i}` }]);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'think', text: 'one more' }]), (e) => e.status === 429);
  api.restore(before);
});

test('thank and hide: the owner only; a hidden one leaves her copy, the giver is not told', () => {
  for (const u of [gus, brook, coord, admin]) { assert.ok(!canAct(u, 'thankPeerFeedback', [fb.id]), u.kind); assert.ok(!canAct(u, 'hidePeerFeedback', [fb.id]), u.kind); }
  assert.ok(canAct(fern, 'thankPeerFeedback', [fb.id]));
  api.thankPeerFeedback(fb.id);
  assert.ok(api.getPeerFeedback(fb.id).thanked);
  assert.equal(api.getStore().notifications[0].to, 'st:S2002');
  assert.match(api.getStore().notifications[0].text, /^Fern said thank you/);
  const f2 = api.givePeerFeedback(ev.id, 'S2002', [{ phrase: 'think', text: 'membranes.' }]);
  assert.ok(canAct(fern, 'hidePeerFeedback', [f2.id]));
  api.hidePeerFeedback(f2.id);
  assert.ok(!scopedSnapshot(fern).store.peerFeedback.some((f) => f.id === f2.id));
  const g = scopedSnapshot(gus).store.peerFeedback.find((f) => f.id === f2.id);
  assert.ok(g && !('hidden' in g), 'the giver keeps it, without knowing');
  assert.ok(scopedSnapshot(brook).store.peerFeedback.find((f) => f.id === f2.id).hidden, 'staff see it hidden');
});

test('a Year switched off: no list, no opting in, no giving; on again', () => {
  assert.ok(canAct(coord, 'setPeerFeedbackYear', [12, false, 'T104']));
  assert.ok(canAct({ kind: 'leadership', teacherId: 'T103' }, 'setPeerFeedbackYear', [12, false, 'T103']));
  assert.ok(canAct(admin, 'setPeerFeedbackYear', [12, false, null]));
  for (const u of [brook, gray, fern, parent]) assert.ok(!canAct(u, 'setPeerFeedbackYear', [12, false, u.teacherId ?? null]), u.kind);
  assert.ok(!canAct(coord, 'setPeerFeedbackYear', [12, false, 'T100']), 'as herself only');
  assert.throws(() => api.setPeerFeedbackYear(8, false, 'T104'), /Year 9 to 13/);
  api.setPeerFeedbackYear(12, false, 'T104');
  assert.deepEqual(scopedSnapshot(gus).store.peerMoments, []);
  assert.throws(() => api.givePeerFeedback(ev.id, 'S2002', parts), /not on for your Year/);
  assert.equal(scopedSnapshot(gus).store.peerSettings.offYears[0], 12, 'students get the switch');
  api.setPeerFeedbackYear(12, true, 'T104');
  assert.equal(scopedSnapshot(gus).store.peerMoments.length, 1);
});

test('reporting feedback: the owner, staff who read it; a moderator hides it', () => {
  const t = { feedbackId: fb.id };
  assert.ok(canAct(fern, 'reportItem', [t, 'unkind', '', { key: 'student' }]));
  assert.ok(canAct(brook, 'reportItem', [t, 'unkind', '', { key: 'T100' }]));
  assert.ok(!canAct(carter, 'reportItem', [t, 'unkind', '', { key: 'T101' }]), 'not his class, not his advisee');
  assert.ok(!canAct(gus, 'reportItem', [t, 'unkind', '', { key: 'student' }]));
  assert.ok(!canAct(ivy, 'reportItem', [t, 'unkind', '', { key: 'student' }]));
  assert.ok(!canAct(parent, 'reportItem', [t, 'unkind', '', { key: 'fam:S2001', name: 'P' }]));
  const r = api.reportItem(t, 'unkind', 'Not nice', { key: 'student' });
  assert.deepEqual([r.kind, r.feedbackId, r.studentId, r.status], ['feedback', fb.id, 'S2001', 'open']);
  assert.equal(api.reportItem(t, 'unkind', '', { key: 'student' }).id, r.id, 'one open report per person');
  assert.match(api.getStore().notifications.find((n) => n.to === 'role:coordinator').text, /kind feedback on “Osmosis practical”/);
  assert.equal(scopedSnapshot(fern).store.reports.find((x) => x.id === r.id).feedbackId, fb.id);
  assert.throws(() => api.moderateReport(r.id, 'photo', '', 'T104'), /no photo/);
  api.moderateReport(r.id, 'hide', 'Checked', 'T104');
  assert.ok(api.getPeerFeedback(fb.id).hidden);
  assert.equal(api.getReport(r.id).status, 'hidden');
  assert.ok(!scopedSnapshot(fern).store.peerFeedback.some((f) => f.id === fb.id), 'gone from the owner’s copy');
  assert.match(api.getStore().notifications[0].text, /hidden kind feedback/);
  const st = api.reportItem({ eventId: ev.id }, 'other', '', { key: 'T100' });
  api.moderateReport(st.id, 'none', '', 'T104');
  assert.equal(api.getReport(r.id).status, 'hidden', 'a report on the moment does not touch the feedback report');
});

test('PDPA: the copy has feedback given and received; erasure removes the giver’s feedback', () => {
  const owner = api.studentData('S2001').own.peerFeedback, giver = api.studentData('S2002').own.peerFeedback;
  assert.ok(owner.length >= 2 && owner.every((f) => !('fromId' in f) && f.fromName === 'Gus'));
  assert.ok(giver.length >= 2 && giver.every((f) => f.fromId === 'S2002'));
  assert.ok(api.studentData('S2001').own.events.find((e) => e.id === ev.id).peerFeedback);
  api.eraseStudent('S2002');
  assert.deepEqual(api.getStore().peerFeedback.filter((f) => f.fromId === 'S2002'), []);
});
