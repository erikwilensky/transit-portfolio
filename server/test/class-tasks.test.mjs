// Class tasks (api.setTask, editTask, extendTask, handInTask, remindDueTasks): permissions, scope, hand-ins as moments,
// late and overdue, endorsing and asking for more, the once-only reminder, replay, PDPA. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-tasks-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const brook = { kind: 'teacher', teacherId: 'T100' }; // teaches 12 Biology (science): S2001, S2002
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics, not Biology
const coord = { kind: 'coordinator', teacherId: 'T104' };
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' }, s3 = { kind: 'student', studentId: 'S2003' };
const day = (n) => new Date(Date.parse(api.TODAY) + n * 864e5).toISOString().slice(0, 10);
const fields = (o = {}) => ({ title: 'Plant cell poster', brief: 'Draw and label a plant cell.', due: day(1), checklist: ['Nucleus', 'Cell wall'], needsFile: true, ...o });
let t, old;

test('setup: class lists, onboarded students', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
});

test('canAct: teachers of the class set, edit and extend as themselves; the student hands in their own', () => {
  assert.ok(canAct(brook, 'setTask', ['C-BIO12', 'T100', fields()]));
  assert.ok(!canAct(brook, 'setTask', ['C-ROB8', 'T100', fields()]), 'not his class');
  assert.ok(!canAct(brook, 'setTask', ['C-BIO12', 'T101', fields()]), 'only as himself');
  assert.ok(!canAct(carter, 'setTask', ['C-BIO12', 'T101', fields()]));
  assert.ok(!canAct(coord, 'setTask', ['C-BIO12', 'T104', fields()]), 'whole-school staff only for a class they teach');
  assert.ok(!canAct({ kind: 'admin' }, 'setTask', ['C-BIO12', 'T100', fields()]), 'an admin with no teacher record');
  assert.ok(!canAct(s1, 'setTask', ['C-BIO12', 'T100', fields()]));
  assert.ok(!canAct({ kind: 'parent', children: ['S2001'] }, 'setTask', ['C-BIO12', 'T100', fields()]));
  for (const u of [brook, coord, { kind: 'admin' }, s1]) assert.ok(!canAct(u, 'remindDueTasks', []), 'the reminder is the server’s alone');
});

test('setTask: notifies the class, keeps the line, validates, replays identically', () => {
  const before = api.snapshot();
  const n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  t = api.setTask('C-BIO12', 'T100', fields());
  api.setActionHook(null);
  assert.deepEqual([t.studentIds.sort(), t.lineId, t.checklist, t.needsFile], [['S2001', 'S2002'], 'science', ['Nucleus', 'Cell wall'], true]);
  const bells = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(bells.map((n) => n.to).sort(), ['st:S2001', 'st:S2002']);
  assert.match(bells[0].text, /set a task: “Plant cell poster”, due tomorrow/);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.throws(() => api.setTask('C-BIO12', 'T100', fields({ title: 'x' })), /title/);
  assert.throws(() => api.setTask('C-BIO12', 'T100', fields({ due: 'Friday' })), /due date/);
  assert.throws(() => api.setTask('C-BIO12', 'T100', fields({ checklist: ['a', 'b', 'c', 'd', 'e', 'f'] })), /Up to 5/);
  assert.throws(() => api.setTask('C-BIO12', 'T100', fields({ lineId: 'nope' })), /line/);
  old = api.setTask('C-BIO12', 'T100', fields({ title: 'Osmosis write-up', due: day(-2), checklist: [], needsFile: false }));
  assert.ok(canAct(brook, 'editTask', [t.id, 'T100', { brief: 'Use Tuesday’s notes.' }]));
  assert.ok(!canAct(carter, 'editTask', [t.id, 'T101', {}]));
  assert.ok(canAct(brook, 'extendTask', [old.id, 'S2002', day(3), 'T100']));
  assert.ok(!canAct(brook, 'extendTask', [old.id, 'S2003', day(3), 'T100']), 'not a student it was set for');
  assert.ok(!canAct(brook, 'extendTask', [old.id, 'S2002', day(3), 'T101']));
});

test('scope: the class’s teachers get tasks whole; a student only theirs, without classmates; nobody else', () => {
  const p1 = scopedSnapshot(s1).store;
  assert.deepEqual(p1.teacherTasks.map((x) => x.studentIds), [['S2001'], ['S2001']]);
  assert.deepEqual(scopedSnapshot(s3).store.teacherTasks, []);
  assert.equal(scopedSnapshot(brook).store.teacherTasks.length, 2);
  assert.deepEqual(scopedSnapshot(carter).store.teacherTasks, []);
  assert.deepEqual(scopedSnapshot({ kind: 'parent', children: ['S2001'] }).store.teacherTasks, []);
  assert.equal(scopedSnapshot(coord).store.teacherTasks.length, 2);
});

test('the day-before reminder: once per student and due date; an extension is reminded again', () => {
  const n = api.remindDueTasks();
  assert.equal(n, 2, 'both students, for the task due tomorrow');
  assert.equal(api.remindDueTasks(), 0, 'never twice');
  assert.match(api.getStore().notifications[0].text, /Reminder: “Plant cell poster” is due tomorrow/);
  api.extendTask(old.id, 'S2002', day(1), 'T100');
  assert.match(api.getStore().notifications[0].text, /Ms|Mr|gave you until tomorrow/);
  assert.equal(api.remindDueTasks(), 1);
  assert.equal(api.remindDueTasks(), 0);
});

