// My classes and subjects on lines (api.classesOf, classRoster, setSubjectLine). Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-classes-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const MATHS = 'Mathematics: analysis and approaches';
const roster = (patch = {}) => ({ ...structuredClone(FX), ...patch });

test('setup: the fixture leaves Mathematics off every line', () => {
  api.importRoster(roster());
  assert.equal(api.getClasses().find((c) => c.id === 'C-MAT12').lineId, null);
  assert.deepEqual(api.subjectsOffLines().map((r) => [r.subject, r.classes, r.decided]), [[MATHS, 1, false]]);
});

test('setSubjectLine: every class of the subject, remembered, deterministic on replay', () => {
  const before = api.snapshot();
  assert.equal(api.setSubjectLine(MATHS, 'science'), 1);
  assert.equal(api.getClasses().find((c) => c.id === 'C-MAT12').lineId, 'science');
  assert.deepEqual(api.getSubjectLines(), { [MATHS]: 'science' });
  assert.deepEqual(api.subjectsOffLines().map((r) => [r.subject, r.decided, r.lineId]), [[MATHS, true, 'science']], 'a decided subject stays listed so it can change');
  const after = api.snapshot();
  api.restore(before);
  api.runAction('setSubjectLine', [MATHS, 'science'], []);
  assert.equal(api.snapshot(), after);
  assert.throws(() => api.setSubjectLine(MATHS, 'nope'), /Not a school line/);
  assert.throws(() => api.setSubjectLine('  ', 'science'), /subject/);
  assert.equal(api.getClasses().find((c) => c.id === 'C-MAT12').lineId, 'science', 'a refused call changes nothing');
});

test('a later import keeps the choice and applies it to new classes of the subject', () => {
  const r = roster({ classes: [...FX.classes, { id: 'C-MAT11', name: '11 Maths AA SL', subject: MATHS, year: 11, level: 'SL', teacherIds: ['T103'] }] });
  const sum = api.importRoster(r);
  assert.equal(sum.added.classes, 1);
  assert.equal(sum.updated.classes, 0, 'C-MAT12 keeps its line');
  assert.equal(api.getClasses().find((c) => c.id === 'C-MAT11').lineId, 'science');
  assert.ok(!sum.unmatchedClasses.some((c) => c.subject === MATHS));
  // Leave it off the map: null, remembered, and the import keeps it off.
  assert.equal(api.setSubjectLine(MATHS, null), 2);
  assert.deepEqual(api.getSubjectLines(), { [MATHS]: null });
  api.importRoster(r);
  assert.equal(api.getClasses().find((c) => c.id === 'C-MAT11').lineId, null);
  // A class's own line in the file still wins; other roster behaviour is unchanged.
  assert.equal(api.getClasses().find((c) => c.id === 'C-ROB8').lineId, 'computing');
  assert.equal(api.getClasses().find((c) => c.id === 'C-BIO12').lineId, 'science');
  api.setSubjectLine(MATHS, 'science');
});

test('canAct: admin and whole-school staff only', () => {
  const a = [MATHS, 'science'];
  assert.equal(canAct({ kind: 'admin' }, 'setSubjectLine', a), true);
  assert.equal(canAct({ kind: 'coordinator', teacherId: 'T104' }, 'setSubjectLine', a), true);
  assert.equal(canAct({ kind: 'leadership', teacherId: 'T103' }, 'setSubjectLine', a), true);
  assert.equal(canAct({ kind: 'teacher', teacherId: 'T101' }, 'setSubjectLine', a), false);
  assert.equal(canAct({ kind: 'advisor', teacherId: 'T100' }, 'setSubjectLine', a), false);
  assert.equal(canAct({ kind: 'student', studentId: 'S2001' }, 'setSubjectLine', a), false);
  assert.equal(canAct({ kind: 'parent', children: ['S2001'] }, 'setSubjectLine', a), false);
});

test('classesOf and classRoster: current places, moments on the line in 30 days, requests to this teacher', () => {
  const s = api.getStore();
  api.useLiveDate(); // the pilot's real calendar
  const today = api.TODAY, old = api.daysBefore(40);
  s.events.push(
    { id: 'ev-t1', studentId: 'S2001', title: 'Enzyme lab', date: api.daysBefore(3), lineIds: ['science'], type: 'project', evidence: [], verification: 'student-added', visibility: 'school' },
    { id: 'ev-t2', studentId: 'S2002', title: 'Old lab', date: old, lineIds: ['science'], type: 'project', evidence: [], verification: 'student-added', visibility: 'school' },
    { id: 'ev-t3', studentId: 'S2002', title: 'Goal', date: today, lineIds: ['science'], type: 'goal', evidence: [], verification: 'student-added', visibility: 'school' },
    { id: 'ev-t4', studentId: 'S2001', title: 'Robot', date: today, lineIds: ['computing'], type: 'project', evidence: [], verification: 'student-added', visibility: 'school' },
  );
  s.requests.push({ id: 'rq-t1', eventId: 'ev-t1', studentId: 'S2001', teacherId: 'T100', date: today, status: 'pending' });
  // S2002 left Biology (the place ended yesterday); a second class for T100 with no places yet stays listed.
  s.enrolments.find((e) => e.studentId === 'S2002' && e.classId === 'C-BIO12').to = api.daysBefore(1);
  const mine = api.classesOf('T100');
  assert.deepEqual(mine.map((c) => [c.id, c.studentIds, c.recent, c.line?.id]), [['C-BIO12', ['S2001'], 1, 'science']]);
  const maths = api.classesOf('T103').find((c) => c.id === 'C-MAT12');
  assert.deepEqual([maths.studentIds.sort(), maths.recent], [['S2001', 'S2002'], 1], 'old moments and goals do not count');
  const bio = api.classRoster('C-BIO12', 'T100');
  assert.equal(bio.students.length, 1);
  assert.equal(bio.students[0].last.id, 'ev-t1'); assert.equal(bio.students[0].pending, 1);
  const m = api.classRoster('C-MAT12', 'T103');
  assert.deepEqual(m.students.map((x) => [x.student.id, x.last?.id ?? null, x.pending]), [['S2001', 'ev-t1', 0], ['S2002', 'ev-t2', 0]]);
  assert.equal(api.classRoster('nope', 'T100'), null);
});

test('scope: a teacher receives their classes, enrolments and students, and nobody else', () => {
  const snap = scopedSnapshot({ kind: 'teacher', teacherId: 'T101' }).store;
  assert.ok(['C-CS12', 'C-ROB8'].every((id) => snap.classes.some((c) => c.id === id)));
  assert.deepEqual(snap.students.map((x) => x.id).sort(), ['S2001', 'S2003']);
  assert.ok(snap.enrolments.some((e) => e.classId === 'C-CS12' && e.studentId === 'S2001'));
  assert.ok(snap.enrolments.every((e) => ['S2001', 'S2003'].includes(e.studentId)));
  assert.deepEqual(snap.subjectLines, { [MATHS]: 'science' });
});
