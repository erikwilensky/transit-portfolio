// Class prompts (api.askClass, answerPrompt, skipPrompt, remindClass): permissions, scope, answers as moments.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-prompts-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics (computing line) and 12 CS
const brook = { kind: 'teacher', teacherId: 'T100' };  // teaches 12 Biology (science), advises S2001 and S2002
const fongAdvisor = { kind: 'advisor', teacherId: 'T104' }; // advises S2003, who is in 8 Robotics, but does not teach it
const gray = { kind: 'advisor', teacherId: 'T105' };
const coord = { kind: 'coordinator', teacherId: 'T104' };
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' }, s3 = { kind: 'student', studentId: 'S2003' };
const ids = (xs) => xs.map((x) => x.id).sort();
let rob, bio;

test('setup: class lists, onboarded students', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = s.id === 'S2003' ? ['art'] : ['science']; }
});

test('canAct: the class’s teachers, whole-school staff and admins ask; nobody else', () => {
  const ask = (cid, tid) => [cid, tid, { question: 'What did you learn from the science fair?' }];
  assert.ok(canAct(carter, 'askClass', ask('C-ROB8', 'T101')));
  assert.ok(!canAct(carter, 'askClass', ask('C-BIO12', 'T101')), 'not a class he teaches');
  assert.ok(!canAct(carter, 'askClass', ask('C-ROB8', 'T100')), 'only as himself');
  assert.ok(!canAct(fongAdvisor, 'askClass', ask('C-ROB8', 'T104')), 'advising every student in it is not teaching it');
  assert.ok(!canAct(gray, 'askClass', ask('C-ROB8', 'T105')));
  assert.ok(canAct(coord, 'askClass', ask('C-ROB8', 'T104')));
  assert.ok(canAct({ kind: 'admin' }, 'askClass', ask('C-ROB8', 'T101')));
  assert.ok(!canAct(s3, 'askClass', ask('C-ROB8', 'T101')));
  assert.ok(!canAct({ kind: 'parent', children: ['S2003'] }, 'askClass', ask('C-ROB8', 'T101')));
});

test('askClass: one prompt, every enrolled student notified, deterministic on replay', () => {
  const before = api.snapshot();
  const n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  rob = api.askClass('C-ROB8', 'T101', { question: 'What did you learn from the robot challenge?', context: 'Robot challenge day', asMoment: true, due: '2026-11-15' });
  api.setActionHook(null);
  assert.deepEqual([rob.studentIds, rob.asMoment, rob.lineId, rob.due], [['S2003'], true, 'computing', '2026-11-15']);
  assert.equal(api.getStore().notifications.length - n0, 1);
  assert.equal(api.getStore().notifications[0].to, 'st:S2003');
  const after = api.snapshot();
  api.restore(before);
  api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  bio = api.askClass('C-BIO12', 'T100', { question: 'What surprised you on the field trip?', asMoment: false });
  assert.deepEqual(bio.studentIds.sort(), ['S2001', 'S2002']);
  assert.throws(() => api.askClass('nope', 'T100', { question: 'Anything at all?' }), /No such class/);
  assert.throws(() => api.askClass('C-BIO12', 'T100', { question: ' ' }), /question/);
  // A class not on a line cannot ask for moments.
  api.getClasses().find((c) => c.id === 'C-ART8').lineId = null;
  assert.equal(api.askClass('C-ART8', 'T104', { question: 'Which piece are you proudest of?', asMoment: true }).asMoment, false);
});

test('scope: students get only their own classes’ prompts (without classmates), teachers only their classes’', () => {
  const p1 = scopedSnapshot(s1).store, p3 = scopedSnapshot(s3).store;
  assert.deepEqual(p1.classPrompts.map((p) => [p.id, p.studentIds]), [[bio.id, ['S2001']]]);
  assert.deepEqual(ids(p3.classPrompts), ids(api.getStore().classPrompts.filter((p) => p.studentIds.includes('S2003'))));
  assert.ok(p3.classPrompts.every((p) => p.studentIds.length === 1));
  assert.deepEqual(scopedSnapshot(carter).store.classPrompts.map((p) => p.id), [rob.id]);
  assert.deepEqual(scopedSnapshot(brook).store.classPrompts.map((p) => p.id), [bio.id]);
  assert.deepEqual(scopedSnapshot(gray).store.classPrompts, []);
  assert.deepEqual(scopedSnapshot(fongAdvisor).store.classPrompts.map((p) => p.classId), ['C-ART8'], 'her own class only, not her advisee’s Robotics');
  assert.deepEqual(scopedSnapshot({ kind: 'parent', children: ['S2001'] }).store.classPrompts, []);
  assert.equal(scopedSnapshot(coord).store.classPrompts.length, 3);
});

