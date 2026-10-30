// A new year (store.yearStart): a subject teacher's links from earlier years (prompts, endorsement requests and
// endorsements) stop reaching a student they no longer teach; a teacher who still has a current class with the student
// keeps them. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-yearreach-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { reachOf, scopedSnapshot } = await import('../scope.mjs');

const GUS = 'S2002', FERN = 'S2001';
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern Computer Science, never Gus
let gusSt, fernSt;

test('this year: a prompt and an endorsement bring Gus into Mr Carter’s reach', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science', 'computing']; }
  gusSt = api.addStation(GUS, { title: 'Robot arm prototype', date: api.daysBefore(10), lineIds: ['computing'] });
  fernSt = api.addStation(FERN, { title: 'Sorting visualiser', date: api.daysBefore(9), lineIds: ['computing'] });
  api.sendPrompt(GUS, gusSt.id, 'What would you change next time?', 'T101');
  const r = api.requestEndorsement(gusSt.id, 'T101', 'Could you endorse this?');
  api.endorse([r.id], 'T101', 'Careful work.');
  api.sendPrompt(FERN, fernSt.id, 'Which part was hardest?', 'T101');
  assert.ok(reachOf(carter).has(GUS) && reachOf(carter).has(FERN));
  assert.ok(canAct(carter, 'sendPrompt', [GUS, gusSt.id, 'More?', 'T101']));
});

test('the new year: his old links to Gus stop counting; his current class keeps Fern', () => {
  const r = structuredClone(FX);
  r.school = { ...r.school, academicYear: '2027-28', exportedAt: api.daysBefore(1) };
  api.importRoster(r);
  assert.equal(api.getYearStart().year, '2027-28');
  const reach = reachOf(carter);
  assert.ok(!reach.has(GUS), 'last year’s prompt, request and endorsement no longer reach Gus');
  assert.ok(reach.has(FERN), 'he still teaches Fern');
  assert.ok(!canAct(carter, 'sendPrompt', [GUS, gusSt.id, 'More?', 'T101']));
  assert.ok(canAct(carter, 'sendPrompt', [FERN, fernSt.id, 'More?', 'T101']));
  const s = scopedSnapshot(carter).store;
  assert.ok(!s.students.some((x) => x.id === GUS) && !s.events.some((e) => e.studentId === GUS), 'Gus is not in his download');
  assert.ok(s.events.some((e) => e.id === fernSt.id), 'Fern is');
  assert.ok(reachOf({ kind: 'advisor', teacherId: 'T100' }).has(GUS), 'Gus’s advisor keeps him');
});

test('a link made after the year start counts again', () => {
  const y = api.getStore().yearStart;
  y.date = api.daysBefore(1); // the year started yesterday; a request today is this year's
  api.requestEndorsement(gusSt.id, 'T101', 'This year: could you look again?');
  assert.ok(reachOf(carter).has(GUS));
});
