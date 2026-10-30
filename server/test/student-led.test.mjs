// Student-led conferences (api.saveConfPrep, writeConfNote, conferenceDeck): who may prepare and write each line, what the
// prep keeps (own, not private, at most three), the notifications, an old family line hidden (since 30 October 2026), what each person's copy holds, the
// conference sheet, deterministic replay and PDPA. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-slc-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { studentThai } = await import('../../src/i18n.js');

const brook = { kind: 'advisor', teacherId: 'T100' };  // advises S2001, S2002 (12B)
const fong = { kind: 'coordinator', teacherId: 'T104' }; // coordinator, advises S2003 (Year 8)
const carter = { kind: 'teacher', teacherId: 'T101' };   // teaches S2001 and S2003
const gray = { kind: 'advisor', teacherId: 'T105' };     // advises nobody
const hana = { kind: 'student', studentId: 'S2003' }, fern = { kind: 'student', studentId: 'S2001' };
const itoFamily = { kind: 'parent', children: ['S2003'] }, galeFamily = { kind: 'parent', children: ['S2001'] };
const admin = { kind: 'admin' };
const day = (n) => api.daysBefore(-n);
let R, Y, m1, m2, m3, m4, priv, goal, other;

test('setup: class lists, moments, a round for each advisory', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science']; }
  const add = (sid, title, extra = {}) => api.addStation(sid, { title, lineIds: ['art'], date: day(-5), type: 'project', visibility: 'advisor', ...extra });
  m1 = add('S2003', 'Painted the mural', { evidence: [{ kind: 'image', url: 'api/files/mural.jpg', caption: 'Mural' }] });
  m2 = add('S2003', 'Built a robot arm', { summary: 'It picks up a cup.' });
  m3 = add('S2003', 'School play', { visibility: 'school' });
  m4 = add('S2003', 'Sketchbook');
  priv = add('S2003', 'My diary', { visibility: 'private' });
  goal = api.addGoal('S2003', { title: 'Learn to code', date: day(40), lineId: 'science', checkIn: false });
  other = add('S2001', 'Fern’s essay');
  R = api.openConferenceRound({ title: 'Term 1 conferences', slot: 15, days: [{ date: day(2), from: '15:00', to: '17:00' }], breaks: [], location: 'Room 8A', advisorId: 'T104' }, 'T104');
  Y = api.openConferenceRound({ title: '12B conferences', slot: 15, days: [{ date: day(3), from: '15:00', to: '16:00' }], breaks: [], location: 'Room 12B', advisorId: 'T100' }, 'T100');
  assert.deepEqual(R.studentIds, ['S2003']);
  assert.equal(api.myConfPrep('S2003').round.id, R.id);
  assert.ok(api.youngConf('S2003') && !api.youngConf('S2001'), 'Year 8 is middle school, Year 12 is not');
});

test('canAct: only the student prepares, on their own, in their round', () => {
  const draft = { picks: [m1.id] };
  assert.ok(canAct(hana, 'saveConfPrep', [R.id, 'S2003', draft, false]));
  assert.ok(!canAct(fern, 'saveConfPrep', [R.id, 'S2003', draft]), 'not another student');
  assert.ok(!canAct(fern, 'saveConfPrep', [R.id, 'S2001', draft]), 'not in a round they are not in');
  assert.ok(canAct(fern, 'saveConfPrep', [Y.id, 'S2001', draft]));
  for (const u of [fong, brook, carter, itoFamily, admin]) assert.ok(!canAct(u, 'saveConfPrep', [R.id, 'S2003', draft]), `${u.kind} never prepares for a student`);
});