test('canAct: a student answers or skips only prompts asked of them', () => {
  const ans = (pid, sid) => [pid, sid, { text: 'I learned to test small parts first.' }];
  assert.ok(canAct(s3, 'answerPrompt', ans(rob.id, 'S2003')));
  assert.ok(!canAct(s3, 'answerPrompt', ans(rob.id, 'S2001')));
  assert.ok(!canAct(s1, 'answerPrompt', ans(rob.id, 'S2001')), 'S2001 is not in 8 Robotics');
  assert.ok(!canAct(s1, 'answerPrompt', ans('cq-nope', 'S2001')));
  assert.ok(canAct(s2, 'skipPrompt', [bio.id, 'S2002']) && !canAct(s2, 'skipPrompt', [bio.id, 'S2001']));
  assert.ok(!canAct(carter, 'answerPrompt', ans(rob.id, 'S2003')), 'a teacher never answers for a student');
  assert.ok(!canAct(brook, 'skipPrompt', [bio.id, 'S2002']));
});

test('answerPrompt as a moment: a station on the class’s line, endorsement request to the asking teacher', () => {
  const lanes = [...api.getStudent('S2003').laneOrder];
  const a = api.answerPrompt(rob.id, 'S2003', { text: 'Testing each motor first saved us.', image: '/api/files/abc.jpg' });
  const e = api.getEvent(a.eventId);
  assert.deepEqual([e.title, e.lineIds, e.type, e.verification, e.evidence[0]?.kind], ['Robot challenge day', ['computing'], 'project', 'student-added', 'image']);
  assert.deepEqual(api.getStudent('S2003').laneOrder, [...lanes, 'computing'], 'the class’s line joins the student’s map');
  assert.equal(api.getStore().reflections.find((r) => r.eventId === e.id).text, 'Testing each motor first saved us.');
  const rq = api.getRequests('T101');
  assert.deepEqual(rq.map((r) => r.eventId), [e.id]);
  assert.throws(() => api.answerPrompt(rob.id, 'S2003', { text: 'again' }), /already/);
  assert.equal(api.openPromptsFor('S2003').some((p) => p.id === rob.id), false);
  // The teacher sees the answer and the station in Endorsements; the asked teacher’s view counts 1 of 1.
  const t = scopedSnapshot(carter).store;
  assert.deepEqual(t.classAnswers.map((x) => x.id), [a.id]);
  assert.ok(t.events.some((x) => x.id === e.id) && t.requests.some((r) => r.eventId === e.id));
  assert.equal(api.classPrompts('C-ROB8')[0].answers.length, 1);
});

test('answerPrompt without a moment: a reflection station; skip hides it; counts and reminders', () => {
  const a = api.answerPrompt(bio.id, 'S2001', { text: 'How many species live in one pond.' });
  const e = api.getEvent(a.eventId);
  assert.deepEqual([e.type, e.lineIds, e.verification], ['reflection', ['science'], 'student-added']);
  assert.equal(api.getRequests('T100').filter((r) => r.eventId === e.id).length, 0);
  assert.deepEqual(api.classPrompts('C-BIO12')[0].waiting, ['S2002']);
  const n0 = api.getStore().notifications.length;
  assert.equal(api.remindClass(bio.id, 'T100'), 1);
  assert.equal(api.getStore().notifications[0].to, 'st:S2002');
  assert.equal(api.remindClass(bio.id, 'T100'), 0, 'once a day');
  assert.equal(api.getStore().notifications.length - n0, 1);
  assert.ok(canAct(brook, 'remindClass', [bio.id, 'T100']) && !canAct(carter, 'remindClass', [bio.id, 'T101']));
  api.skipPrompt(bio.id, 'S2002');
  assert.deepEqual(api.openPromptsFor('S2002'), []);
  const v = api.classPrompts('C-BIO12')[0];
  assert.deepEqual([v.answers.length, v.skipped, v.waiting, v.studentIds.length], [1, 1, [], 2]);
  // Each student receives only their own answers; Ms Brook receives both, Mr Carter neither.
  assert.deepEqual(scopedSnapshot(s1).store.classAnswers.map((x) => x.studentId), ['S2001']);
  assert.deepEqual(scopedSnapshot(s2).store.classAnswers.map((x) => [x.studentId, !!x.skipped]), [['S2002', true]]);
  assert.deepEqual(scopedSnapshot(brook).store.classAnswers.map((x) => x.studentId).sort(), ['S2001', 'S2002']);
  assert.ok(!scopedSnapshot(carter).store.classAnswers.some((x) => x.promptId === bio.id));
  assert.deepEqual(scopedSnapshot(gray).store.classAnswers, []);
});

test('a student’s own copy can replay their answer (the browser runs it first)', () => {
  const p = api.askClass('C-BIO12', 'T100', { question: 'One thing you would change next time?', asMoment: true });
  const copy = scopedSnapshot(s2);
  const before = api.snapshot();
  api.restore(JSON.stringify(copy));
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const a = api.answerPrompt(p.id, 'S2002', { text: 'Start earlier.' });
  api.setActionHook(null);
  api.restore(before);
  const b = api.runAction(step.fn, step.args, step.rec);
  assert.deepEqual([b.id, b.eventId], [a.id, a.eventId]);
  assert.equal(api.getRequests('T100').filter((r) => r.eventId === b.eventId).length, 1);
});
