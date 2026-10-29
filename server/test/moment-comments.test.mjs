// Moment comments (api.addMomentComment, editMomentComment, deleteMomentComment, markCommentsRead): who may write,
// who receives them (scope), notifications, replay, PDPA copy and erasure. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-comments-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { buildCopy, eraseStudent } = await import('../routes/50-pdpa.mjs');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const brook = { kind: 'teacher', teacherId: 'T100' };   // Fern's advisor
const carter = { kind: 'teacher', teacherId: 'T101' };  // teaches Fern 12 CS; she asks him about one station
const gray = { kind: 'advisor', teacherId: 'T105' };    // not Fern's: out of reach
const coord = { kind: 'coordinator', teacherId: 'T104' }; // whole school
const parent = { kind: 'parent', children: ['S2001'] };
let asked, plain, secret, c1;

test('setup: Fern asks Mr Carter about one station; another asks nobody; a third is private', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  asked = api.addStation('S2001', { title: 'Line-following robot', lineIds: ['computing'], requestFrom: 'T101' });
  plain = api.addStation('S2001', { title: 'Debate club', lineIds: ['computing'] });
  secret = api.addStation('S2001', { title: 'Diary', lineIds: ['computing'], visibility: 'private' });
});

test('canAct: the student on their own stations, as the student only', () => {
  assert.ok(canAct(fern, 'addMomentComment', [asked.id, 'student', 'Hi']));
  assert.ok(!canAct(fern, 'addMomentComment', [asked.id, 'T100', 'Hi']), 'not as a teacher');
  assert.ok(!canAct(gus, 'addMomentComment', [asked.id, 'student', 'Hi']), 'not on someone else’s station');
  assert.ok(!canAct(fern, 'addMomentComment', [secret.id, 'student', 'Hi']), 'not on a private station');
});

test('canAct: advisor, asked teacher, whole-school staff and admins write; others are refused', () => {
  assert.ok(canAct(brook, 'addMomentComment', [plain.id, 'T100', 'Hi']), 'the advisor, any shared station');
  assert.ok(canAct(carter, 'addMomentComment', [asked.id, 'T101', 'Hi']), 'the teacher she asked');
  assert.ok(!canAct(carter, 'addMomentComment', [plain.id, 'T101', 'Hi']), 'a class teacher not asked about it');
  assert.ok(canAct(carter, 'markCommentsRead', [plain.id, 'T101']), 'but may mark it read (it reaches him)');
  assert.ok(!canAct(carter, 'addMomentComment', [asked.id, 'T100', 'Hi']), 'only as himself');
  assert.ok(!canAct(gray, 'addMomentComment', [asked.id, 'T105', 'Hi']), 'a teacher not in reach');
  assert.ok(!canAct(gray, 'markCommentsRead', [asked.id, 'T105']));
  assert.ok(canAct(coord, 'addMomentComment', [plain.id, 'T104', 'Hi']), 'whole-school staff');
  assert.ok(!canAct(coord, 'addMomentComment', [secret.id, 'T104', 'Hi']), 'never a private station');
  assert.ok(canAct({ kind: 'admin' }, 'addMomentComment', [plain.id, 'T104', 'Hi']));
  assert.ok(!canAct(parent, 'addMomentComment', [asked.id, 'student', 'Hi']), 'a parent never');
  assert.ok(!canAct(parent, 'markCommentsRead', [asked.id, 'student']));
  assert.ok(!canAct(carter, 'addMomentComment', ['nope', 'T101', 'Hi']));
});

