// What pilot screens read from the class lists, and the pilot's real calendar. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-pilot-helpers-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { roster } = api.parseRoster(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
api.importRoster(roster);

test('a pilot runs on the real calendar (Bangkok), the demo on its fixed day', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  assert.equal(api.TODAY, today);
  assert.equal(api.liveDate(), true);
  assert.equal(api.daysBefore(1), new Date(Date.parse(today) - 864e5).toISOString().slice(0, 10));
});

test('teachersOf: the teachers of a student’s classes, then their advisor', () => {
  const mine = api.teachersOf('S2001');
  assert.deepEqual(mine.map((m) => m.teacher.id).sort(), ['T100', 'T101', 'T103']);
  assert.equal(mine.find((m) => m.teacher.id === 'T100').lineId, 'science');
  assert.deepEqual(api.teachersOf('nobody'), []);
});

test('endorserChoices: the student’s own teachers, the one on the station’s line first', () => {
  assert.equal(api.endorserChoices('S2001', [], ['computing'])[0].id, 'T101');
  assert.equal(api.endorserChoices('S2001', [], ['science'])[0].id, 'T100');
  assert.equal(new Set(api.endorserChoices('S2001').map((t) => t.id)).size, 3);
});

test('advisoryOf: named after the advisees’ homeroom, with their Years', () => {
  assert.deepEqual(api.advisoryOf('T100'), { name: 'Advisory 12B', minYear: 12, maxYear: 12, size: 2 });
  assert.equal(api.advisoryOf('T101').name, 'My advisory');
});

test('subjectLineOf: the line a teacher mostly teaches on', () => {
  assert.equal(api.subjectLineOf('T101'), 'computing');
  assert.equal(api.subjectLineOf('T102'), null);
});

test('a student who has not started is not flagged for few reflections', () => {
  assert.equal(api.getCohort('T100').every((c) => !c.flagFewReflections), true);
});
