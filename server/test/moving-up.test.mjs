// Moving-up summaries (api.openMovingUp, closeMovingUp, saveMovingUp, finishMovingUp, setMovingUpFamily): who may open and
// write, Year 9 and Year 11 only, drafts, hopes that become goals, the family choice (default yes in Year 9, asked in Year 11),
// scope (the advisor sees a draft only as started; subject teachers and families without consent see nothing), the next
// advisor after the class-list import, reminders, PDPA, replay. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-movingup-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

// Fern and Gus are in Year 9 with Ms Brook; Hana is in Year 11 with Ms Fong. Mr Carter teaches Fern Computer Science.
const thisYear = () => {
  const r = structuredClone(FX);
  for (const s of r.students) if (s.id !== 'S2003') Object.assign(s, { year: 9, homeroom: '9B' }); else Object.assign(s, { year: 11, homeroom: '11A' });
  return r;
};
const brook = { kind: 'advisor', teacherId: 'T100' }, carter = { kind: 'teacher', teacherId: 'T101' }, fong = { kind: 'coordinator', teacherId: 'T104' };
const gray = { kind: 'advisor', teacherId: 'T105' }, admin = { kind: 'admin' };
const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' }, hana = { kind: 'student', studentId: 'S2003' };
const fam = { kind: 'parent', children: ['S2001'] };
const spec = (x = {}) => ({ title: 'Moving up to Year 10', opens: api.TODAY, closes: api.daysBefore(-21), advisorId: 'T100', ...x });
const mine = (u) => scopedSnapshot(u).store;
let w, m1, m2, m3, priv, w11;

test('setup: Year 9 and Year 11 students with moments', () => {
  api.importRoster(thisYear());
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science']; }
  m1 = api.addStation('S2001', { title: 'Painted the mural', lineIds: ['art'], date: api.daysBefore(300) });
  m2 = api.addStation('S2001', { title: 'Science fair', lineIds: ['science'], date: api.daysBefore(40), visibility: 'advisor' });
  m3 = api.addStation('S2001', { title: 'Led the assembly', lineIds: ['art'], date: api.daysBefore(10), visibility: 'advisor' });
  priv = api.addStation('S2001', { title: 'My diary', lineIds: ['art'], date: api.daysBefore(5), visibility: 'private' });
  assert.equal(api.muStageOf(api.getStudent('S2001')), 9);
  assert.equal(api.muStageOf(api.getStudent('S2003')), 11);
  const ids = api.stageMoments('S2001', 9).map((e) => e.id);
  assert.ok(ids.includes(m3.id) && ids.includes(m2.id) && !ids.includes(priv.id), 'the stage’s moments, never a private one');
});

test('canAct: an advisor for their own advisory, whole-school staff for any advisory or Year 9/11, admins; as themselves', () => {
  assert.ok(canAct(brook, 'openMovingUp', [spec(), 'T100']));
  assert.ok(!canAct(brook, 'openMovingUp', [spec(), 'T105']), 'only as herself');
  assert.ok(!canAct(brook, 'openMovingUp', [spec({ advisorId: 'T104' }), 'T100']), 'not someone else’s advisory');
  assert.ok(!canAct(brook, 'openMovingUp', [spec({ advisorId: null, year: 9 }), 'T100']), 'not a whole Year');
  assert.ok(!canAct(gray, 'openMovingUp', [spec(), 'T105']));
  assert.ok(!canAct(carter, 'openMovingUp', [spec(), 'T101']), 'a subject teacher cannot');
  assert.ok(canAct(fong, 'openMovingUp', [spec({ advisorId: null, year: 11 }), 'T104']));
  assert.ok(canAct(admin, 'openMovingUp', [spec({ advisorId: null, year: 9 }), null]));
  for (const u of [fern, fam]) assert.ok(!canAct(u, 'openMovingUp', [spec(), 'T100']), u.kind);
  assert.throws(() => api.openMovingUp(spec({ advisorId: null, year: 8 }), 'T104'), /Year 9 and Year 11/);
});

test('open: the Year 9 advisees, a notice each that opens the summary, refused twice; replayed exactly', () => {
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  w = api.openMovingUp(spec(), 'T100');
  api.setActionHook(null);
  assert.deepEqual(w.studentIds.sort(), ['S2001', 'S2002']);
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(nt.map((n) => n.to).sort(), ['st:S2001', 'st:S2002']);
  assert.equal(nt[0].go.param, 'movingup');
  assert.equal(nt[0].kind, 'system');
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  w = api.getMovingUpWindow(w.id);
  assert.throws(() => api.openMovingUp(spec(), 'T100'), /already/);
  assert.equal(api.myMovingUp('S2001').window.id, w.id);
  assert.equal(api.myMovingUp('S2003'), null);
  assert.equal(api.myReflection('S2001'), null, 'a term reflection is a separate thing');
});

