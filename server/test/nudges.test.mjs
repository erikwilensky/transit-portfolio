// Advisor nudges in api.js: who is quiet, the 7-day gap, and the student's banner. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nudges-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { roster } = api.parseRoster(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
api.importRoster(roster);
const quiet = (tid) => api.quietAdvisees(tid).map((q) => [q.student.id, q.last]);

test('quiet for 3 weeks: nothing of their own in 21 days, or never', () => {
  assert.deepEqual(quiet('T100'), [['S2001', null], ['S2002', null]], 'not started yet');
  // Fern's own moment from 25 days ago (no log line): still quiet. Gus's from 20 days ago: not.
  const st = api.getStore();
  st.events.push({ id: 'ev-old', studentId: 'S2001', title: 'Old', date: api.daysBefore(25), lineIds: ['science'], type: 'project', verification: 'student-added', visibility: 'advisor', evidence: [], source: { system: 'Manual entry' } });
  st.events.push({ id: 'ev-new', studentId: 'S2002', title: 'Newer', date: api.daysBefore(20), lineIds: ['science'], type: 'project', verification: 'student-added', visibility: 'advisor', evidence: [], source: { system: 'Manual entry' } });
  assert.deepEqual(quiet('T100'), [['S2001', api.daysBefore(25)]]);
  // A school-verified item is not their own; a reflection on their moment is.
  st.reflections.push({ id: 'rf-t', eventId: 'ev-old', text: 'x', date: api.daysBefore(2), visibility: 'private' });
  assert.deepEqual(quiet('T100'), []);
  st.reflections.pop(); st.events.pop();
  // Adding today a moment dated last month counts as today (the log line).
  api.addStation('S2002', { title: 'Back-dated', date: api.daysBefore(40), lineIds: ['science'] });
  assert.deepEqual(quiet('T100'), [['S2001', api.daysBefore(25)]]);
});

test('nudgeStudent: a notification, at most once in 7 days; the banner until they add something', () => {
  assert.equal(api.canNudge('S2001'), true);
  const n = api.nudgeStudent('S2001', 'T100');
  assert.equal(n.text, api.NUDGE_TEXT);
  assert.equal(api.getNotifications('st:S2001')[0].text, `Ms Brook: ${api.NUDGE_TEXT}`);
  assert.throws(() => api.nudgeStudent('S2001', 'T100', 'again'), (e) => e.status === 409);
  assert.equal(api.canNudge('S2001'), false);
  assert.equal(api.quietAdvisees('T100')[0].nudge.id, n.id);
  n.date = api.daysBefore(6); assert.equal(api.canNudge('S2001'), false);
  n.date = api.daysBefore(7); assert.equal(api.canNudge('S2001'), true);
  n.date = api.TODAY;
  assert.throws(() => api.nudgeStudent('S2003', 'nobody'), (e) => e.status === 400);
  // Custom text, trimmed; empty falls back to the default.
  assert.equal(api.nudgeStudent('S2003', 'T104', '  Hi Hana  ').text, 'Hi Hana');
  assert.equal(api.openNudge('S2001').fromName, 'Ms Ada Brook');
  api.addStation('S2001', { title: 'Lab report', lineIds: ['science'] });
  assert.equal(api.openNudge('S2001'), null, 'answered');
  assert.equal(api.openNudge('S2003').text, 'Hi Hana');
});