test('handInTask: a moment on the task’s line, waiting for the teacher; needs a file; once', () => {
  const ok = [t.id, 'S2001', { text: 'I drew it.', ticked: [0, 1], image: 'api/files/x.png' }];
  assert.ok(canAct(s1, 'handInTask', ok));
  assert.ok(!canAct(s2, 'handInTask', ok), 'only their own');
  assert.ok(!canAct(s3, 'handInTask', [t.id, 'S2003', {}]), 'not set for them');
  assert.ok(!canAct(brook, 'handInTask', ok), 'never a teacher for them');
  assert.throws(() => api.handInTask(t.id, 'S2001', { text: 'No photo.' }), /photo or a file/);
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const before = api.snapshot();
  const row = api.handInTask(...ok);
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  const e = api.getEvent(row.eventId);
  assert.deepEqual([e.lineIds, e.task, e.source.system, e.evidence[0].url, row.ticked], [['science'], t.id, 'Class task', 'api/files/x.png', [0, 1]]);
  assert.ok(api.getStudent('S2001').laneOrder.includes('science'), 'the line joins the map');
  const rq = api.getStore().requests.find((r) => r.eventId === e.id);
  assert.deepEqual([rq.teacherId, rq.status], ['T100', 'pending']);
  assert.throws(() => api.handInTask(...ok), /already handed/);
  assert.equal(api.remindDueTasks(), 0);
  const g = api.taskGrid(t.id);
  assert.deepEqual(g.rows.map((r) => [r.studentId, r.status, r.check]), [['S2001', 'handed', 'waiting'], ['S2002', 'none', null]]);
  assert.equal(g.rows[0].text, 'I drew it.');
  assert.deepEqual(api.taskHandInWaits('T100').map((w) => [w.task.id, w.requests.length]), [[t.id, 1]]);
  // The teacher gets the moment and the row; the classmate does not.
  const pb = scopedSnapshot(brook).store, p2 = scopedSnapshot(s2).store;
  assert.ok(pb.events.some((x) => x.id === e.id) && pb.handIns.some((r) => r.eventId === e.id));
  assert.ok(!p2.events.some((x) => x.id === e.id) && !p2.handIns.some((r) => r.studentId === 'S2001'));
});

test('late and overdue; more time for one student', () => {
  assert.deepEqual(api.taskGrid(old.id).rows.map((r) => [r.studentId, r.status, r.due]), [['S2001', 'overdue', day(-2)], ['S2002', 'none', day(1)]]);
  api.handInTask(old.id, 'S2001', { text: 'Sorry it is late.' });
  assert.equal(api.taskGrid(old.id).rows.find((r) => r.studentId === 'S2001').status, 'late');
  api.handInTask(old.id, 'S2002', { text: 'Done within my extra time.' });
  assert.equal(api.taskGrid(old.id).rows.find((r) => r.studentId === 'S2002').status, 'handed');
  assert.equal(api.tasksForClass('C-BIO12').find((x) => x.id === old.id).late, 1);
});

test('endorse from the grid; ask for more, then the student hands in again', () => {
  const g = api.taskGrid(old.id);
  const [late, ontime] = ['S2001', 'S2002'].map((sid) => g.rows.find((r) => r.studentId === sid));
  assert.ok(canAct(brook, 'endorse', [[ontime.request.id], 'T100', 'Endorsed.']));
  assert.ok(!canAct(carter, 'endorse', [[ontime.request.id], 'T101', 'Endorsed.']));
  api.endorse([ontime.request.id], 'T100', 'Good.');
  api.declineRequest(late.request.id, 'Add your results table.');
  const g2 = api.taskGrid(old.id);
  assert.deepEqual(g2.rows.map((r) => [r.studentId, r.check]), [['S2001', 'more'], ['S2002', 'endorsed']]);
  const mine = api.tasksFor('S2001').find((x) => x.id === old.id);
  assert.deepEqual([mine.open, mine.reason], [true, 'Add your results table.']);
  api.handInTask(old.id, 'S2001', { text: 'Here is the table.', files: [{ kind: 'file', url: 'api/files/t.pdf', name: 'table.pdf' }] });
  const r = api.taskGrid(old.id).rows.find((x) => x.studentId === 'S2001');
  assert.deepEqual([r.check, r.files.map((x) => x.name), !!r.row.again], ['waiting', ['table.pdf'], true]);
  assert.match(r.text, /Sorry it is late\.\n\nHere is the table\./);
  assert.equal(api.getStore().events.filter((e) => e.task === old.id && e.studentId === 'S2001').length, 1, 'the same moment');
});

test('editTask: a new due date tells those who have not handed in', () => {
  const n0 = api.getStore().notifications.length;
  api.editTask(t.id, 'T100', { due: day(4) });
  assert.equal(api.getTask(t.id).due, day(4));
  assert.deepEqual(api.getStore().notifications.slice(0, api.getStore().notifications.length - n0).map((n) => n.to), ['st:S2002']);
});

test('PDPA: the copy holds the student’s hand-ins; erasure removes them and their id from tasks', () => {
  const d = api.studentData('S2001');
  assert.ok(d.own.handIns.length >= 2 && d.own.handIns.every((r) => r.studentId === 'S2001'));
  assert.ok(d.mentioned.teacherTasks.every((x) => x.studentIds.join() === 'S2001'));
  api.eraseStudent('S2001');
  assert.ok(!api.getStore().handIns.some((r) => r.studentId === 'S2001'));
  assert.ok(api.getStore().teacherTasks.every((x) => !x.studentIds.includes('S2001')));
  assert.equal(api.taskGrid(t.id).rows.length, 1);
});
