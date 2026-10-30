// Weekly goal check-ins (src/components/GoalCheckins.jsx): once a week per open goal (api.checkInGoal), a two-week
// snooze (snoozeCheckins), "Stuck" twice in a row flags the goal to the advisor and an accepted sponsor (stuckFlags), who
// may send encouragement (sendEncouragement). Who may do each, and who downloads it. Earlier weeks are seeded by moving
// a check-in's dates back. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-checkins-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { weekOf } = await import('../../src/week.js');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const brook = { kind: 'advisor', teacherId: 'T100' }; // Fern's advisor
const carter = { kind: 'teacher', teacherId: 'T101' }; // sponsors her goal
const gray = { kind: 'advisor', teacherId: 'T105' };   // not hers
const parent = { kind: 'parent', children: ['S2001'] };
const day = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Moves every check-in on a goal back a week, as if it had been made then.
const weekBack = (e) => { for (const c of e.checkins) { c.week = day(c.week, -7); c.date = day(c.date, -7); c.at = new Date(Date.parse(c.at) - 7 * 864e5).toISOString(); } };
let g, other;

test('setup: open goals are due; school requirements and closed goals are not', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  g = api.addGoal('S2001', { title: 'Run 5k', date: day(api.TODAY, 60), lineId: 'computing', summary: '', checkIn: true, sponsor: 'T101', sponsorNote: '' });
  other = api.addGoal('S2001', { title: 'Learn to juggle', date: day(api.TODAY, 30), lineId: 'computing', summary: '' });
  api.answerSponsor(g.id, true, '');
  assert.deepEqual(api.checkinsDue('S2001').map((e) => e.id).sort(), [g.id, other.id].sort());
  assert.deepEqual(api.checkinsDue('S2002'), []);
});

test('canAct: only the student checks in or snoozes, on their own goals', () => {
  const f = { status: 'stuck', note: 'I keep stopping', next: 'Ask the coach' };
  assert.ok(canAct(fern, 'checkInGoal', [g.id, f]));
  assert.ok(canAct(fern, 'snoozeCheckins', [other.id]));
  for (const u of [gus, brook, carter, gray, parent, { kind: 'admin', teacherId: null }]) {
    assert.ok(!canAct(u, 'checkInGoal', [g.id, f]), `${u.kind} may not check in for her`);
    assert.ok(!canAct(u, 'snoozeCheckins', [g.id]));
  }
  assert.ok(!canAct(fern, 'checkInGoal', ['ev-nope', f]));
  assert.throws(() => api.checkInGoal(g.id, { status: 'great' }), /Pick how/);
});

test('once a week: a check-in this week takes the goal off the list; answering again replaces it', () => {
  api.checkInGoal(g.id, { status: 'well', note: 'Ran 2k', next: '' });
  assert.ok(!api.checkinsDue('S2001').some((e) => e.id === g.id));
  api.checkInGoal(g.id, { status: 'stuck', note: 'I keep stopping', next: 'Ask the coach' });
  const e = api.getEvent(g.id);
  assert.equal(e.checkins.length, 1, 'one per week');
  assert.equal(e.checkins[0].status, 'stuck'); assert.equal(e.checkins[0].week, weekOf(api.TODAY).from);
  assert.ok(!api.stuckTwice(e), 'once is not a flag');
  assert.deepEqual(api.stuckFlags('T100'), []);
  weekBack(e);
  assert.ok(api.checkinsDue('S2001').some((x) => x.id === g.id), 'a new week: due again');
});

test('snooze: no questions on that goal for two weeks, then it comes back', () => {
  api.snoozeCheckins(other.id);
  const e = api.getEvent(other.id);
  assert.equal(e.checkinSnooze, day(api.TODAY, 14));
  assert.ok(!api.checkinsDue('S2001').some((x) => x.id === other.id));
  e.checkinSnooze = api.TODAY; // the two weeks are up
  assert.ok(api.checkinsDue('S2001').some((x) => x.id === other.id));
});

