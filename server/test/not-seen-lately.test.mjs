// Not seen lately (api.notSeenLately, nudgeClass, openClassNudges): what counts, the weeks, who is left out, permissions,
// the 7 days, scoped copies (private moments counted but never sent, the advisor's count), PDPA. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nsl-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, touchedBy, setPausedStudents } = await import('../scope.mjs');
const { inferKind, groupOf } = await import('../../src/notify-kinds.js');

const brook = { kind: 'teacher', teacherId: 'T100' };  // teaches 12 Biology (S2001, S2002, Science line); advises both
const carter = { kind: 'teacher', teacherId: 'T101' }; // 12 Computer Science (S2001), 8 Robotics (S2003)
const ellis = { kind: 'leadership', teacherId: 'T103' }; // whole school; teaches 12 Maths (no line)
const coord = { kind: 'coordinator', teacherId: 'T104' }; // whole school; advises S2003; teaches 8 Visual Arts
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' };
const fam = { kind: 'parent', children: ['S2001'] };
const ago = (n) => api.daysBefore(n);
const quietIds = (cid, w) => api.notSeenLately(cid, w).quiet.map((q) => q.student.id);

test('setup: class lists, onboarded students', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
});

test('quiet: nothing for the class in N weeks (never first); a sub-line, a reflection, a spotted moment and the log count', () => {
  const r = api.notSeenLately('C-BIO12');
  assert.equal(r.line.id, 'science'); assert.equal(r.weeks, 4);
  assert.deepEqual(r.quiet.map((q) => [q.student.id, q.last, q.can]), [['S2001', null, true], ['S2002', null, true]]);
  // S2002: a Science moment 20 days ago is quiet at 2 weeks, not at 4 or 6.
  const e = api.addStation('S2002', { title: 'Titration lab', lineIds: ['science'], date: ago(20) });
  // ...but the log says it was added today: a back-dated moment counts on the day it was added.
  assert.deepEqual(quietIds('C-BIO12', 2), ['S2001']);
  api.getStore().activity = api.getStore().activity.filter((a) => !(a.studentId === 'S2002' && a.kind === 'station'));
  assert.deepEqual(quietIds('C-BIO12', 2), ['S2001', 'S2002']);
  assert.deepEqual(quietIds('C-BIO12', 4), ['S2001']);
  assert.deepEqual(quietIds('C-BIO12', 6), ['S2001']);
  assert.equal(api.notSeenLately('C-BIO12', 2).quiet.find((q) => q.student.id === 'S2002').last, ago(20));
  assert.equal(api.notSeenLately('C-BIO12', 5).weeks, 4, 'only 2, 4 or 6');
  // A reflection today on that moment counts.
  api.addReflection({ studentId: 'S2002', eventId: e.id, text: 'It turned pink.' });
  assert.deepEqual(quietIds('C-BIO12', 2), ['S2001']);
  // Another line does not count for Biology; a spotted moment from Computer Science counts for that class, whatever its line.
  api.addStation('S2001', { title: 'Sketchbook', lineIds: ['art'], date: ago(1) });
  assert.deepEqual(quietIds('C-BIO12', 2), ['S2001']);
  assert.deepEqual(quietIds('C-CS12', 4), ['S2001']);
  const [sp] = api.spotMoment(['S2001'], 'T101', { title: 'Explained recursion', lineId: 'art', classId: 'C-CS12' });
  api.acceptSpotted(sp.id, 'S2001');
  assert.deepEqual(quietIds('C-CS12', 4), []);
  assert.equal(api.notSeenLately('nope'), null);
});

test('no line: a hint, nobody listed; a nudge is refused', () => {
  const r = api.notSeenLately('C-MAT12');
  assert.equal(r.noLine, true); assert.deepEqual(r.quiet, []);
  assert.throws(() => api.nudgeClass('C-MAT12', ['S2001'], 'T103'), /not on a line/);
});

