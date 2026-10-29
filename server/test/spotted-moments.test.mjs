// Spotted moments (api.spotMoment, acceptSpotted, declineSpotted): permissions, scope, accepting, declining, expiry.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-spotted-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics (S2003)
const brook = { kind: 'teacher', teacherId: 'T100' };  // teaches 12 Biology (S2001, S2002)
const gray = { kind: 'advisor', teacherId: 'T105' };
const coord = { kind: 'coordinator', teacherId: 'T104' };
const admin = { kind: 'admin' };
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' }, s3 = { kind: 'student', studentId: 'S2003' };
const f = { title: 'Helped a classmate fix the pump', note: 'Calm and patient.', lineId: 'science', classId: 'C-BIO12' };
let group;

test('setup: class lists, onboarded students', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
});

test('canAct: staff as themselves for students in reach; never students, families, or for someone else', () => {
  assert.ok(canAct(brook, 'spotMoment', [['S2001', 'S2002'], 'T100', f]));
  assert.ok(!canAct(brook, 'spotMoment', [['S2001', 'S2003'], 'T100', f]), 'S2003 is not in her reach');
  assert.ok(!canAct(brook, 'spotMoment', [['S2001'], 'T101', f]), 'only as herself');
  assert.ok(!canAct(brook, 'spotMoment', [[], 'T100', f]));
  assert.ok(canAct(carter, 'spotMoment', [['S2003'], 'T101', f]));
  assert.ok(!canAct(gray, 'spotMoment', [['S2001'], 'T105', f]));
  assert.ok(canAct(coord, 'spotMoment', [['S2003', 'S2001'], 'T104', f]), 'whole-school staff: anyone');
  assert.ok(!canAct(coord, 'spotMoment', [['nope'], 'T104', f]));
  assert.ok(!canAct(admin, 'spotMoment', [['S2001'], 'T100', f]), 'an admin with no staff record cannot spot as a teacher');
  assert.ok(!canAct(s1, 'spotMoment', [['S2001'], 'T100', f]));
  assert.ok(!canAct({ kind: 'parent', children: ['S2001'] }, 'spotMoment', [['S2001'], 'T100', f]));
});

test('spotMoment: one suggestion each, notified, deterministic on replay; nothing on the map yet', () => {
  const before = api.snapshot(), ev0 = api.getStore().events.length, n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  group = api.spotMoment(['S2001', 'S2002'], 'T100', { ...f, image: '/api/files/abc.jpg' });
  api.setActionHook(null);
  assert.equal(group.length, 2);
  assert.deepEqual(group.map((x) => [x.studentId, x.status, x.lineId, x.expires]), [['S2001', 'open', 'science', api.daysBefore(-30)], ['S2002', 'open', 'science', api.daysBefore(-30)]]);
  assert.equal(api.getStore().events.length, ev0);
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(nt.map((n) => n.to).sort(), ['st:S2001', 'st:S2002']);
  assert.match(nt[0].text, /spotted something you did/);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.throws(() => api.spotMoment(['S2001'], 'T100', { ...f, title: ' ' }), /title/);
  assert.throws(() => api.spotMoment(['S2001'], 'T100', { ...f, lineId: 'nope' }), /line/);
  assert.throws(() => api.spotMoment([], 'T100', f), /students/);
  assert.equal(api.spotLineFor('T100', 'C-BIO12'), 'science');
  assert.equal(api.spotLineFor('T101', null), 'computing');
});

test('scope: the student sees their own, the teacher the ones she made, nobody else', () => {
  const ids = (u) => scopedSnapshot(u).store.spotted.map((x) => x.id).sort();
  assert.deepEqual(ids(s1), [group[0].id]);
  assert.deepEqual(ids(s2), [group[1].id]);
  assert.deepEqual(ids(s3), []);
  assert.deepEqual(ids(brook), group.map((x) => x.id).sort());
  assert.deepEqual(ids(carter), []);
  assert.deepEqual(ids(coord), []);
  assert.deepEqual(ids({ kind: 'parent', children: ['S2001'] }), []);
  assert.deepEqual(api.spottedFor('S2001').map((x) => x.id), [group[0].id]);
});