test('stuck twice in a row: flagged to the advisor and the sponsor, nobody else', () => {
  const before = api.getStore().notifications.length;
  api.checkInGoal(g.id, { status: 'stuck', note: 'Still stuck', next: 'Walk-run' });
  const e = api.getEvent(g.id);
  assert.ok(api.stuckTwice(e));
  assert.deepEqual(api.stuckFlags('T100').map((f) => f.event.id), [g.id]);
  assert.deepEqual(api.stuckFlags('T101').map((f) => f.event.id), [g.id]);
  assert.deepEqual(api.stuckFlags('T105'), []);
  const told = api.getStore().notifications.slice(0, api.getStore().notifications.length - before).map((n) => n.to).sort();
  assert.deepEqual(told, ['t:T100', 't:T101']);
  assert.match(api.getStore().notifications[0].text, /Fern is stuck on “Run 5k”/);
  // Going well since: no flag. Stuck again two weeks running later: a flag again.
  weekBack(e); api.checkInGoal(g.id, { status: 'well' });
  assert.ok(!api.stuckTwice(api.getEvent(g.id)));
  weekBack(e); api.checkInGoal(g.id, { status: 'stuck' }); weekBack(e); api.checkInGoal(g.id, { status: 'stuck', note: 'Hard week' });
  assert.ok(api.stuckTwice(api.getEvent(g.id)));
  // An old flag fades: the latest check-in more than a week back.
  weekBack(e); weekBack(e);
  assert.ok(!api.stuckTwice(api.getEvent(g.id)));
  for (const c of e.checkins) { c.week = day(c.week, 14); c.date = day(c.date, 14); }
  assert.ok(api.stuckTwice(api.getEvent(g.id)));
});

test('encouragement: the advisor or the sponsor, as themselves, to the student', () => {
  const args = [g.id, 'T100', api.ENCOURAGE_LINES[0], 'Come and see me at lunch.'];
  assert.ok(canAct(brook, 'sendEncouragement', args));
  assert.ok(canAct(carter, 'sendEncouragement', [g.id, 'T101', api.ENCOURAGE_LINES[1], '']));
  assert.ok(!canAct(brook, 'sendEncouragement', [g.id, 'T101', api.ENCOURAGE_LINES[0], '']), 'not as someone else');
  assert.ok(!canAct(gray, 'sendEncouragement', [g.id, 'T105', api.ENCOURAGE_LINES[0], '']), 'not another advisor');
  assert.ok(!canAct(fern, 'sendEncouragement', args)); assert.ok(!canAct(parent, 'sendEncouragement', args));
  const n = api.sendEncouragement(...args);
  assert.equal(n.by, 'T100');
  const note = api.getStore().notifications[0];
  assert.equal(note.to, 'st:S2001'); assert.match(note.text, /^Ms Brook sent you encouragement for “Run 5k”: You’ve got this/);
  assert.ok(api.stuckFlags('T100')[0].sent, 'the flag shows it was sent');
  assert.ok(!api.stuckFlags('T101')[0].sent, 'the sponsor has not sent one yet');
  api.getEvent(g.id).visibility = 'private';
  assert.ok(!canAct(brook, 'sendEncouragement', args), 'never on a private goal');
  assert.deepEqual(api.stuckFlags('T100'), []);
  api.getEvent(g.id).visibility = 'advisor';
});

test('who downloads it: the student, advisor and sponsor see the check-ins; families and other staff do not', () => {
  const ev = (u) => scopedSnapshot(u).store.events.find((e) => e.id === g.id);
  assert.ok(ev(fern).checkins.length >= 2 && ev(fern).encouragements.length === 1);
  assert.ok(ev(brook).checkins.length >= 2); assert.ok(ev(carter).checkins.length >= 2);
  assert.equal(ev(gray), undefined);
  const fam = ev(parent);
  assert.ok(!fam || (!fam.checkins && !fam.encouragements && !fam.checkinSnooze), 'never for families');
  assert.ok(!scopedSnapshot(gus).store.events.some((e) => e.id === g.id));
  assert.ok(api.getEvent(g.id).checkins, 'the full record keeps them');
});

test('a closed or finished goal asks nothing', () => {
  api.closeGoal(other.id);
  assert.ok(!api.checkinsDue('S2001').some((e) => e.id === other.id));
  assert.ok(!canAct(fern, 'checkInGoal', [other.id, { status: 'well' }]));
  api.completeGoal(g.id);
  assert.deepEqual(api.checkinsDue('S2001'), []);
  assert.deepEqual(api.stuckFlags('T100'), []);
});
