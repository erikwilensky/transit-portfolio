// Term reflection (api.openReflectionWindow, closeReflectionWindow, saveTermReflection, finishTermReflection): who may open
// and write, drafts, the finished station and goal, scope (staff see only done or not), families by visibility, replay.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-reflect-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const brook = { kind: 'advisor', teacherId: 'T100' };  // advisor of S2001, S2002 (Year 12)
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics (S2003)
const gray = { kind: 'advisor', teacherId: 'T105' };   // no advisees here
const coord = { kind: 'coordinator', teacherId: 'T104' };
const admin = { kind: 'admin' };
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' }, s3 = { kind: 'student', studentId: 'S2003' };
const fam1 = { kind: 'parent', children: ['S2001'] }, fam3 = { kind: 'parent', children: ['S2003'] };
const closes = () => api.daysBefore(-14);
const spec = (x = {}) => ({ title: 'Term 1 reflection', opens: api.TODAY, closes: closes(), advisorId: 'T100', ...x });
let w, m1, m2, m3;

test('setup: class lists, onboarded students with a few moments', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science']; }
  m1 = api.addStation('S2001', { title: 'Painted the mural', lineIds: ['art'], date: api.daysBefore(20) });
  m2 = api.addStation('S2001', { title: 'Science fair', lineIds: ['science'], date: api.daysBefore(10) });
  m3 = api.addStation('S2003', { title: 'Built a robot arm', lineIds: ['science'], date: api.daysBefore(5) });
});

test('canAct: an advisor for their own advisees, whole-school staff for any advisory or a Year, admins; as themselves', () => {
  assert.ok(canAct(brook, 'openReflectionWindow', [spec(), 'T100']));
  assert.ok(!canAct(brook, 'openReflectionWindow', [spec(), 'T105']), 'only as herself');
  assert.ok(!canAct(brook, 'openReflectionWindow', [spec({ advisorId: 'T105' }), 'T100']), 'not someone else’s advisory');
  assert.ok(!canAct(brook, 'openReflectionWindow', [spec({ advisorId: null, year: 12 }), 'T100']), 'not a whole Year');
  assert.ok(!canAct(gray, 'openReflectionWindow', [spec(), 'T105']));
  assert.ok(canAct(coord, 'openReflectionWindow', [spec({ advisorId: null, year: 8 }), 'T104']));
  assert.ok(canAct(coord, 'openReflectionWindow', [spec(), 'T104']));
  assert.ok(!canAct(coord, 'openReflectionWindow', [spec({ advisorId: null, year: 8 }), 'T100']));
  assert.ok(canAct(admin, 'openReflectionWindow', [spec({ advisorId: null, year: 8 }), null]));
  for (const u of [s1, fam1]) assert.ok(!canAct(u, 'openReflectionWindow', [spec(), 'T100']), u.kind);
});

test('open: the advisees, a notice each, refused twice; replayed exactly', () => {
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  w = api.openReflectionWindow(spec(), 'T100');
  api.setActionHook(null);
  assert.deepEqual(w.studentIds.sort(), ['S2001', 'S2002']);
  assert.equal(w.from, api.termStartOf(api.TODAY));
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(nt.map((n) => n.to).sort(), ['st:S2001', 'st:S2002']);
  assert.equal(nt[0].go.param, 'reflect');
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  w = api.getReflectionWindow(w.id);
  assert.throws(() => api.openReflectionWindow(spec(), 'T100'), /already/);
  assert.throws(() => api.openReflectionWindow(spec({ advisorId: null, year: 12 }), 'T104'), /already/, 'Year 12 is all in the advisory one');
  assert.throws(() => api.openReflectionWindow(spec({ closes: api.daysBefore(1) }), 'T100'), /closes/);
  assert.throws(() => api.openReflectionWindow(spec({ advisorId: null }), 'T100'), /advisory or a Year/);
  assert.deepEqual(api.myReflection('S2001').window.id, w.id);
  assert.equal(api.myReflection('S2003'), null);
});

test('canAct: only the student writes their own, in a window that includes them', () => {
  assert.ok(canAct(s1, 'saveTermReflection', [w.id, 'S2001', {}]));
  assert.ok(canAct(s1, 'finishTermReflection', [w.id, 'S2001', {}]));
  assert.ok(!canAct(s1, 'saveTermReflection', [w.id, 'S2002', {}]));
  assert.ok(!canAct(s3, 'saveTermReflection', [w.id, 'S2003', {}]), 'not in this window');
  for (const u of [brook, coord, admin, fam1]) assert.ok(!canAct(u, 'finishTermReflection', [w.id, 'S2001', {}]), u.kind);
  assert.ok(canAct(brook, 'closeReflectionWindow', [w.id]));
  assert.ok(!canAct(gray, 'closeReflectionWindow', [w.id]));
  assert.ok(!canAct(s1, 'closeReflectionWindow', [w.id]));
});

