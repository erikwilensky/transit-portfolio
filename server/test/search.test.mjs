// Search (src/search.js): run in each person's own part of the record (scopedSnapshot), as the browser does, it finds only
// what that person's screens show, and never anything the server did not send them. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-search-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { collect, createIndex, search, setDocs } = await import('../../src/search.js');

const PEOPLE = {
  student: { kind: 'student', studentId: 'S2001' },
  classmate: { kind: 'student', studentId: 'S2002' },
  teacher: { kind: 'teacher', teacherId: 'T101' }, // teaches S2001 (C-CS12), not their advisor
  advisor: { kind: 'advisor', teacherId: 'T100' }, // S2001's advisor
  coordinator: { kind: 'coordinator', teacherId: 'T104' },
  stranger: { kind: 'advisor', teacherId: 'T105' }, // no classes, no advisees
  parent: { kind: 'parent', children: ['S2001'] },
};
// What one person's browser finds: their scoped part of the record loaded, then searched.
function find(who, q) {
  const full = JSON.parse(api.snapshot());
  const part = scopedSnapshot(PEOPLE[who]);
  try {
    api.load(JSON.parse(JSON.stringify(part)));
    const ix = createIndex(); setDocs(ix, collect(api, { id: 'me', ...PEOPLE[who] }));
    const sent = new Set(part.store.events.map((e) => e.id));
    for (const d of ix.docs.values()) if (d.eventId) assert.ok(sent.has(d.eventId), `${who}: ${d.id} was sent to them`);
    return search(ix, q).results.map((d) => `${d.kind}:${d.title}`);
  } finally { api.load(full); }
}

test('setup', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art', 'science']; }
  const sch = api.addStation('S2001', { title: 'Pond survey', lineIds: ['science'], visibility: 'school', summary: 'Counted dragonflies' });
  api.addStation('S2001', { title: 'Pond diary', lineIds: ['science'], visibility: 'private' });
  api.addStation('S2001', { title: 'Pond plan for my advisor', lineIds: ['science'], visibility: 'advisor' });
  api.addStation('S2002', { title: 'Pond photos', lineIds: ['art'], visibility: 'school' });
  api.addStation('S2001', { title: 'สำรวจบ่อน้ำ', lineIds: ['science'], visibility: 'school' });
  api.addReflection({ studentId: 'S2001', eventId: sch.id, prompt: 'What surprised you?', text: 'The frogs were loud', visibility: 'private' });
  api.addNote('S2001', 'Keen on ponds; talk about the EE');
});

test('a student: their own record in full, nobody else', () => {
  assert.deepEqual(find('student', 'pond').sort(), ['moment:Pond diary', 'moment:Pond plan for my advisor', 'moment:Pond survey']);
  assert.deepEqual(find('student', 'frogs'), ['reflection:Pond survey']);
  assert.deepEqual(find('student', 'บ่อ'), ['moment:สำรวจบ่อน้ำ']);
  assert.deepEqual(find('student', 'keen'), [], 'never the advisor notes');
  assert.deepEqual(find('classmate', 'pond'), ['moment:Pond photos']);
});

test('staff: within reach, never private, a class teacher school level only', () => {
  assert.deepEqual(find('teacher', 'pond'), ['moment:Pond survey'], 'a class teacher: school level, and only students they teach');
  const name = api.getStudent('S2001').name;
  assert.ok(find('teacher', name.split(' ')[0]).includes(`student:${name}`), 'finds the student by name');
  assert.deepEqual(find('teacher', 'frogs'), [], 'no private reflection');
  assert.deepEqual(find('advisor', 'pond').sort(), ['moment:Pond photos', 'moment:Pond plan for my advisor', 'moment:Pond survey', `note:Advisor note on ${name}`]);
  assert.deepEqual(find('advisor', 'keen'), [`note:Advisor note on ${name}`]);
  assert.ok(!find('coordinator', 'pond').includes('moment:Pond diary'), 'whole school, still never private');
  assert.deepEqual(find('coordinator', 'keen'), [`note:Advisor note on ${name}`]);
  assert.deepEqual(find('stranger', 'pond'), [], 'no reach: nothing');
  assert.deepEqual(find('stranger', name.split(' ')[0]), []);
});

test('a family: the family view of their own child', () => {
  const r = find('parent', 'pond');
  assert.ok(r.includes('moment:Pond survey') && !r.includes('moment:Pond diary') && !r.includes('moment:Pond photos'), r.join());
  assert.deepEqual(find('parent', 'keen'), []);
});
