// Reviewing class-question answers (api.promptReview, classAnswerGroups, answersCsv): bulk endorse permissions,
// statuses, the queue grouping and the CSV, from a teacher's scoped copy. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-answers-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const brook = { kind: 'teacher', teacherId: 'T100' }; // teaches 12 Biology (S2001, S2002)
const carter = { kind: 'teacher', teacherId: 'T101' };
let p1, p2;

test('setup: two answers to one question come to the asking teacher', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science']; }
  api.getStudent('S2002').name = 'สมชาย "Som" ใจดี';
  p1 = api.askClass('C-BIO12', 'T100', { question: 'What did you learn on the field trip?', context: 'Field trip', asMoment: true });
  assert.ok(p1.asMoment);
  api.answerPrompt(p1.id, 'S2001', { text: 'Ponds have layers, like a city.', image: '/api/files/pond.jpg' });
  api.answerPrompt(p1.id, 'S2002', { text: '=1+1, and "quotes", too' });
});

test('classAnswerGroups: one group in Endorsements with both requests', () => {
  const g = api.classAnswerGroups('T100');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].prompt.id, g[0].prompt.className, g[0].requests.length], [p1.id, '12 Biology HL', 2]);
  assert.deepEqual(api.classAnswerGroups('T101'), []);
});

test('promptReview: every answer waiting, with its photo', () => {
  const rv = api.promptReview(p1.id);
  assert.deepEqual(rv.rows.map((r) => r.status), ['waiting', 'waiting']);
  assert.equal(rv.rows.find((r) => r.studentId === 'S2001').photo.url, '/api/files/pond.jpg');
  assert.equal(api.promptReview('cq-nope'), null);
});

test('canAct: the asking teacher endorses all their answers in one call; nobody else', () => {
  const ids = api.promptReview(p1.id).rows.map((r) => r.request.id);
  assert.ok(canAct(brook, 'endorse', [ids, 'T100', 'Clear progress. Good work.']));
  assert.ok(!canAct(brook, 'endorse', [ids, 'T101', 'x']), 'only as herself');
  assert.ok(!canAct(carter, 'endorse', [ids, 'T101', 'x']), 'requests to someone else');
  assert.ok(!canAct(carter, 'endorse', [ids, 'T100', 'x']));
  assert.ok(canAct(brook, 'declineRequest', [ids[0], 'More please']) && !canAct(carter, 'declineRequest', [ids[0], 'x']));
});

test('a scoped teacher copy: review, endorse all in one change (replayed identically), statuses', () => {
  const full = api.snapshot();
  api.restore(JSON.stringify(scopedSnapshot(brook)));
  const rv = api.promptReview(p1.id);
  assert.deepEqual(rv.rows.map((r) => r.status), ['waiting', 'waiting'], 'the teacher’s own copy holds everything the review needs');
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  api.endorse(rv.rows.map((r) => r.request.id), 'T100', 'Clear progress');
  api.setActionHook(null);
  assert.deepEqual(api.promptReview(p1.id).rows.map((r) => r.status), ['endorsed', 'endorsed']);
  api.restore(full);
  api.runAction(step.fn, step.args, step.rec);
  assert.deepEqual(api.promptReview(p1.id).rows.map((r) => r.status), ['endorsed', 'endorsed']);
  assert.ok(api.promptReview(p1.id).rows.every((r) => r.event.verification === 'teacher-endorsed'));
  assert.equal(api.getStore().endorsements.filter((n) => n.note === 'Clear progress').length, 2);
  assert.deepEqual(api.classAnswerGroups('T100'), []);
});

test('ask for more, skip, not answered: statuses and the CSV', () => {
  p2 = api.askClass('C-BIO12', 'T100', { question: 'One thing you would change?', asMoment: true });
  const a = api.answerPrompt(p2.id, 'S2001', { text: 'Start earlier,\nand plan.' });
  const rq = api.getStore().requests.find((r) => r.eventId === a.eventId);
  api.declineRequest(rq.id, 'Add a photo?');
  assert.deepEqual(api.promptReview(p2.id).rows.map((r) => [r.studentId, r.status]), [['S2001', 'more'], ['S2002', 'none']]);
  api.skipPrompt(p2.id, 'S2002');
  assert.equal(api.promptReview(p2.id).rows[1].status, 'skipped');

  const csv = api.answersCsv(p1.id);
  assert.ok(csv.startsWith('\uFEFFName,Homeroom,Status,Answered at,Answer,Endorsed\r\n'));
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^[^,]+,[^,]*,Endorsed,\d{4}-\d\d-\d\d \d\d:\d\d,"Ponds have layers, like a city\.",yes$/);
  assert.ok(lines[2].startsWith('"สมชาย ""Som"" ใจดี",'), 'Thai names kept, quotes doubled');
  assert.ok(lines[2].includes(`"'=1+1, and ""quotes"", too",yes`), 'a formula-looking answer is defused');
  const csv2 = api.answersCsv(p2.id).slice(1).trim().split(/\r\n(?=[^\n])/);
  assert.match(csv2[1], /,Asked for more,.*,"Start earlier,\nand plan\.",no$/);
  assert.match(csv2[2], /,Not for them,,,$/);
  // A reflection question has nothing to endorse: the Endorsed column stays empty.
  const p3 = api.askClass('C-BIO12', 'T100', { question: 'Anything else to say?', asMoment: false });
  api.answerPrompt(p3.id, 'S2002', { text: 'No.' });
  const csv3 = api.answersCsv(p3.id).slice(1).trim().split('\r\n');
  assert.ok(csv3.some((l) => l.endsWith(',Answered,' + l.split(',')[3] + ',No.,')));
  assert.ok(csv3.some((l) => /,Not answered yet,,,$/.test(l)));
});