test('canAct: only a teacher of that class, as themselves, for students in it now', () => {
  assert.ok(canAct(brook, 'nudgeClass', ['C-BIO12', ['S2001'], 'T100']));
  assert.ok(canAct(brook, 'nudgeClass', ['C-BIO12', ['S2001', 'S2002'], 'T100', 'A line']));
  assert.ok(canAct(brook, 'nudgeClass', ['C-BIO12', 'S2001', 'T100']));
  assert.ok(!canAct(brook, 'nudgeClass', ['C-BIO12', ['S2003'], 'T100']), 'not in the class');
  assert.ok(!canAct(brook, 'nudgeClass', ['C-BIO12', [], 'T100']));
  assert.ok(!canAct(brook, 'nudgeClass', ['C-CS12', ['S2001'], 'T100']), 'not her class (though she advises S2001)');
  assert.ok(!canAct(brook, 'nudgeClass', ['C-BIO12', ['S2001'], 'T101']), 'only as herself');
  assert.ok(!canAct(carter, 'nudgeClass', ['C-BIO12', ['S2001'], 'T101']));
  assert.ok(canAct(carter, 'nudgeClass', ['C-CS12', ['S2001'], 'T101']));
  assert.ok(!canAct(ellis, 'nudgeClass', ['C-BIO12', ['S2001'], 'T103']), 'whole-school roles only for a class they teach');
  assert.ok(!canAct(coord, 'nudgeClass', ['C-BIO12', ['S2001'], 'T104']));
  assert.ok(!canAct({ kind: 'admin' }, 'nudgeClass', ['C-BIO12', ['S2001'], 'T100']), 'an admin with no staff record');
  assert.ok(canAct({ kind: 'admin', teacherId: 'T100' }, 'nudgeClass', ['C-BIO12', ['S2001'], 'T100']));
  assert.ok(!canAct(s1, 'nudgeClass', ['C-BIO12', ['S2001'], 'T100']));
  assert.ok(!canAct(fam, 'nudgeClass', ['C-BIO12', ['S2001'], 'T100']));
  assert.deepEqual(touchedBy('nudgeClass', ['C-BIO12', ['S2001', 'S2002'], 'T100']), { students: ['S2001', 'S2002'], as: ['T100'] });
});

let n1;
test('nudgeClass: the words, the notification (kind teacher, opens the add flow on the line), the 7 days, replayed the same', () => {
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  [n1] = api.nudgeClass('C-BIO12', ['S2001'], 'T100', '  A photo from the   lab would be great. ');
  api.setActionHook(null);
  assert.deepEqual([n1.classId, n1.studentId, n1.from, n1.lineId, n1.note, n1.date], ['C-BIO12', 'S2001', 'T100', 'science', 'A photo from the lab would be great.', api.TODAY]);
  assert.ok(!('text' in n1), 'the sentence is made when shown, never stored');
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.equal(nt.length, 1);
  assert.equal(nt[0].to, 'st:S2001');
  assert.equal(nt[0].text, 'Ms Brook would love to see something from Science: “A photo from the lab would be great.”');
  assert.equal(nt[0].kind, 'teacher');
  assert.deepEqual(nt[0].go, { persona: 'st:S2001', screen: 'map', param: 'add~science' });
  assert.equal(inferKind('Ms Brook would love to see something from Science'), 'teacher');
  assert.equal(groupOf('teacher', 'student')[0], 'teacher');
  assert.ok(api.getStore().activity.some((a) => a.studentId === 'S2001' && a.kind === 'nudge' && /Science/.test(a.text)));
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  // Once a week per student per class; another class may still nudge.
  assert.equal(api.canClassNudge('C-BIO12', 'S2001'), false);
  assert.throws(() => api.nudgeClass('C-BIO12', ['S2001'], 'T100'), (e) => e.status === 409);
  assert.throws(() => api.nudgeClass('C-BIO12', ['S2002', 'S2001'], 'T100'), (e) => e.status === 409, 'all or nothing');
  assert.equal(api.getStore().classNudges.length, 1);
  assert.equal(api.notSeenLately('C-BIO12').quiet.find((q) => q.student.id === 'S2001').can, false);
  api.nudgeClass('C-CS12', ['S2001'], 'T101');
  assert.throws(() => api.nudgeClass('C-BIO12', ['S2003'], 'T100'), /not in this class/);
  assert.throws(() => api.nudgeClass('C-BIO12', ['S2002'], 'T101'), (e) => e.status === 403);
  const [long] = api.nudgeClass('C-ROB8', ['S2003'], 'T101', 'x'.repeat(200));
  assert.equal(long.note.length, api.NSL_NOTE_MAX);
});

