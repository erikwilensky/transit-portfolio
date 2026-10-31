// Conferences and student-led conferences (api.addConference, saveConfPrep, writeConfNote, conferenceDeck): who may add a
// conference, who may prepare and write the line, what the prep keeps (own, not private, at most three), prep open until
// the last date, the notifications, what each person's copy holds, the conference sheet, deterministic replay and PDPA.
// Run: npm run test:server.
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

test('setup: class lists, moments, a conference for each advisory', () => {
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
  R = api.addConference({ title: 'Term 1 conferences', from: day(2), advisorId: 'T104' }, 'T104');
  Y = api.addConference({ title: '12B conferences', from: day(3), to: day(4), advisorId: 'T100' }, 'T100');
  assert.deepEqual([R.studentIds, R.from, R.to], [['S2003'], day(2), day(2)], 'one date: from and to the same');
  assert.deepEqual(Y.studentIds, ['S2001', 'S2002']);
  assert.ok(!('days' in R) && !('slot' in R), 'no times');
  assert.equal(api.myConfPrep('S2003').conference.id, R.id);
  assert.ok(api.youngConf('S2003') && !api.youngConf('S2001'), 'Year 8 is middle school, Year 12 is not');
});

test('conferences: who adds, changes and removes one; the dates; nothing for families', () => {
  const spec = { title: 'x', from: day(5), advisorId: 'T104' };
  assert.ok(canAct(fong, 'addConference', [spec, 'T104']), 'an advisor for their advisory');
  assert.ok(canAct(fong, 'addConference', [{ title: 'x', from: day(5), year: 12 }, 'T104']), 'a coordinator (whole school) for a Year');
  assert.ok(!canAct(brook, 'addConference', [spec, 'T100']), 'not another advisory');
  assert.ok(!canAct(brook, 'addConference', [{ title: 'x', from: day(5), year: 12 }, 'T100']), 'an advisor never a whole Year');
  assert.ok(!canAct(brook, 'addConference', [{ ...spec, advisorId: 'T100' }, 'T104']), 'only as themselves');
  assert.ok(canAct(admin, 'addConference', [{ title: 'x', from: day(5), year: 8 }, null]));
  for (const u of [hana, itoFamily, carter]) assert.ok(!canAct(u, 'addConference', [spec, u.teacherId ?? null]), `${u.kind}: never`);
  assert.ok(canAct(fong, 'editConference', [R.id, { from: day(3) }, 'T104']));
  assert.ok(canAct(brook, 'editConference', [Y.id, { from: day(3) }, 'T100']));
  assert.ok(!canAct(brook, 'editConference', [R.id, { from: day(3) }, 'T100']), 'not another advisor’s');
  assert.ok(!canAct(gray, 'removeConference', [R.id, 'T105']));
  for (const u of [hana, itoFamily]) assert.ok(!canAct(u, 'removeConference', [R.id, null]));
  assert.throws(() => api.addConference(spec, 'T104'), /already have a conference coming up/);
  assert.throws(() => api.addConference({ title: 'x', from: day(-1), year: 7 }, 'T104'), /from today on/);
  assert.throws(() => api.addConference({ title: 'x', from: day(5), to: day(4), year: 8 }, 'T104'), /Pick a date/);
  assert.throws(() => api.addConference({ title: 'x', from: day(5), to: day(40), year: 8 }, 'T104'), /within a month/);
  assert.throws(() => api.addConference({ title: 'x', from: day(5), advisorId: 'T105' }, 'T105'), /No students/);
  assert.throws(() => api.editConference(R.id, { from: day(-2) }, 'T104'), /from today on/);
  const e = api.editConference(Y.id, { title: '12B parent conferences', from: day(3), to: day(4) }, 'T100');
  assert.deepEqual([e.title, e.from, e.to], ['12B parent conferences', day(3), day(4)]);
  assert.match(api.confDates(e), /^\d{1,2} \w{3} \d{4} to \d{1,2} \w{3} \d{4}$/);
  assert.match(api.confDates(R), /^\d{1,2} \w{3} \d{4}$/);
  // A Year conference tells each other advisor (kind conference). Students already in one coming up are left out.
  api.removeConference(Y.id);
  const n0 = api.getStore().notifications.length;
  const yc = api.addConference({ title: 'Year 12 evening', from: day(20), year: 12 }, 'T104');
  assert.deepEqual([yc.studentIds, yc.advisorIds], [['S2001', 'S2002'], ['T100']]);
  assert.throws(() => api.addConference({ title: 'Again', from: day(21), year: 12 }, 'T104'), /already have a conference/);
  const told = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.ok(told.some((n) => n.to === 't:T100' && /^Ms Fong added a conference for Year 12: “Year 12 evening”, /.test(n.text) && n.kind === 'conference'));
  api.removeConference(yc.id);
  Y = api.addConference({ title: '12B conferences', from: day(3), to: day(4), advisorId: 'T100' }, 'T100');
  assert.equal(scopedSnapshot(itoFamily).store.conferences.length, 0, 'families get no conferences');
  assert.deepEqual(scopedSnapshot(hana).store.conferences.map((c) => [c.id, c.studentIds]), [[R.id, ['S2003']]], 'a student only theirs, only their id');
  assert.deepEqual(scopedSnapshot(carter).store.conferences.flatMap((c) => c.studentIds).sort(), ['S2001', 'S2003'], 'a teacher only those in reach');
  assert.equal(scopedSnapshot(fong).store.conferences.length, 2, 'whole school: all');
});

