// Year handover: a new year's class lists move Gus to a new advisor. His journey stays; the new advisor sees it, the
// handover note and last year; the old advisor loses him (her prompt and his ended class place no longer count); only
// his current or previous advisor writes the note; the student and family never get it; last year's goals are his to
// carry over or close. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-handover-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { reachOf, scopedSnapshot } = await import('../scope.mjs');

const GUS = 'S2002';
const ada = { kind: 'advisor', teacherId: 'T100' };   // Gus's advisor this year, teaches him Biology
const finn = { kind: 'advisor', teacherId: 'T105' };  // his advisor next year
const carter = { kind: 'teacher', teacherId: 'T101' };
const eve = { kind: 'coordinator', teacherId: 'T104' };
const gus = { kind: 'student', studentId: GUS }, fern = { kind: 'student', studentId: 'S2001' };
const family = { kind: 'parent', children: [GUS] };
const NOTE = 'Strengths: careful in labs. What helps: a clear first step. What to watch: goes quiet before deadlines.';
let st, goal, goal2;

test('this year: the advisor writes a handover note; nobody else may', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science', 'computing']; }
  st = api.addStation(GUS, { title: 'Water testing at the canal', date: api.daysBefore(20), lineIds: ['science'] });
  goal = api.addGoal(GUS, { title: 'Finish the robot arm', date: api.daysBefore(5), lineId: 'computing' });
  goal2 = api.addGoal(GUS, { title: 'Join the choir', date: api.daysBefore(4), lineId: 'science' });
  api.sendPrompt(GUS, st.id, 'What surprised you most?', 'T100');
  api.addNote(GUS, 'Met in October.');
  assert.ok(canAct(ada, 'setHandoverNote', [GUS, NOTE, 'T100']));
  for (const [who, u, by] of [['another advisor', finn, 'T105'], ['a teacher', carter, 'T101'], ['a coordinator', eve, 'T104'], ['the student', gus, 'T100'], ['an admin', { kind: 'admin' }, 'T100']]) assert.ok(!canAct(u, 'setHandoverNote', [GUS, NOTE, by]), who);
  assert.ok(!canAct(ada, 'setHandoverNote', [GUS, NOTE, 'T105']), 'only as herself');
  api.setHandoverNote(GUS, NOTE, 'T100');
  assert.equal(api.getHandoverNote(GUS, 'T100').text, NOTE);
  assert.equal(api.goalsToReview(GUS).length, 0, 'no year start yet: nothing to carry over');
});

const nextYear = () => {
  const r = structuredClone(FX);
  r.school = { ...r.school, academicYear: '2027-28', exportedAt: api.daysBefore(1) };
  r.students.find((s) => s.id === GUS).advisorId = 'T105';
  r.enrolments = r.enrolments.filter((e) => !(e.studentId === GUS && e.classId === 'C-BIO12'));
  return r;
};

test('Start of year preview: how many students change advisor, and how many notes are written', () => {
  const p = api.handoverPreview(nextYear());
  assert.deepEqual({ newYear: p.newYear, changes: p.changes, notes: p.notes }, { newYear: true, changes: 1, notes: 1 });
  assert.deepEqual(p.groups, [{ from: 'Ms Ada Brook', to: 'Mr Finn Gray', n: 1 }]);
  assert.equal(api.getHandovers().length, 0, 'preview changes nothing');
});

test('the new year import: handover noted; reach moves to the new advisor', () => {
  assert.ok(reachOf(ada).has(GUS));
  api.importRoster(nextYear());
  const h = api.latestHandover(GUS);
  assert.deepEqual([h.from, h.to, h.fromYear, h.year, h.newYear], ['T100', 'T105', '2026-27', '2027-28', true]);
  assert.equal(api.getYearStart().year, '2027-28');
  assert.ok(!reachOf(ada).has(GUS), 'the old advisor: not by the ended class place, nor by her earlier prompt');
  assert.ok(reachOf(ada).has('S2001'), 'she keeps her own advisee');
  assert.ok(reachOf(finn).has(GUS));
  assert.ok(api.getEvent(st.id) && api.getStore().students.find((s) => s.id === GUS).laneOrder.length, 'his journey stays');
  assert.ok(!canAct(ada, 'addNote', [GUS, 'x']) && canAct(finn, 'addNote', [GUS, 'x']));
});