test('canAct: only the student writes their own, in a window that includes them', () => {
  assert.ok(canAct(fern, 'saveMovingUp', [w.id, 'S2001', {}]));
  assert.ok(canAct(fern, 'finishMovingUp', [w.id, 'S2001', {}]));
  assert.ok(!canAct(fern, 'saveMovingUp', [w.id, 'S2002', {}]));
  assert.ok(!canAct(hana, 'saveMovingUp', [w.id, 'S2003', {}]), 'not in this window');
  for (const u of [brook, fong, admin, fam, carter]) assert.ok(!canAct(u, 'finishMovingUp', [w.id, 'S2001', {}]), u.kind);
  assert.ok(canAct(brook, 'closeMovingUp', [w.id]) && canAct(fong, 'closeMovingUp', [w.id]) && canAct(admin, 'closeMovingUp', [w.id]));
  assert.ok(!canAct(gray, 'closeMovingUp', [w.id]) && !canAct(fern, 'closeMovingUp', [w.id]) && !canAct(carter, 'closeMovingUp', [w.id]));
});

test('a draft: own, non-private moments only, at most five; family yes by default in Year 9; staff see only that it started', () => {
  const r = api.saveMovingUp(w.id, 'S2001', { picks: [m3.id, priv.id, m1.id, 'ev-nope'], who: 'I like building things.', step: 2 });
  assert.deepEqual(r.picks, [m3.id, m1.id]);
  assert.equal(r.family, true);
  assert.equal(r.stage, 9);
  assert.equal(r.status, 'draft');
  assert.equal(api.movingUpProgress(w.id).started, 1);
  assert.equal(mine(fern).movingUp[0].who, 'I like building things.');
  const adv = mine(brook).movingUp;
  assert.deepEqual(Object.keys(adv[0]).sort(), ['doneAt', 'id', 'stage', 'startedAt', 'status', 'studentId', 'windowId'], 'the advisor: started, never the words');
  assert.equal(mine(carter).movingUp.length, 0, 'a subject teacher: nothing');
  assert.equal(mine(carter).movingUpWindows.length, 1, 'but the window over a student she teaches');
  assert.equal(mine(fam).movingUp.length, 0, 'a family: never a draft');
  assert.equal(mine(fam).movingUpWindows.length, 0);
  assert.deepEqual(mine(gus).movingUpWindows[0].studentIds, ['S2002'], 'a student sees only their own id');
});

test('finish: what is missing is said; hopes can become goals; then it is done', () => {
  assert.throws(() => api.finishMovingUp(w.id, 'S2001', { who: 'x' }), /learn best/);
  assert.throws(() => api.finishMovingUp(w.id, 'S2001', { who: 'x', learn: 'y' }), /one hope/);
  assert.throws(() => api.finishMovingUp(w.id, 'S2001', { who: 'x', learn: 'y', hopes: [{ text: 'Join the choir', goal: true, lineId: 'nope' }] }), /line/);
  const n0 = api.getStore().events.length;
  const r = api.finishMovingUp(w.id, 'S2001', { picks: [m3.id, m1.id], who: 'I like building things.', proud: 'The mural.', learn: 'By trying first.', helps: 'A quiet start.',
    hopes: [{ text: 'Join the debate club', goal: true, lineId: 'art' }, { text: 'Read more', goal: false }], dp: 'not for Year 9', step: 6 });
  assert.equal(r.status, 'done');
  assert.equal(r.dp, undefined, 'the DP part is Year 11 only');
  assert.deepEqual(r.moments.map((m) => m.title), ['Led the assembly', 'Painted the mural']);
  assert.equal(r.goalIds.length, 1);
  const g = api.getEvent(r.goalIds[0]);
  assert.ok(g.type === 'goal' && g.title === 'Join the debate club' && g.lineIds[0] === 'art' && g.date > api.TODAY);
  assert.equal(api.getStore().events.length, n0 + 1, 'one goal, no other station');
  assert.throws(() => api.saveMovingUp(w.id, 'S2001', {}), /already finished/);
  assert.equal(api.myMovingUp('S2001'), null);
  assert.equal(api.latestMovingUp('S2001').id, r.id);
  assert.deepEqual([api.movingUpProgress(w.id, 'T100').done, api.movingUpProgress(w.id, 'T100').total], [1, 2]);
});

