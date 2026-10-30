// School events (api.addSchoolEvent, importSchoolEvents, dismissSchoolEvent, remindSchoolEvent; addStation with schoolEvent):
// permissions, who it is for, the card window, a moment from it, counts by homeroom, the one reminder, scope, CSV, replay.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-events-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, touchedBy } = await import('../scope.mjs');

const admin = { kind: 'admin' };
const coord = { kind: 'coordinator', teacherId: 'T104' }; // advises 8A (S2003)
const lead = { kind: 'leadership', teacherId: 'T103' };
const brook = { kind: 'teacher', teacherId: 'T100' }; // advises 12B, teaches 12 Biology
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics
const counsellor = { kind: 'counsellor', teacherId: 'T102' };
const s1 = { kind: 'student', studentId: 'S2001' }, s3 = { kind: 'student', studentId: 'S2003' };
const day = (n) => new Date(Date.parse(api.TODAY) + n * 864e5).toISOString().slice(0, 10);
const y8 = (o = {}) => ({ title: 'Sports day', start: day(-1), end: day(-1), for: { kind: 'years', years: [8] }, lineId: 'sport', question: 'What was your best moment?', ...o });
let ev, soon;

test('setup: class lists, onboarded students', () => {
  const fx = structuredClone(FX);
  fx.students.push({ id: 'S2009', name: 'Ivy Jones', year: 8, programme: 'MYP', homeroom: '8B', advisorId: 'T105' });
  fx.students.push({ id: 'S2010', name: 'Jay Kim', year: 8, programme: 'MYP', homeroom: '8B', advisorId: 'T103' });
  fx.enrolments.push({ studentId: 'S2009', classId: 'C-ROB8' });
  api.importRoster(fx);
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
  assert.ok(api.getLine('sport'), 'a school line called sport');
});

test('canAct: admins, coordinators and leadership manage, as themselves; nobody else', () => {
  assert.ok(canAct(admin, 'addSchoolEvent', [y8(), null]));
  assert.ok(!canAct(admin, 'addSchoolEvent', [y8(), 'T100']), 'an admin with no record acts as null');
  assert.ok(canAct(coord, 'addSchoolEvent', [y8(), 'T104']));
  assert.ok(!canAct(coord, 'addSchoolEvent', [y8(), 'T100']), 'only as herself');
  assert.ok(canAct(lead, 'importSchoolEvents', [[y8()], 'T103']));
  for (const u of [brook, carter, counsellor, s1, { kind: 'parent', children: ['S2003'] }]) assert.ok(!canAct(u, 'addSchoolEvent', [y8(), u.teacherId ?? null]), u.kind);
});

test('addSchoolEvent: who it is for, validation, replays identically', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  ev = api.addSchoolEvent(y8(), 'T104');
  api.setActionHook(null);
  const year8 = api.getStore().students.filter((s) => s.grade + 1 === 8).map((s) => s.id).sort();
  assert.deepEqual([...ev.studentIds].sort(), year8);
  assert.ok(year8.includes('S2003') && !ev.studentIds.includes('S2001'));
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  ev = api.getSchoolEvent(ev.id);
  assert.throws(() => api.addSchoolEvent(y8({ title: 'x' })), /name/);
  assert.throws(() => api.addSchoolEvent(y8({ start: 'soon' })), /date/);
  assert.throws(() => api.addSchoolEvent(y8({ end: day(-5) })), /before the first/);
  assert.throws(() => api.addSchoolEvent(y8({ lineId: 'nope' })), /line/);
  assert.throws(() => api.addSchoolEvent(y8({ for: { kind: 'years', years: [] } })), /who it is for/);
  assert.throws(() => api.addSchoolEvent(y8({ photo: 'javascript:alert(1)' })), /photo/);
  const hr = api.addSchoolEvent(y8({ title: 'Homeroom trip', for: { kind: 'homerooms', homerooms: ['12B'] } }), null);
  assert.deepEqual([...hr.studentIds].sort(), ['S2001', 'S2002']);
  const cl = api.addSchoolEvent(y8({ title: 'Biology field day', for: { kind: 'classes', classIds: ['C-BIO12'] } }), null);
  assert.deepEqual([...cl.studentIds].sort(), ['S2001', 'S2002']);
  api.removeSchoolEvent(hr.id); api.removeSchoolEvent(cl.id);
  soon = api.addSchoolEvent(y8({ title: 'Week Without Walls', start: day(10), end: day(14), for: { kind: 'school' } }), null);
});

