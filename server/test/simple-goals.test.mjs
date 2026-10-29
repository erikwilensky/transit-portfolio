// Simple-level goals (src/screens/SimpleHome.jsx GoalFlow): a student plans a goal and asks a class teacher to
// help (api.addGoal with a sponsor), the teacher accepts (answerSponsor), the student marks it done (completeGoal)
// and adds a photo (editStation), or drops it (deleteStation). Who may do each, and what the sponsor downloads.
// Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-goals-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern; she asks him to help
const gray = { kind: 'advisor', teacherId: 'T105' };   // not hers
const f = { title: 'Enter the science fair', date: '2026-12-11', lineId: 'computing', summary: '', checkIn: true, sponsor: 'T101', sponsorNote: '' };
let g, other;

test('setup and canAct: the student plans their own goal with a sponsor; nobody else on her behalf', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  assert.ok(canAct(fern, 'addGoal', ['S2001', f]));
  assert.ok(!canAct(gus, 'addGoal', ['S2001', f]), 'not on someone else’s record');
  assert.ok(!canAct(fern, 'addGoal', ['S2001', f, 'T101']), 'not as a teacher');
  g = api.addGoal('S2001', f);
  other = api.addGoal('S2001', { ...f, title: 'Learn to juggle', sponsor: null });
  assert.equal(g.type, 'goal'); assert.equal(g.sponsor.status, 'invited');
  assert.ok(api.getStore().notifications.some((n) => n.to === 't:T101' && /sponsor/.test(n.text)), 'the teacher is told');
});

test('the sponsor downloads the invitation and only they may answer it', () => {
  assert.ok(scopedSnapshot(carter).store.events.some((e) => e.id === g.id));
  assert.ok(canAct(carter, 'answerSponsor', [g.id, true, 'Show me your poster draft']));
  assert.ok(!canAct(gray, 'answerSponsor', [g.id, true, '']));
  assert.ok(!canAct(fern, 'answerSponsor', [g.id, true, '']), 'not the student');
  api.answerSponsor(g.id, true, 'Show me your poster draft');
  assert.equal(api.getEvent(g.id).sponsor.status, 'accepted');
});

test('done: a moment now, with a request to the sponsor; the photo goes on it', () => {
  assert.ok(canAct(fern, 'completeGoal', [g.id])); assert.ok(!canAct(gus, 'completeGoal', [g.id]));
  api.completeGoal(g.id);
  const e = api.getEvent(g.id);
  assert.equal(e.type, 'project'); assert.ok(e.wasGoal); assert.equal(e.sponsor.status, 'done');
  const rq = api.getStore().requests.find((r) => r.eventId === g.id && r.status === 'pending');
  assert.equal(rq?.teacherId, 'T101'); assert.equal(rq.source, 'sponsor');
  const patch = { evidence: [{ kind: 'image', url: 'api/files/x.png', caption: 'Photo' }] };
  assert.ok(canAct(fern, 'editStation', [g.id, patch]));
  api.editStation(g.id, patch);
  assert.equal(api.getEvent(g.id).evidence[0].url, 'api/files/x.png');
});

test('dropping a goal: the student’s own only', () => {
  assert.ok(canAct(fern, 'deleteStation', [other.id])); assert.ok(!canAct(gus, 'deleteStation', [other.id]));
  api.deleteStation(other.id);
  assert.ok(!api.getEvent(other.id));
});