test('scope once done: the advisor and whole-school roles read it; a subject teacher never; the family by the student’s choice', () => {
  assert.equal(mine(brook).movingUp.find((r) => r.studentId === 'S2001').proud, 'The mural.');
  assert.equal(mine(fong).movingUp.find((r) => r.studentId === 'S2001').helps, 'A quiet start.');
  assert.equal(mine(carter).movingUp.length, 0);
  assert.equal(mine(gray).movingUp.length, 0);
  const f = mine(fam).movingUp;
  assert.equal(f.length, 1); assert.equal(f[0].who, 'I like building things.');
  assert.ok(!('goalIds' in f[0]) && !('step' in f[0]));
  const r = api.latestMovingUp('S2001');
  assert.ok(canAct(fern, 'setMovingUpFamily', ['S2001', r.id, false]));
  for (const u of [gus, fam, brook, admin]) assert.ok(!canAct(u, 'setMovingUpFamily', ['S2001', r.id, false]), u.kind);
  api.setMovingUpFamily('S2001', r.id, false);
  assert.equal(mine(fam).movingUp.length, 0, 'the family no longer sees it');
  assert.equal(mine(brook).movingUp.find((x) => x.studentId === 'S2001').family, false);
  api.setMovingUpFamily('S2001', r.id, true);
});

test('Year 11: the family question has no default, and the DP part is kept', () => {
  w11 = api.openMovingUp(spec({ advisorId: null, year: 11, title: '' }), 'T104');
  assert.equal(w11.title, 'Moving up to the IB Diploma');
  assert.deepEqual(w11.studentIds, ['S2003']);
  const base = { who: 'Curious.', learn: 'Diagrams.', hopes: [{ text: 'Try HL Physics' }], dp: 'Physics HL, Art SL', cas: 'Coach juniors' };
  assert.equal(api.saveMovingUp(w11.id, 'S2003', base).family, null);
  assert.throws(() => api.finishMovingUp(w11.id, 'S2003', base), /family/);
  const r = api.finishMovingUp(w11.id, 'S2003', { ...base, family: false });
  assert.equal(r.stage, 11); assert.equal(r.dp, 'Physics HL, Art SL'); assert.equal(r.family, false);
  assert.equal(mine({ kind: 'parent', children: ['S2003'] }).movingUp.length, 0);
});

test('a reminder from the advisor opens the summary; a subject teacher cannot send one', () => {
  const n = api.nudgeStudent('S2002', 'T100', 'Your moving-up summary is waiting.', `movingup:${w.id}`);
  assert.equal(n.about, `movingup:${w.id}`);
  assert.equal(api.getStore().notifications.find((x) => x.to === 'st:S2002').go.param, 'movingup');
  assert.ok(canAct(brook, 'nudgeStudent', ['S2002', 'T100', 'x', `movingup:${w.id}`]));
  assert.ok(!canAct(carter, 'nudgeStudent', ['S2001', 'T101', 'x', `movingup:${w.id}`]));
});

test('the next advisor: after the new year’s import, Mr Gray reads Fern’s summary; Ms Brook no longer does', () => {
  const r = thisYear();
  r.school = { ...r.school, academicYear: '2027-28', exportedAt: api.daysBefore(1) };
  Object.assign(r.students.find((s) => s.id === 'S2001'), { advisorId: 'T105', year: 10, homeroom: '10C' });
  r.enrolments = r.enrolments.filter((e) => !(e.studentId === 'S2001' && e.classId === 'C-BIO12'));
  api.importRoster(r);
  assert.ok(api.lastYearOf('S2001'), 'a Last year panel');
  const g = mine(gray).movingUp.find((x) => x.studentId === 'S2001');
  assert.ok(g && g.status === 'done' && g.learn === 'By trying first.', 'the new advisor reads it');
  assert.deepEqual(g.moments.map((m) => m.title), ['Led the assembly', 'Painted the mural']);
  assert.equal(mine(brook).movingUp.filter((x) => x.studentId === 'S2001').length, 0, 'the previous advisor does not');
  assert.equal(api.muStageOf(api.getStudent('S2001')), null, 'Year 10 now');
});

test('PDPA: the summary is in the copy and goes with erasure; a window keeps only other students', () => {
  const d = api.studentData('S2001');
  assert.equal(d.own.movingUp.length, 1);
  api.eraseStudent('S2001');
  assert.equal((api.getStore().movingUp || []).filter((r) => r.studentId === 'S2001').length, 0);
  assert.deepEqual(api.getMovingUpWindow(w.id).studentIds, ['S2002']);
});
