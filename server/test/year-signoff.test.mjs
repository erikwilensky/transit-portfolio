// Advisor year sign-off (api.signoffChecklist, tickSignoff, signOffYear, markNotThisYear, undoSignoff, setSignoffYear,
// setSignoffClose, signoffProgress): the checklist from the record, permissions, the handover note, replay, scope, the lock.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-signoff-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, touchedBy } = await import('../scope.mjs');

const admin = { kind: 'admin' };
const fong = { kind: 'coordinator', teacherId: 'T104' }; // advises 8A (S2003)
const lead = { kind: 'leadership', teacherId: 'T103' };
const brook = { kind: 'teacher', teacherId: 'T100' }; // advises 12B (S2001, S2002)
const gray = { kind: 'advisor', teacherId: 'T105' };
const hana = { kind: 'student', studentId: 'S2003' }, fern = { kind: 'student', studentId: 'S2001' };
const fam = { kind: 'parent', children: ['S2003'] };
const day = (n) => new Date(Date.parse(api.TODAY) + n * 864e5).toISOString().slice(0, 10);
const since = api.schoolYearStart();

test('setup: class lists and a year of moments for Hana (Year 8)', () => {
  const fx = structuredClone(FX);
  fx.students.push({ id: 'S2009', name: 'Ivy Jones', year: 9, programme: 'MYP', homeroom: '9A', advisorId: 'T105' });
  api.importRoster(fx);
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science', 'sport', 'service']; }
  const a = api.addStation('S2003', { title: 'Clay pots', date: day(-20) < since ? since : day(-20), lineIds: ['art'], visibility: 'advisor' });
  api.addStation('S2003', { title: 'Volcano model', date: day(-3) < since ? since : day(-3), lineIds: ['science'], visibility: 'school' });
  api.addStation('S2003', { title: 'Diary', date: day(-2) < since ? since : day(-2), lineIds: ['sport'], visibility: 'private' });
  api.addStation('S2003', { title: 'Last year', date: `${+since.slice(0, 4) - 1}-09-01`, lineIds: ['service'], visibility: 'advisor' });
  const rq = api.requestEndorsement(a.id, 'T104', 'Please');
  api.endorse([rq.id], 'T104', 'Lovely work');
  api.addGoal('S2003', { title: 'Read ten books', date: day(60), lineId: 'art' });
});

test('the checklist: from the record as the advisor reads it, plus ticks', () => {
  const c = api.signoffChecklist('S2003');
  assert.equal(c.year, 8);
  assert.deepEqual(c.items.map((i) => i.id), ['lines', 'endorsed', 'reflection', 'goal', 'talk']);
  const by = Object.fromEntries(c.items.map((i) => [i.id, i]));
  assert.equal(by.lines.n, 2, 'art and science this year; the private diary and last year’s moment do not count');
  assert.ok(!by.lines.met && /2 lines/.test(by.lines.detail));
  assert.ok(by.endorsed.met && by.endorsed.eventId && /Clay pots/.test(by.endorsed.detail));
  assert.ok(!by.reflection.met && by.goal.met && by.goal.goalsSet === 1 && !by.talk.met && by.talk.manual);
  assert.equal(c.met, 2); assert.equal(c.total, 5);
  const fern12 = api.signoffChecklist('S2001');
  assert.ok(fern12.items.some((i) => i.id === 'cas'), 'Years 12–13: CAS on track');
  assert.ok(!api.signoffChecklist('S2009').items.some((i) => i.id === 'movingUp'), 'no moving-up data yet: no item');
  api.getStore().movingUp = [{ studentId: 'S2009', status: 'done' }];
  assert.ok(api.signoffChecklist('S2009').items.find((i) => i.id === 'movingUp')?.met, 'Year 9 with moving-up data: the item shows, met');
  delete api.getStore().movingUp;
});

test('canAct: only the student’s advisor signs off, as themselves; leadership and admins set the checklist and date', () => {
  for (const fn of ['signOffYear', 'markNotThisYear', 'undoSignoff']) {
    assert.ok(canAct(fong, fn, ['S2003', 'T104']), fn);
    assert.ok(!canAct(fong, fn, ['S2003', 'T100']), `${fn}: only as herself`);
    assert.ok(!canAct(brook, fn, ['S2003', 'T100']), `${fn}: another advisor`);
    assert.ok(!canAct(fong, fn, ['S2001', 'T104']), `${fn}: not her advisee`);
    for (const u of [admin, lead, hana, fam]) assert.ok(!canAct(u, fn, ['S2003', u.teacherId ?? 'T104']), `${fn}: ${u.kind}`);
  }
  assert.ok(canAct(fong, 'tickSignoff', ['S2003', 'talk', true, 'T104']));
  assert.ok(!canAct(gray, 'tickSignoff', ['S2003', 'talk', true, 'T105']));
  assert.ok(canAct(lead, 'setSignoffYear', [8, {}, 'T103']) && canAct(lead, 'setSignoffClose', [day(30), 'T103']));
  assert.ok(!canAct(lead, 'setSignoffClose', [day(30), 'T104']), 'leadership only as themselves');
  assert.ok(canAct(admin, 'setSignoffYear', [8, {}, null]) && !canAct(admin, 'setSignoffYear', [8, {}, 'T103']));
  for (const u of [fong, brook, gray, hana, fam]) assert.ok(!canAct(u, 'setSignoffClose', [day(30), u.teacherId ?? null]), u.kind);
  assert.deepEqual(touchedBy('signOffYear', ['S2003', 'T104']), { students: ['S2003'], as: ['T104'] });
  assert.deepEqual(touchedBy('setSignoffClose', [day(30), 'T103']), { students: [], as: ['T103'] });
});