test('saveConfPrep: own moments only, never private, at most three; replayed exactly; ready needs something to show', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const p = api.saveConfPrep(R.id, 'S2003', { picks: [priv.id, other.id, m1.id, m2.id, m3.id, m4.id], says: { [m1.id]: ' I mixed the colours myself. ', [priv.id]: 'secret' }, proud: 'I kept going', goal: { goalId: other.id }, step: 3 });
  api.setActionHook(null);
  assert.deepEqual(p.picks, [m1.id, m2.id, m3.id], 'private and other students’ moments left out, three kept');
  assert.deepEqual(p.says, { [m1.id]: 'I mixed the colours myself.' });
  assert.equal(p.goal, null, 'another student’s station is not a goal of theirs');
  assert.equal(p.status, 'draft');
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.throws(() => api.saveConfPrep(R.id, 'S2003', { picks: [], proud: '' }, true), /Pick something to show/);
  const q = api.saveConfPrep(R.id, 'S2003', { picks: [m1.id, m2.id], says: { [m1.id]: 'I mixed the colours myself.' }, proud: 'I kept going when it was hard', hard: 'Waiting for the paint to dry', goal: { goalId: goal.id } }, true);
  assert.equal(q.status, 'ready'); assert.ok(q.readyAt);
  assert.deepEqual(q.goal, { goalId: goal.id });
  assert.throws(() => api.saveConfPrep(R.id, 'S2001', {}), /not for you/);
  assert.deepEqual(api.prepProgress(R.id, 'T104'), { rows: [{ student: api.getStudent('S2003'), status: 'ready', note: false }], total: 1, ready: 1, started: 0 });
});

test('conferenceDeck: one moment a screen with its photo and words, then proud, hard and the goal', () => {
  const d = api.conferenceDeck(R.id, 'S2003', 'advisor');
  assert.deepEqual(d.moments.map((m) => [m.title, m.photo, m.say]), [['Painted the mural', 'api/files/mural.jpg', 'I mixed the colours myself.'], ['Built a robot arm', null, '']]);
  assert.equal(d.moments[1].summary, 'It picks up a cup.');
  assert.deepEqual([d.proud, d.hard, d.goal.title, d.young, d.first], ['I kept going when it was hard', 'Waiting for the paint to dry', 'Learn to code', true, 'Hana']);
});