test('what each person downloads', () => {
  const f = scopedSnapshot(finn).store;
  assert.ok(f.events.some((e) => e.id === st.id), 'the new advisor sees his history');
  assert.equal(f.handoverNotes.find((n) => n.studentId === GUS)?.text, NOTE, '…and the handover note');
  assert.ok(f.handovers.some((h) => h.studentId === GUS) && f.notes[GUS]?.length, '…the handover and the advisor notes');
  const a = scopedSnapshot(ada).store;
  assert.ok(!a.students.some((s) => s.id === GUS) && !a.events.some((e) => e.studentId === GUS) && !a.handovers.length, 'the old advisor no longer gets him');
  assert.deepEqual(a.handedOver.map((x) => [x.studentId, x.to]), [[GUS, 'Mr Finn Gray']], 'only who she handed over, to finish her note');
  assert.ok(a.handoverNotes.some((n) => n.studentId === GUS && n.by === 'T100'), 'her own note');
  for (const [who, u] of [['the student', gus], ['the family', family], ['a classmate', fern]]) { const s = scopedSnapshot(u).store; assert.ok(!s.handoverNotes.length && !s.handovers.length && !s.handedOver.length, who); }
  assert.ok(scopedSnapshot(eve).store.handoverNotes.some((n) => n.studentId === GUS), 'coordinators read them');
  assert.ok(!scopedSnapshot(carter).store.handoverNotes.length, 'a subject teacher does not');
});

test('after the import: the previous or the current advisor may still write it', () => {
  assert.ok(canAct(ada, 'setHandoverNote', [GUS, NOTE + ' More.', 'T100']));
  assert.ok(canAct(finn, 'setHandoverNote', [GUS, 'Settling in.', 'T105']));
  assert.ok(!canAct(carter, 'setHandoverNote', [GUS, 'x', 'T101']) && !canAct(eve, 'setHandoverNote', [GUS, 'x', 'T104']));
});

test('last year, and goals to carry over or close', () => {
  assert.deepEqual(api.goalsToReview(GUS).map((e) => e.id), [goal.id, goal2.id]);
  assert.ok(canAct(gus, 'carryOverGoal', [goal.id, '2027-06-01']) && !canAct(fern, 'carryOverGoal', [goal.id, '2027-06-01']));
  assert.ok(canAct(gus, 'closeGoal', [goal2.id]) && !canAct(fern, 'closeGoal', [goal2.id]));
  const was = goal.date;
  api.carryOverGoal(goal.id, api.carryDate(was));
  api.closeGoal(goal2.id);
  assert.equal(api.goalsToReview(GUS).length, 0);
  assert.ok(api.getEvent(goal.id).date > api.TODAY && api.getEvent(goal.id).carriedOver.from === was);
  assert.ok(!api.getStudentMap(GUS, 'student').events.some((e) => e.id === goal2.id), 'a closed goal leaves the map, kept in the record');
  const y = api.lastYearOf(GUS);
  assert.equal(y.from.id, 'T100'); assert.equal(y.note.text, NOTE);
  assert.equal(y.moments, 1); assert.deepEqual(y.byLine.map((x) => [x.line.id, x.n]), [['science', 1]]);
  assert.deepEqual(y.carried.map((e) => e.id), [goal.id]);
  assert.deepEqual(api.newToAdvisor('T105').map((s) => s.id), [GUS]);
});

test('replays to the same record', () => {
  const before = JSON.stringify(api.getStore().handoverNotes);
  api.runAction('setHandoverNote', [GUS, 'Settling in.', 'T105'], [['i', 'hn-x_1'], ['t', '2027-08-20T01:00:00.000Z']]);
  const n = api.getHandoverNote(GUS, 'T105');
  assert.deepEqual([n.id, n.at], ['hn-x_1', '2027-08-20T01:00:00.000Z']);
  assert.notEqual(before, JSON.stringify(api.getStore().handoverNotes));
});