test('student home: a card after it ends, coming up before; dismissing hides the card', () => {
  const h = api.schoolEventsFor('S2003');
  assert.deepEqual(h.cards.map((c) => c.title), ['Sports day']);
  assert.deepEqual(h.cards[0].prefill, { title: 'Sports day', date: day(-1), lineIds: ['sport'], schoolEvent: ev.id, question: 'What was your best moment?' });
  assert.deepEqual(h.coming.map((c) => c.title), ['Week Without Walls']);
  assert.equal(api.schoolEventsFor('S2001').cards.length, 0, 'not for Year 12');
  const today = api.addSchoolEvent(y8({ title: 'Concert', start: day(0), end: day(0) }), null);
  assert.ok(!api.schoolEventsFor('S2003').cards.some((c) => c.id === today.id), 'no card on the day itself');
  assert.ok(api.schoolEventsFor('S2003').coming.find((c) => c.id === today.id)?.now);
  const old = api.addSchoolEvent(y8({ title: 'Old trip', start: day(-9), end: day(-8) }), null);
  assert.ok(!api.schoolEventsFor('S2003').cards.some((c) => c.id === old.id), 'only for a few days');
  assert.ok(canAct(s3, 'dismissSchoolEvent', [today.id, 'S2003']));
  assert.ok(!canAct(s3, 'dismissSchoolEvent', [today.id, 'S2004']));
  assert.ok(!canAct(s1, 'dismissSchoolEvent', [today.id, 'S2001']), 'not for Year 12');
  assert.ok(!canAct(coord, 'dismissSchoolEvent', [today.id, 'S2003']));
  api.removeSchoolEvent(today.id); api.removeSchoolEvent(old.id);
});

test('a moment from it: linked, on the event’s line, its question as the reflection’s prompt; counts by homeroom', () => {
  const e = api.addStation('S2003', { ...api.schoolEventsFor('S2003').cards[0].prefill, type: 'project', reflection: 'I won the relay.', visibility: 'advisor', via: 'School event' });
  assert.equal(e.schoolEvent, ev.id);
  assert.deepEqual(e.source, { system: 'School event', ref: 'Sports day' });
  assert.ok(api.getStudent('S2003').laneOrder.includes('sport') && e.lineIds[0] === 'sport');
  assert.equal(api.getStore().reflections.find((r) => r.eventId === e.id).prompt, 'What was your best moment?');
  assert.equal(api.schoolEventsFor('S2003').cards.length, 0, 'the card goes');
  assert.equal(api.schoolEventName(e), 'Sports day');
  // A schoolEvent that is not for the student is ignored.
  const x = api.addStation('S2001', { title: 'Not mine', lineIds: ['art'], schoolEvent: ev.id });
  assert.ok(!x.schoolEvent && x.source.system !== 'School event');
  const p = api.schoolEventProgress(ev.id);
  assert.equal(p.added, 1);
  assert.equal(p.homerooms.find((g) => g.homeroom === '8A').added, 1);
  assert.deepEqual(p.homerooms.map((g) => [g.homeroom, g.total, g.added]), [['8A', 1, 1], ['8B', 2, 0]]);
  const mine = api.schoolEventProgress(ev.id, { teacherId: 'T104', whole: false });
  assert.deepEqual(mine.homerooms.map((g) => [g.homeroom, g.total, g.added]), [['8A', 1, 1]], 'her advisee and her class only');
  const robots = api.schoolEventProgress(ev.id, { teacherId: 'T101', whole: false });
  assert.deepEqual(robots.homerooms.map((g) => g.homeroom), ['8A', '8B'], 'his Robotics class');
});