test('addMomentComment: stored, notifies the other side with a link to the station, replays the same', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  c1 = api.addMomentComment(asked.id, 'T101', 'Nice robot. Can you add a video of it following the line?');
  api.setActionHook(null);
  assert.deepEqual([c1.eventId, c1.studentId, c1.by], [asked.id, 'S2001', 'T101']);
  const n = api.getStore().notifications[0];
  assert.equal(n.to, 'st:S2001');
  assert.match(n.text, /^Mr Carter wrote on “Line-following robot”/);
  assert.deepEqual(n.go, { persona: 'st:S2001', screen: 'map', param: asked.id });
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.equal(api.unreadComments(asked.id, 'student'), 1);
  assert.equal(api.unreadComments(asked.id, 'T101'), 0, 'your own comment is read');
  const n0 = api.getStore().notifications.length;
  api.addMomentComment(asked.id, 'student', 'Yes, I will film it tomorrow.');
  const sent = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(sent.map((x) => x.to).sort(), ['t:T100', 't:T101'], 'the advisor and the asked teacher');
  assert.deepEqual(sent.find((x) => x.to === 't:T100').go, { persona: 't:T100', screen: 'student', param: `S2001~${asked.id}` });
  assert.deepEqual(sent.find((x) => x.to === 't:T101').go, { persona: 't:T101', screen: 'queue', param: `c~${asked.id}` });
  assert.equal(api.unreadComments(asked.id, 'student'), 0, 'replying reads the thread');
  assert.equal(api.unreadComments(asked.id, 'T100'), 2);
  api.markCommentsRead(asked.id, 'T100');
  assert.equal(api.unreadComments(asked.id, 'T100'), 0);
  assert.equal(api.commentWho(c1, 'student'), 'Mr Carter');
  assert.equal(api.commentWho(c1, 'T100'), 'Mr Ben Carter');
  assert.throws(() => api.addMomentComment(secret.id, 'student', 'x'), /just for the student/);
  assert.throws(() => api.addMomentComment(asked.id, 'student', '  '), /Write something/);
});

test('edit within 15 minutes and delete: the author only', () => {
  assert.ok(canAct(carter, 'editMomentComment', [c1.id, 'T101', 'A video please.']));
  assert.ok(!canAct(brook, 'editMomentComment', [c1.id, 'T100', 'x']), 'not someone else’s');
  assert.ok(!canAct(fern, 'deleteMomentComment', [c1.id, 'student']), 'the student cannot delete a teacher’s comment');
  assert.equal(api.editMomentComment(c1.id, 'T101', 'A video please.').text, 'A video please.');
  assert.throws(() => api.editMomentComment(c1.id, 'T100', 'x'), /Only the person/);
  api.getMomentComment(c1.id).at = new Date(Date.now() - 20 * 60000).toISOString();
  assert.ok(!canAct(carter, 'editMomentComment', [c1.id, 'T101', 'late']), 'after 15 minutes, refused');
  assert.throws(() => api.editMomentComment(c1.id, 'T101', 'late'), /15 minutes/);
  assert.ok(canAct(carter, 'deleteMomentComment', [c1.id, 'T101']), 'delete any time');
  const tmp = api.addMomentComment(plain.id, 'T100', 'Who else was on your team?');
  api.deleteMomentComment(tmp.id, 'T100');
  assert.equal(api.getMomentComment(tmp.id), undefined);
});

test('scope: the student and staff who receive the station; never families or staff out of reach', () => {
  api.addMomentComment(plain.id, 'T104', 'Great to see you in debate.');
  const ids = (u) => scopedSnapshot(u).store.momentComments.map((c) => c.eventId).sort();
  const all = api.getStore().momentComments.map((c) => c.eventId).sort();
  assert.deepEqual(ids(fern), all);
  assert.deepEqual(ids(brook), all);
  assert.deepEqual(ids(carter), all, 'advisor-level stations reach his class’s students');
  assert.deepEqual(ids(coord), all);
  assert.deepEqual(ids(gus), []);
  assert.deepEqual(ids(gray), []);
  assert.deepEqual(ids(parent), [], 'a parent never');
  assert.deepEqual(scopedSnapshot(parent).store.commentReads, []);
  assert.ok(scopedSnapshot(fern).store.commentReads.every((r) => r.by === 'student'));
  assert.ok(scopedSnapshot(brook).store.commentReads.every((r) => r.by === 'T100'));
  // A station that turns private leaves the staff's copies.
  api.setVisibility(plain.id, 'private');
  assert.ok(!ids(brook).includes(plain.id) && ids(fern).includes(plain.id));
  api.setVisibility(plain.id, 'advisor');
});

test('PDPA: the copy holds the comments; erasure removes them', () => {
  const z = Object.fromEntries(buildCopy('S2001').entries.map((e) => [e.name, String(e.data)]));
  assert.ok(z['momentComments.json']?.includes('I will film it tomorrow'));
  assert.ok(z['README.txt'].includes('Comments on your moments'));
  assert.ok(!buildCopy('S2002').entries.some((e) => String(e.data).includes('film it tomorrow')));
  eraseStudent('S2001', 'u-admin');
  assert.equal(api.getStore().momentComments.filter((c) => c.studentId === 'S2001').length, 0);
  assert.equal(api.getStore().commentReads.filter((r) => r.studentId === 'S2001').length, 0);
});