test('draft: kept and cleaned (own moments only, at most 3); staff see only that it was started', () => {
  const r = api.saveTermReflection(w.id, 'S2001', { picks: [m2.id, m3.id, m1.id, 'nope'], answers: { [m2.id]: { did: 'Tested water from the river', learned: '' } }, step: 2 });
  assert.deepEqual(r.picks, [m2.id, m1.id]);
  assert.equal(r.status, 'draft');
  assert.equal(api.termRecord(w.id, 'S2001').answers[m2.id].did, 'Tested water from the river');
  const mine = scopedSnapshot(s1).store;
  assert.equal(mine.termReflections[0].answers[m2.id].did, 'Tested water from the river');
  assert.deepEqual(mine.reflectionWindows.map((x) => x.studentIds), [['S2001']], 'a student sees only their own id');
  const adv = scopedSnapshot(brook).store;
  assert.deepEqual(Object.keys(adv.termReflections[0]).sort(), ['doneAt', 'eventId', 'id', 'startedAt', 'status', 'studentId', 'windowId']);
  assert.equal(scopedSnapshot(fam1).store.termReflections.length, 0);
  assert.equal(scopedSnapshot(fam1).store.reflectionWindows.length, 0);
  assert.equal(scopedSnapshot(gray).store.reflectionWindows.length, 0, 'out of reach');
  assert.deepEqual(scopedSnapshot(s2).store.termReflections, []);
  assert.deepEqual(api.advisoryReflection('T100'), { ...api.reflectionProgress(w.id, 'T100') });
  const p = api.reflectionProgress(w.id, 'T100');
  assert.deepEqual([p.total, p.done, p.started], [2, 0, 1]);
});

test('finish: a reflection station linked to the moments, one reflection each, and the goal', () => {
  assert.throws(() => api.finishTermReflection(w.id, 'S2001', { picks: [m1.id] }), /Write/);
  assert.throws(() => api.finishTermReflection(w.id, 'S2001', { picks: [m1.id], answers: { [m1.id]: { did: 'Painted' } }, goal: { title: 'x' } }), /goal/);
  const draft = { picks: [m2.id, m1.id], answers: { [m2.id]: { did: 'Tested water from the river', learned: 'I learned that patience matters', next: 'Next I will share it' }, [m1.id]: { did: 'Painted the wall' } },
    goal: { title: 'Run a science club session', lineId: 'science', date: api.nextTermEnd() }, visibility: 'advisor' };
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const r = api.finishTermReflection(w.id, 'S2001', draft);
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'replayed exactly');
  const e = api.getEvent(r.eventId);
  assert.deepEqual([e.type, e.title, e.visibility, e.reflectsOn, e.lineIds.sort()], ['reflection', 'Term 1 reflection', 'advisor', [m2.id, m1.id], ['art', 'science']]);
  const rf = api.getStore().reflections.filter((x) => x.eventId === e.id);
  assert.deepEqual(rf.map((x) => x.about), [m2.id, m1.id]);
  assert.equal(rf[0].text, 'Tested water from the river. I learned that patience matters. Next I will share it.');
  const g = api.getEvent(api.termRecord(w.id, 'S2001').goalId);
  assert.deepEqual([g.type, g.title, g.lineIds, g.date], ['goal', 'Run a science club session', ['science'], api.nextTermEnd()]);
  assert.equal(api.termRecord(w.id, 'S2001').status, 'done');
  assert.throws(() => api.saveTermReflection(w.id, 'S2001', {}), /already/);
  assert.equal(api.myReflection('S2001'), null);
  const p = api.reflectionProgress(w.id, 'T100');
  assert.deepEqual([p.total, p.done], [2, 1]);
  // The advisor reads it (advisor visibility); the conference sheet reads the same map.
  const adv = scopedSnapshot(brook).store;
  assert.ok(adv.events.some((x) => x.id === e.id));
  assert.equal(adv.reflections.filter((x) => x.eventId === e.id).length, 2);
  // Year 12's family sees what the student shares with the school, so not this.
  assert.ok(!scopedSnapshot(fam1).store.events.some((x) => x.id === e.id));
});

test('families by visibility: Year 8 at advisor level is seen at home; "only me" by nobody else', () => {
  const w8 = api.openReflectionWindow({ title: 'Term 1 reflection', closes: closes(), year: 8 }, 'T104');
  assert.deepEqual(w8.studentIds, ['S2003']);
  assert.ok(scopedSnapshot(brook).store.reflectionWindows.every((x) => x.id !== w8.id), 'not her students');
  assert.ok(scopedSnapshot(carter).store.reflectionWindows.some((x) => x.id === w8.id), 'his class');
  const r = api.finishTermReflection(w8.id, 'S2003', { picks: [m3.id], answers: { [m3.id]: { did: 'I built it', learned: 'I learned that gears matter' } } });
  assert.equal(r.goalId, null);
  assert.ok(scopedSnapshot(fam3).store.events.some((x) => x.id === r.eventId), 'Year 8: the family sees advisor-level moments');
  // "Only me": counted as done, read by nobody else.
  const r2 = api.finishTermReflection(w.id, 'S2002', { answers: { _: { did: 'A busy term' } }, visibility: 'private' });
  assert.equal(api.getEvent(r2.eventId).reflectsOn.length, 0);
  assert.ok(!scopedSnapshot(brook).store.events.some((x) => x.id === r2.eventId));
  assert.equal(api.reflectionProgress(w.id, 'T100').done, 2);
});

test('nudge about a reflection opens it, and does not show the add banner; closing', () => {
  const w2 = api.getReflectionWindow(w.id);
  api.closeReflectionWindow(w2.id);
  assert.ok(!api.windowOpen(api.getReflectionWindow(w.id)));
  const w3 = api.openReflectionWindow({ title: 'Catch-up', closes: closes(), advisorId: 'T100' }, 'T100');
  const n = api.nudgeStudent('S2001', 'T100', 'Your reflection is waiting.', `reflection:${w3.id}`);
  assert.equal(n.about, `reflection:${w3.id}`);
  assert.equal(api.getStore().notifications[0].go.param, 'reflect');
  assert.ok(canAct(brook, 'nudgeStudent', ['S2001', 'T100', 'x', `reflection:${w3.id}`]));
  assert.throws(() => api.saveTermReflection(w.id, 'S2002', {}), /already|closed/);
});