test('tick, sign off with a note: replays identically; the note is the handover note; the student is told', () => {
  api.tickSignoff('S2003', 'talk', true, 'T104');
  assert.throws(() => api.tickSignoff('S2003', 'nope', true, 'T104'), /No such item/);
  assert.throws(() => api.signOffYear('S2003', 'T100'), /advisor/);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const r = api.signOffYear('S2003', 'T104', { note: 'Loves art; needs a nudge to reflect.' });
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.equal(r.status, 'signed');
  assert.equal(api.getHandoverNote('S2003', 'T104').text, 'Loves art; needs a nudge to reflect.');
  const c = api.getSignoff('S2003').celebrated;
  assert.deepEqual(c, { lines: 2, endorsed: 1, goalsSet: 1 }, 'only what went well');
  const n = api.getStore().notifications.find((x) => x.to === api.toStudent('S2003') && /signed off your year/.test(x.text));
  assert.ok(n && n.kind === 'milestone' && n.text === 'Ms Fong signed off your year. Well done!');
  assert.throws(() => api.signOffYear('S2003', 'T104'), /Already/);
  assert.equal(api.mySignoff('S2003').advisor.id, 'T104');
});

test('not this year, with a private reason; undo', () => {
  api.markNotThisYear('S2001', 'T100', 'Long absence; talk in August.');
  assert.equal(api.getSignoff('S2001').status, 'notyet');
  api.undoSignoff('S2001', 'T100');
  assert.equal(api.getSignoff('S2001').status, 'open');
  api.markNotThisYear('S2001', 'T100', 'Long absence; talk in August.');
});

test('scope: advisor whole; leadership counts only; the student only what was celebrated; families and others nothing', () => {
  const adv = scopedSnapshot(fong).store.yearSignoffs;
  assert.deepEqual(adv.map((r) => r.studentId), ['S2003']);
  assert.ok(adv[0].ticks.talk);
  const l = scopedSnapshot(lead).store.yearSignoffs;
  assert.equal(l.length, 2);
  for (const r of l) assert.ok(!('reason' in r) && !('ticks' in r) && !('celebrated' in r), 'status only');
  const me = scopedSnapshot(hana).store.yearSignoffs;
  assert.deepEqual(me.map((r) => Object.keys(r).sort()), [['advisorId', 'at', 'celebrated', 'id', 'status', 'studentId', 'year']]);
  assert.deepEqual(scopedSnapshot(fern).store.yearSignoffs, [], 'not this year: the student is not told');
  assert.deepEqual(scopedSnapshot(fam).store.yearSignoffs, []);
  assert.equal(scopedSnapshot(fam).store.signoffSettings, undefined);
  assert.deepEqual(scopedSnapshot(gray).store.yearSignoffs, []);
  const b = scopedSnapshot(brook).store;
  assert.equal(b.yearSignoffs[0].reason, 'Long absence; talk in August.', 'the reason only to the advisor');
  assert.deepEqual(Object.keys(b.signoffCas).sort(), ['S2001', 'S2002'], 'CAS totals for the advisor’s Years 12–13');
  assert.deepEqual(scopedSnapshot(admin).store.yearSignoffs.find((r) => r.studentId === 'S2001'), { id: api.getSignoff('S2001').id, studentId: 'S2001', year: api.schoolYearOf(), status: 'notyet', at: api.getSignoff('S2001').at });
});

test('progress by Year and homeroom, and the CSV', () => {
  const p = api.signoffProgress();
  const y8 = p.years.find((y) => y.year === 8), a8 = y8.homerooms.find((h) => h.homeroom === '8A');
  assert.equal(a8.signed, 1); assert.equal(a8.students, api.getStudents().filter((s) => s.homeroom === '8A').length);
  assert.equal(p.years.find((y) => y.year === 12).notyet, 1);
  const csv = api.signoffCsv().split('\r\n');
  assert.equal(csv[0], 'School year,Year,Homeroom,Students,Signed off,Not this year,Not yet');
  assert.ok(csv.some((l) => l.startsWith(`${p.schoolYear},8,8A,${a8.students},1,0,`)));
  assert.ok(!/Long absence|Loves art/.test(api.signoffCsv()));
});

test('settings per Year, and the closing date locks sign-offs', () => {
  api.setSignoffYear(8, { lines: 1, endorsed: true, reflection: false, goal: true, manual: [{ label: 'Met their family' }] }, 'T103');
  const c = api.signoffChecklist('S2003');
  assert.deepEqual(c.items.map((i) => i.id).slice(0, 3), ['lines', 'endorsed', 'goal']);
  assert.ok(c.items.find((i) => i.id === 'lines').met);
  assert.ok(/^ym-/.test(c.items.at(-1).id) && c.items.at(-1).label === 'Met their family');
  api.setSignoffYear(8, null, 'T103');
  assert.equal(api.signoffChecklist('S2003').items.length, 5, 'back to the usual');
  assert.throws(() => api.setSignoffClose('2001-01-01', 'T103'), /this school year/);
  api.setSignoffClose(since, 'T103');
  assert.ok(api.signoffLocked() || since >= api.TODAY);
  if (api.signoffLocked()) {
    assert.throws(() => api.undoSignoff('S2003', 'T104'), /locked/);
    assert.throws(() => api.signOffYear('S2002', 'T100'), /locked/);
  }
  api.setSignoffClose(null, 'T103');
  assert.ok(!api.signoffLocked());
  api.undoSignoff('S2003', 'T104');
  assert.equal(api.mySignoff('S2003'), null);
});
