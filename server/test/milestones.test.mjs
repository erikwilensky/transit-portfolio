// Milestones (api.milestonesOf, familyMilestones, markMilestonesSeen): derived per viewer, seen once, only by the student.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-milestones-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' };
const admin = { kind: 'admin' }, coord = { kind: 'coordinator', teacherId: 'T104' }, brook = { kind: 'teacher', teacherId: 'T100' };
const keys = (l) => l.map((m) => m.key);

test('setup', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science']; }
});

test('derived from the map as each viewer reads it; nothing stored', () => {
  assert.deepEqual(api.milestonesOf('S2001'), []);
  api.addStation('S2001', { title: 'Sketchbook', lineIds: ['art'], visibility: 'private', date: api.daysBefore(3) });
  api.addStation('S2001', { title: 'Pond survey', lineIds: ['science'], visibility: 'school', date: api.daysBefore(1) });
  assert.deepEqual(keys(api.milestonesOf('S2001')), ['first', 'line:art', 'line:science']);
  assert.deepEqual(keys(api.milestonesOf('S2001', 'advisor')), ['first', 'line:science'], 'the private moment is not the advisor’s');
  assert.equal(api.milestonesOf('S2001', 'advisor')[0].eventTitle, 'Pond survey');
  assert.ok(api.familyMilestones('S2001').every((m) => m.eventTitle !== 'Sketchbook'));
  assert.deepEqual(keys(api.recentMilestones('S2001', 'advisor')).sort(), ['first', 'line:science']);
  assert.equal(api.milestonesSeen('S2001'), null);
  assert.ok(!('milestones' in api.getStore()));
});

test('markMilestonesSeen: kept once per key, deterministic on replay', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  api.markMilestonesSeen('S2001', ['first', 'line:art']);
  api.setActionHook(null);
  const seen = api.milestonesSeen('S2001'), at = seen.first;
  assert.deepEqual(Object.keys(seen), ['first', 'line:art']);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  api.markMilestonesSeen('S2001', ['first', 'line:science', 7, '']);
  assert.equal(api.milestonesSeen('S2001').first, at, 'the first time stays');
  assert.deepEqual(Object.keys(api.milestonesSeen('S2001')), ['first', 'line:art', 'line:science']);
  assert.throws(() => api.markMilestonesSeen('nope', ['first']), /No such student/);
});

test('canAct: only the student, for their own', () => {
  assert.ok(canAct(s1, 'markMilestonesSeen', ['S2001', ['first']]));
  assert.ok(!canAct(s2, 'markMilestonesSeen', ['S2001', ['first']]));
  assert.ok(!canAct(admin, 'markMilestonesSeen', ['S2001', ['first']]), 'not an admin');
  assert.ok(!canAct(coord, 'markMilestonesSeen', ['S2001', ['first']]), 'not whole-school staff');
  assert.ok(!canAct(brook, 'markMilestonesSeen', ['S2001', ['first']]), 'not a teacher');
  assert.ok(!canAct({ kind: 'parent', children: ['S2001'] }, 'markMilestonesSeen', ['S2001', ['first']]), 'not a family');
});

test('scope: the seen state goes to that student only', () => {
  api.markMilestonesSeen('S2002', ['first']);
  assert.deepEqual(Object.keys(scopedSnapshot(s1).store.milestonesSeen), ['S2001']);
  assert.deepEqual(scopedSnapshot(coord).store.milestonesSeen, {});
  assert.deepEqual(scopedSnapshot(brook).store.milestonesSeen, {});
  assert.deepEqual(scopedSnapshot({ kind: 'parent', children: ['S2001'] }).store.milestonesSeen, {});
});

test('PDPA: part of the copy, gone with erasure', () => {
  assert.ok(api.studentData('S2001').own.milestonesSeen?.S2001);
  api.eraseStudent('S2001');
  assert.equal(api.getStore().milestonesSeen.S2001, undefined);
  assert.ok(api.getStore().milestonesSeen.S2002);
});