test('scope: the student their own; that class\'s teachers whole; the advisor and whole-school roles a count; nobody else', () => {
  const rows = (u) => scopedSnapshot(u).store.classNudges;
  assert.deepEqual(rows(s1).map((n) => n.classId).sort(), ['C-BIO12', 'C-CS12']);
  assert.ok(rows(s1).every((n) => n.studentId === 'S2001' && 'note' in n));
  assert.deepEqual(rows(s2), []);
  assert.deepEqual(rows(fam), [], 'families never');
  // Ms Brook: her Biology nudge whole; Computer Science's to her advisee as a count only.
  const b = rows(brook);
  assert.deepEqual(b.find((n) => n.classId === 'C-BIO12'), n1);
  assert.deepEqual(Object.keys(b.find((n) => n.classId !== 'C-BIO12')).sort(), ['date', 'id', 'studentId']);
  assert.equal(b.length, 2);
  // Mr Carter: his two; not Biology's.
  assert.deepEqual(rows(carter).map((n) => n.classId).sort(), ['C-CS12', 'C-ROB8']);
  assert.ok(rows(carter).every((n) => n.note !== undefined));
  // Whole school (not teaching those classes): counts only.
  assert.ok(rows(coord).length === 3 && rows(coord).every((n) => Object.keys(n).length === 3));
  // Counts on the advisor's page.
  assert.equal(api.subjectNudgeCount('S2001'), 2);
});

test('private moments count for the teacher, only as a date; paused and new students are left out', () => {
  const p = api.addStation('S2002', { title: 'Private Science notes', lineIds: ['science'], visibility: 'private' });
  setPausedStudents(() => new Set(['S2003']));
  const snap = scopedSnapshot(brook);
  assert.ok(!snap.store.events.some((e) => e.id === p.id), 'the private moment itself is never sent');
  assert.equal(snap.store.lineSeen['C-BIO12'].last.S2002, api.TODAY);
  assert.deepEqual(snap.store.lineSeen['C-BIO12'].paused, []);
  assert.equal(JSON.stringify(snap.store.lineSeen).includes('Private'), false);
  assert.deepEqual(scopedSnapshot(carter).store.lineSeen['C-ROB8'].paused, ['S2003']);
  assert.deepEqual(Object.keys(snap.store.lineSeen), ['C-BIO12']);
  assert.deepEqual(scopedSnapshot(s1).store.lineSeen, {});
  assert.deepEqual(scopedSnapshot(fam).store.lineSeen, {});
  // A later class list adds S2003 to Biology: new to the class for 2 weeks.
  const fx = structuredClone(FX); fx.enrolments.push({ studentId: 'S2003', classId: 'C-BIO12' });
  api.importRoster(fx);
  assert.equal(api.getStore().classJoins['S2003|C-BIO12'], api.TODAY);
  assert.equal(api.getStore().classJoins['S2001|C-BIO12'], undefined);
  const r = api.notSeenLately('C-BIO12');
  assert.equal(r.left.isNew, 1);
  assert.ok(!r.quiet.some((q) => q.student.id === 'S2003'));
  assert.deepEqual(scopedSnapshot(s1).store.classJoins, {});
  setPausedStudents(() => new Set());
});

test('the student: a banner per class until they do something for it after the nudge', () => {
  // What they did before the nudge (Computer Science's spotted moment, earlier today) does not close it.
  const open = api.openClassNudges('S2001');
  assert.deepEqual(open.map((n) => n.classId).sort(), ['C-BIO12', 'C-CS12']);
  const bio = open.find((n) => n.classId === 'C-BIO12');
  assert.equal(bio.text, 'Ms Brook would love to see something from Science');
  assert.equal(bio.line.id, 'science');
  api.addStation('S2001', { title: 'Sketch of a cell', lineIds: ['art'] });
  assert.equal(api.openClassNudges('S2001').length, 2, 'another line does not close it');
  api.addStation('S2001', { title: 'Osmosis photo', lineIds: ['science'], date: ago(40) });
  assert.deepEqual(api.openClassNudges('S2001').map((n) => n.classId), ['C-CS12'], 'a back-dated moment added now closes it');
  assert.deepEqual(api.openClassNudges('S2003').map((n) => n.classId), ['C-ROB8']);
});

test('PDPA: nudges are part of the student\'s copy and their erasure', () => {
  const d = api.studentData('S2002');
  assert.ok(!d.own.classNudges?.length);
  api.nudgeClass('C-BIO12', ['S2002'], 'T100');
  assert.equal(api.studentData('S2002').own.classNudges.length, 1);
  api.eraseStudent('S2002');
  assert.ok(!api.getStore().classNudges.some((n) => n.studentId === 'S2002'));
});

test('a teacher\'s browser copy: the server\'s days and paused students are used', () => {
  setPausedStudents(() => new Set(['S2001']));
  const snap = scopedSnapshot(brook);
  setPausedStudents(() => new Set());
  api.load(structuredClone(snap));
  const r = api.notSeenLately('C-BIO12', 2);
  assert.equal(r.left.paused, 1);
  assert.deepEqual(r.quiet.map((q) => q.student.id), []);
});