test('scope: students only events for them, staff only their students, families the name on the moment', () => {
  const p3 = scopedSnapshot(s3).store;
  assert.deepEqual(p3.schoolEvents.map((x) => [x.title, x.studentIds]), [['Sports day', ['S2003']], ['Week Without Walls', ['S2003']]]);
  assert.ok(p3.schoolEventAdds.every((r) => r.studentId === 'S2003'));
  const p1 = scopedSnapshot(s1).store;
  assert.deepEqual(p1.schoolEvents.map((x) => x.title), ['Week Without Walls'], 'a Year 12 student never gets the Year 8 event');
  assert.equal(p1.schoolEventAdds.length, 0);
  const pc = scopedSnapshot(coord).store; // a coordinator is whole-school
  assert.equal(pc.schoolEvents.find((x) => x.id === ev.id).studentIds.length, ev.studentIds.length);
  const pb = scopedSnapshot(brook).store;
  assert.ok(!pb.schoolEvents.some((x) => x.id === ev.id), 'no Year 8 student of hers');
  const pk = scopedSnapshot(carter).store; // teaches 8 Robotics
  const robots = api.getStore().enrolments.filter((n) => n.classId === 'C-ROB8').map((n) => n.studentId);
  assert.ok(pk.schoolEvents.find((x) => x.id === ev.id).studentIds.every((sid) => robots.includes(sid)));
  const fam = scopedSnapshot({ kind: 'parent', children: ['S2003'] }).store;
  assert.deepEqual(fam.schoolEvents.find((x) => x.id === ev.id).studentIds, ['S2003']);
  assert.equal(fam.schoolEventAdds.length, 0);
  const m = fam.events.find((e) => e.schoolEvent === ev.id);
  assert.equal(m?.source.ref, 'Sports day', 'the family sees the event name on the moment');
  // A private moment from it is counted for staff, never sent.
  const priv = api.addStation('S2009', { title: 'My day', lineIds: ['sport'], schoolEvent: ev.id, visibility: 'private' });
  const pk2 = scopedSnapshot(lead).store;
  assert.ok(pk2.schoolEventAdds.some((r) => r.momentId === priv.id), 'whole-school rows whole');
  const pa = scopedSnapshot({ kind: 'advisor', teacherId: 'T105' }).store;
  assert.ok(!pa.events.some((e) => e.id === priv.id));
  const r = pa.schoolEventAdds.find((x) => x.studentId === 'S2009');
  assert.ok(r && r.added && r.momentId === null);
  assert.deepEqual(pa.schoolEvents.find((x) => x.id === ev.id).studentIds, ['S2009']);
  assert.ok(!pa.schoolEventAdds.some((x) => x.studentId === 'S2003'), 'not his advisee');
});

test('reminder: managers only, once per event, after it ends, to those with nothing yet', () => {
  assert.ok(!canAct(brook, 'remindSchoolEvent', [ev.id, 'T100']));
  assert.ok(!canAct({ kind: 'advisor', teacherId: 'T105' }, 'remindSchoolEvent', [ev.id, 'T105']));
  assert.ok(canAct(coord, 'remindSchoolEvent', [ev.id, 'T104']));
  assert.ok(canAct(coord, 'removeSchoolEvent', [ev.id, 'T104']) && canAct(admin, 'editSchoolEvent', [ev.id, {}, null]));
  assert.ok(!canAct(coord, 'removeSchoolEvent', [ev.id, null]) && !canAct(brook, 'removeSchoolEvent', [ev.id, 'T100']) && !canAct(coord, 'removeSchoolEvent', ['se-nope', 'T104']));
  assert.throws(() => api.remindSchoolEvent(soon.id, null), /once the event is over/);
  const n0 = api.getStore().notifications.length;
  const n = api.remindSchoolEvent(ev.id, 'T104');
  const sent = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.equal(n, 1);
  assert.deepEqual(sent.map((x) => x.to), ['st:S2010'], 'not those who added something');
  assert.ok(sent.every((x) => x.kind === 'class' && /^Add something from “Sports day” to your journey$/.test(x.text) && x.go.param === `se~${ev.id}`));
  assert.throws(() => api.remindSchoolEvent(ev.id, 'T104'), /already sent/);
  assert.deepEqual(touchedBy('remindSchoolEvent', [ev.id, 'T104']), { students: [], as: ['T104'] });
});

test('CSV: parse, errors, import all or none', () => {
  const csv = '﻿title,start,end,years,line\r\n"Concert, winter",2026-12-10,,7-9,Sport\nService day,20/11/2026,21/11/2026,,\nBad,soon,,8,\nNo line,2026-12-01,,8,Underwater\n';
  const { rows, errors } = api.parseEventsCsv(csv);
  assert.deepEqual(rows.map((r) => [r.title, r.start, r.end, r.for, r.lineId]), [
    ['Concert, winter', '2026-12-10', '2026-12-10', { kind: 'years', years: [7, 8, 9] }, 'sport'],
    ['Service day', '2026-11-20', '2026-11-21', { kind: 'school' }, null],
  ]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^Row 4: the start date/);
  assert.match(errors[1], /^Row 5: no school line/);
  assert.deepEqual(api.parseEventsCsv('name,date\nx,y').errors.length, 1);
  const n = api.getSchoolEvents().length;
  assert.throws(() => api.importSchoolEvents([...rows, { title: 'x', start: day(1) }], null), /^Error: Row 4:/);
  assert.equal(api.getSchoolEvents().length, n, 'none added');
  const out = api.importSchoolEvents(rows, 'T103');
  assert.equal(out.length, 2);
  assert.equal(api.getSchoolEvents().length, n + 2);
});