test('canAct: only the student prepares, on their own, in their conference', () => {
  const draft = { picks: [m1.id] };
  assert.ok(canAct(hana, 'saveConfPrep', [R.id, 'S2003', draft, false]));
  assert.ok(!canAct(fern, 'saveConfPrep', [R.id, 'S2003', draft]), 'not another student');
  assert.ok(!canAct(fern, 'saveConfPrep', [R.id, 'S2001', draft]), 'not in a conference they are not in');
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
  assert.deepEqual([d.proud, d.hard, d.goal.title, d.young, d.first, d.conference.id], ['I kept going when it was hard', 'Waiting for the paint to dry', 'Learn to code', true, 'Hana', R.id]);
});

test('writeConfNote: the student, or the advisor for them; only the student’s line', () => {
  for (const u of [itoFamily, galeFamily, hana, fong, admin]) assert.ok(!canAct(u, 'writeConfNote', [R.id, 'S2003', 'family', 'x', u.teacherId ?? 'student']), `${u.kind}: only the student’s line`);
  assert.ok(!canAct(itoFamily, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'student']), 'a family never writes');
  assert.ok(canAct(hana, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'student']));
  assert.ok(!canAct(fern, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'student']));
  assert.ok(canAct(fong, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T104']), 'the advisor writes it for them, as herself');
  assert.ok(!canAct(fong, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T100']));
  assert.ok(canAct(brook, 'writeConfNote', [Y.id, 'S2001', 'student', 'x', 'T100']));
  assert.ok(!canAct(brook, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T100']), 'not another advisory');
  assert.ok(!canAct(carter, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T101']), 'not a subject teacher');
  assert.ok(!canAct(gray, 'writeConfNote', [R.id, 'S2003', 'student', 'x', 'T105']));
  assert.throws(() => api.writeConfNote(R.id, 'S2003', 'student', '   ', 'student'), /Write one line first/);
  assert.throws(() => api.writeConfNote(R.id, 'S2003', 'family', 'x', 'T104'), /whose line/);
  const n0 = api.getStore().notifications.length;
  api.writeConfNote(R.id, 'S2003', 'student', 'Finish the robot arm', 'student');
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0).reverse();
  assert.deepEqual(nt.map((n) => [n.to, n.text]), [['t:T104', 'Hana Ito wrote on the conference note']]);
  assert.ok(nt.every((n) => n.kind === 'conference'), 'kind: conference (notification settings)');
  api.writeConfNote(R.id, 'S2003', 'student', 'Finish the robot arm by December', 'T104');
  assert.equal(api.confNoteOf(R.id, 'S2003').student.by, 'T104', 'the advisor may write it for them; writing again replaces it');
  assert.deepEqual(Object.keys(api.confNoteOf(R.id, 'S2003')).sort(), ['conferenceId', 'id', 'student', 'studentId']);
  assert.equal(studentThai(api.getStore().notifications[0].text), 'Ms Fong เขียนในบันทึกการประชุมของคุณแล้ว');
  assert.match(studentThai(`Your conference: ${api.confDates(R)}`), /^การประชุมของคุณ: /);
  assert.ok(!/[A-Za-z]{3}/.test(studentThai(`Your conference: ${api.confDates(Y)}`)), 'a date range reads in Thai');
  api.addNote('S2003', 'Conference (Term 1 conferences): talk to Mr Carter about robotics club');
  assert.equal(api.getConfNotes().length, 1);
});

test('prep stays open until the last date has passed; a conference with prep cannot be removed', () => {
  assert.throws(() => api.removeConference(R.id), /1 student has started getting ready/);
  const c = api.getConference(R.id), keep = [c.from, c.to];
  c.from = c.to = api.daysBefore(1);
  assert.equal(api.myConfPrep('S2003'), null);
  assert.throws(() => api.saveConfPrep(R.id, 'S2003', { proud: 'x' }), /finished/);
  c.from = c.to = api.TODAY;
  assert.equal(api.myConfPrep('S2003').conference.id, R.id, 'still open on the day');
  [c.from, c.to] = keep;
});

test('scope: the prep and the note to the student, their advisor and whole-school roles; never the family', () => {
  const of = (u) => scopedSnapshot(u).store;
  const s = of(hana), f = of(itoFamily), a = of(fong), c = of(carter), b = of(brook), g = of(galeFamily);
  assert.equal(s.confPreps.length, 1); assert.equal(s.confNotes.length, 1);
  assert.equal(a.confPreps.length, 1); assert.equal(a.confNotes.length, 1);
  assert.equal(f.confPreps.length + f.confNotes.length, 0, 'the family gets neither');
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

test('the conference sheet after the conference: the student’s line on both copies, the staff note on the advisor copy only', () => {
  const adv = api.sheetSteps('S2003'), fam = api.sheetSteps('S2003', true);
  assert.deepEqual([adv.title, adv.student, adv.staff], ['Term 1 conferences', 'Finish the robot arm by December', 'talk to Mr Carter about robotics club']);
  assert.equal(adv.note, api.getNotes('S2003').at(-1), 'the advisor note itself (so the sheet does not show it twice)');
  assert.deepEqual([fam.student, fam.staff, fam.note], ['Finish the robot arm by December', '', null], 'the family copy: never the staff note');
  api.addNote('S2003', 'Conference (Another one): not this one');
  assert.equal(api.sheetSteps('S2003').staff, 'talk to Mr Carter about robotics club', 'only the note for that conference');
  // Only a staff note so far: the advisor copy shows it, the family copy shows nothing.
  api.writeConfNote(Y.id, 'S2001', 'student', 'x', 'T100'); api.getConfNotes().find((n) => n.conferenceId === Y.id).student = null;
  api.addNote('S2001', 'Conference (12B conferences): quiet today');
  assert.equal(api.sheetSteps('S2001').staff, 'quiet today');
  assert.equal(api.sheetSteps('S2001', true), null);
  assert.equal(api.sheetSteps('S2002'), null, 'no conference yet, no box');
});

test('PDPA: the prep and the note are in the student’s copy and go with erasure', () => {
  const d = api.studentData('S2003');
  assert.equal(d.own.confPreps?.length, 1); assert.equal(d.own.confNotes?.length, 1);
  assert.deepEqual(api.studentData('S2001').own.confPreps.map((p) => p.studentId), ['S2001'], 'another student’s copy has only their own');
  const removed = api.eraseStudent('S2003');
  assert.equal(removed.confPreps, 1); assert.equal(removed.confNotes, 1);
  assert.ok(![...api.getConfPreps(), ...api.getConfNotes()].some((x) => x.studentId === 'S2003'), 'none of hers left');
  assert.equal(api.getConfPreps().length, 1, 'another student’s stays');
  assert.deepEqual(api.getConference(R.id).studentIds, [], 'the conference loses the id');
});