test('canAct: only the student accepts or declines their own', () => {
  assert.ok(canAct(s1, 'acceptSpotted', [group[0].id, 'S2001']));
  assert.ok(!canAct(s1, 'acceptSpotted', [group[1].id, 'S2001']));
  assert.ok(!canAct(s1, 'acceptSpotted', [group[1].id, 'S2002']));
  assert.ok(canAct(s2, 'declineSpotted', [group[1].id, 'S2002']));
  for (const u of [brook, coord, admin, { kind: 'leadership', teacherId: 'T104', admin: true }, { kind: 'parent', children: ['S2001'] }]) {
    assert.ok(!canAct(u, 'acceptSpotted', [group[0].id, 'S2001']), u.kind);
    assert.ok(!canAct(u, 'declineSpotted', [group[0].id, 'S2001']), u.kind);
  }
});

test('accept: a station on the line, spotted by and endorsed by the teacher; the teacher hears', () => {
  const e = api.acceptSpotted(group[0].id, 'S2001');
  assert.deepEqual([e.title, e.lineIds, e.verification, e.spotted.teacherId, e.evidence[0]?.url, e.visibility], ['Helped a classmate fix the pump', ['science'], 'teacher-endorsed', 'T100', '/api/files/abc.jpg', 'school']);
  assert.ok(api.getStudent('S2001').laneOrder.includes('science'));
  assert.deepEqual(api.getStore().endorsements.filter((n) => n.eventId === e.id).map((n) => [n.teacherId, n.note]), [['T100', 'Calm and patient.']]);
  assert.equal(api.getStore().notifications[0].to, 't:T100');
  assert.throws(() => api.acceptSpotted(group[0].id, 'S2001'), /already/);
  assert.deepEqual(api.spottedFor('S2001'), []);
  assert.ok(scopedSnapshot(brook).store.events.some((x) => x.id === e.id), 'the teacher sees it on the map');
});

test('decline: hidden from the student; the teacher’s copy says only closed, shown as "not added"', () => {
  const n0 = api.getStore().notifications.length;
  api.declineSpotted(group[1].id, 'S2002');
  assert.equal(api.getStore().notifications.length, n0, 'nobody is told');
  assert.deepEqual(api.spottedFor('S2002'), []);
  const mine = scopedSnapshot(brook).store.spotted.find((x) => x.id === group[1].id);
  assert.deepEqual([mine.status, 'decidedAt' in mine], ['closed', false]);
  assert.deepEqual(api.spottedBy('T100').map((x) => [x.studentId, x.shown]).sort(), [['S2001', 'added'], ['S2002', 'not added']]);
});

test('expiry: after 30 days an open one is gone for the student and "not added" for the teacher', () => {
  const [x] = api.spotMoment(['S2003'], 'T101', { title: 'Wired the robot', lineId: 'computing' });
  assert.equal(api.spottedFor('S2003').length, 1);
  x.expires = api.daysBefore(1);
  assert.deepEqual(api.spottedFor('S2003'), []);
  assert.equal(api.spottedBy('T101')[0].shown, 'not added');
  assert.throws(() => api.acceptSpotted(x.id, 'S2003'), /expired/);
});

test('a student’s own copy can replay their accept (the browser runs it first)', () => {
  const [x] = api.spotMoment(['S2002'], 'T100', { title: 'Explained osmosis to the class', lineId: 'science' });
  const copy = scopedSnapshot(s2), before = api.snapshot();
  api.restore(JSON.stringify(copy));
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  const e = api.acceptSpotted(x.id, 'S2002');
  api.setActionHook(null);
  api.restore(before);
  const b = api.runAction(step.fn, step.args, step.rec);
  assert.equal(b.id, e.id);
  assert.equal(api.getSpotted(x.id).eventId, e.id);
});