test('writeConfNote: the student and the advisor; the family line is gone (since 30 October 2026)', () => {
  const fam = [R.id, 'S2003', 'family', 'Read together after dinner', 'family'];
  for (const u of [itoFamily, galeFamily, hana, fong, admin]) assert.ok(!canAct(u, 'writeConfNote', fam), `${u.kind}: no family line`);
  assert.ok(!canAct(fong, 'writeConfNote', [R.id, 'S2003', 'family', 'x', 'T104']), 'not even the advisor');
  assert.ok(!canAct(itoFamily, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'family']), 'a family never writes the student’s line');
  assert.ok(canAct(hana, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'student']));
  assert.ok(!canAct(fern, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'student']));
  assert.ok(canAct(fong, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T104']), 'the advisor writes it for them, as herself');
  assert.ok(!canAct(fong, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T100']));
  assert.ok(canAct(brook, 'writeConfNote', [Y.id, 'S2001', 'student', 'x', 'T100']));
  assert.ok(!canAct(brook, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T100']), 'not another advisory');
  assert.ok(!canAct(carter, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T101']), 'not a subject teacher');
  assert.ok(!canAct(gray, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T105']));
  assert.throws(() => api.writeConfNote(R.id, 'S2003', 'student', '   ', 'student'), /Write one line first/);
  assert.throws(() => api.writeConfNote(R.id, 'S2003', 'teacher', 'x', 'T104'), /whose line/);

  // An old family line replays as nothing: no note made, nobody told.
  const n0 = api.getStore().notifications.length;
  assert.equal(api.runAction('writeConfNote', fam, []), null);
  assert.equal(api.getStore().notifications.length, n0);
  assert.equal(api.confNoteOf(R.id, 'S2003'), null);
  api.writeConfNote(R.id, 'S2003', 'student', 'Finish the robot arm', 'student');
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0).reverse();
  assert.deepEqual(nt.map((n) => [n.to, n.text]), [['t:T104', 'Hana Ito wrote on the conference note']]);
  assert.ok(nt.every((n) => n.kind === 'conference'), 'kind: conference (notification settings)');
  api.writeConfNote(R.id, 'S2003', 'student', 'Finish the robot arm by December', 'T104');
  assert.equal(api.confNoteOf(R.id, 'S2003').student.by, 'T104', 'the advisor may write it for them; writing again replaces it');
  assert.equal(studentThai(api.getStore().notifications[0].text), 'Ms Fong เขียนในบันทึกการประชุมของคุณแล้ว');
  // A pilot's family line written before the change stays in the record (PDPA), and shows nowhere.
  api.confNoteOf(R.id, 'S2003').family = { text: 'Read together after dinner', by: 'family', at: '2026-10-01T10:00:00.000Z' };
  api.getStore().notifications.unshift({ id: 'nt-old-fam', to: 'st:S2003', text: 'Your family wrote on your conference note', kind: 'conference', at: '2026-10-01T10:00:00.000Z' });
  assert.equal(api.studentConfNote(R.id, 'S2003').family, null);
  assert.equal(api.conferenceDeck(R.id, 'S2003').note.family, null);
  assert.ok(api.confNotesFor('S2003').every((x) => x.family === null));
  api.addNote('S2003', 'Conference (Term 1 conferences): talk to Mr Carter about robotics club');
  assert.equal(api.getConfNotes().length, 1);
});

test('scope: the prep and the note to the student, their advisor and whole-school roles; never the family', () => {
  const of = (u) => scopedSnapshot(u).store;
  const s = of(hana), f = of(itoFamily), a = of(fong), c = of(carter), b = of(brook), g = of(galeFamily);
  assert.equal(s.confPreps.length, 1); assert.equal(s.confNotes.length, 1);
  assert.equal(a.confPreps.length, 1); assert.equal(a.confNotes.length, 1);
  assert.equal(f.confPreps.length + f.confNotes.length, 0, 'the family gets neither');
  for (const x of [s, a]) assert.ok(!JSON.stringify(x).includes('Read together after dinner') && !JSON.stringify(x).includes('Your family wrote'), 'an old family line goes to nobody');
  assert.equal(c.confPreps.length, 0, 'a subject teacher gets neither'); assert.equal(c.confNotes.length, 0);
  assert.equal(b.confPreps.length + b.confNotes.length, 0); assert.equal(g.confPreps.length + g.confNotes.length, 0);
  assert.ok(!JSON.stringify(f).includes('mixed the colours'));
  assert.ok(!s.notes?.S2003, 'the private staff note never reaches the student');
  assert.ok(!f.notes?.S2003, 'nor the family');
  assert.match(a.notes.S2003.at(-1).text, /robotics club/);
  assert.ok(!a.events.some((e) => e.id === priv.id), 'the advisor never gets the private moment');
});

test('the conference sheet carries the prep; the family copy only what the family view shows', () => {
  const a = api.sheetPrep('S2003', 'advisor');
  assert.deepEqual(a, { ready: true, picks: [{ id: m1.id, title: 'Painted the mural', say: 'I mixed the colours myself.' }, { id: m2.id, title: 'Built a robot arm', say: '' }], proud: 'I kept going when it was hard', hard: 'Waiting for the paint to dry', goal: 'Learn to code' });
  // A Year 10 student's family sees only what they share with the school, so an advisor-level pick stays off the family copy.
  api.getStudent('S2001').grade = 9;
  api.saveConfPrep(Y.id, 'S2001', { picks: [other.id], proud: 'My essay' }, true);
  assert.equal(api.sheetPrep('S2001', 'advisor').picks.length, 1);
  assert.equal(api.familyViewer('S2001'), 'school');
  assert.deepEqual(api.sheetPrep('S2001', api.familyViewer('S2001')).picks, [], 'the family copy leaves it out');
  assert.equal(api.sheetPrep('S2002'), null, 'nothing prepared, no box');
  assert.deepEqual(scopedSnapshot(brook).store.confPreps.map((p) => p.studentId), ['S2001'], 'an advisor (not whole-school) gets their advisee’s prep');
  assert.deepEqual(scopedSnapshot(carter).store.confPreps, [], 'their subject teacher does not');
});

test('PDPA: the prep and the note are in the student’s copy and go with erasure', () => {
  const d = api.studentData('S2003');
  assert.equal(d.own.confPreps?.length, 1); assert.equal(d.own.confNotes?.length, 1);
  assert.equal(d.own.confNotes[0].family.text, 'Read together after dinner', 'the old family line is in the copy');
  assert.deepEqual(api.studentData('S2001').own.confPreps.map((p) => p.studentId), ['S2001'], 'another student’s copy has only their own');
  const removed = api.eraseStudent('S2003');
  assert.equal(removed.confPreps, 1); assert.equal(removed.confNotes, 1);
  assert.ok(![...api.getConfPreps(), ...api.getConfNotes()].some((x) => x.studentId === 'S2003'), 'none of hers left');
  assert.equal(api.getConfPreps().length, 1, 'another student’s stays');
  assert.deepEqual(api.getConferenceRound(R.id).studentIds, []);
});
