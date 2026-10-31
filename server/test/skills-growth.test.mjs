// Skills growth (api.chooseSkills, chosenSkills, skillsGrowth, skillsReader; setTags cleaning): only the skills a student
// picked count, by term of this school year, and each viewer gets it only from the moments they already receive.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-skills-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' };
const mum = { kind: 'parent', id: 'acc-mum', name: 'Mia Gale', children: ['S2001'] };
const brook = { kind: 'advisor', teacherId: 'T100' };  // Fern's advisor
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern CS
const gray = { kind: 'advisor', teacherId: 'T105' };   // nothing to do with Fern
const coord = { kind: 'coordinator', teacherId: 'T104' };
let evSchool, evAdv, evPriv, evOld, evNone, evGoal;
const T = api.TODAY, yr = api.skillsYearOf(T);
// What a viewer downloads, read the way the browser's getStudentMap does (no tag record = the app's suggestion).
const growthFor = (user, sid = 'S2001') => {
  const { store } = scopedSnapshot(user);
  const events = store.events.filter((e) => e.studentId === sid).map((e) => ({ ...e, tags: store.tags?.[e.id] || { lp: [], atl: [], auto: true } }));
  return api.skillsGrowth(events, T);
};
const row = (g, k) => g.rows.find((r) => r.k === k);

test('setup: class lists and moments', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science']; }
  evSchool = api.addStation('S2001', { title: 'Hackathon team lead', lineIds: ['science'], visibility: 'school' });
  evAdv = api.addStation('S2001', { title: 'Research essay draft', lineIds: ['science'], visibility: 'advisor' });
  evPriv = api.addStation('S2001', { title: 'Diary', lineIds: ['science'], visibility: 'private' });
  evOld = api.addStation('S2001', { title: 'Last year’s survey', lineIds: ['science'], visibility: 'school', date: `${+yr.from.slice(0, 4) - 1}-09-10` });
  evNone = api.addStation('S2001', { title: 'Football match', lineIds: ['science'], visibility: 'school' });
  evGoal = api.addStation('S2001', { title: 'A goal', lineIds: ['science'], type: 'goal', visibility: 'school', date: T });
  assert.ok(api.getTags(evSchool).auto, 'suggested until the student picks');
});

test('setTags keeps only known skills; chooseSkills splits them; suggestions never count', () => {
  api.setTags(evSchool.id, { lp: ['Risk-taker', 'Hacker', 'Risk-taker'], atl: ['Social', 'Juggling'] });
  assert.deepEqual(api.getStore().tags[evSchool.id], { lp: ['Risk-taker'], atl: ['Social'], auto: false });
  api.chooseSkills(evAdv.id, ['Research', 'Inquirer', 'Nope']);
  assert.deepEqual(api.getStore().tags[evAdv.id], { lp: ['Inquirer'], atl: ['Research'], auto: false });
  api.chooseSkills(evPriv.id, ['Reflective']);
  api.chooseSkills(evOld.id, ['Inquirer']);
  api.chooseSkills(evGoal.id, ['Balanced']);
  assert.deepEqual(api.chosenSkills(api.getEvent(evSchool.id)), ['Risk-taker', 'Social']);
  assert.ok(api.getTags(evNone).auto && api.getTags(evNone).lp.includes('Balanced'), 'football gets a suggestion');
  assert.deepEqual(api.chosenSkills(api.getEvent(evNone.id)), [], 'which does not count');
  assert.ok(api.getStore().activity.some((a) => a.studentId === 'S2001' && /^Tagged “Hackathon team lead”: Risk-taker, Social$/.test(a.text)), 'the log names only kept tags');
});

test('skillsGrowth: this school year by term, goals and earlier years left out, untagged listed', () => {
  const g = api.skillsGrowth(api.getStudentMap('S2001', 'student').events, T);
  const t = api.termIndex(T);
  assert.equal(g.year.from, yr.from);
  assert.deepEqual(row(g, 'Inquirer').ids, [evAdv.id], 'last year’s survey is not this year');
  assert.equal(row(g, 'Inquirer').terms[t], 1);
  assert.equal(row(g, 'Balanced').n, 0, 'a goal is not a moment; football is only suggested');
  assert.equal(row(g, 'Reflective').n, 1, 'the student sees their own private moment');
  assert.deepEqual(g.untagged, [evNone.id]);
  assert.equal(g.tagged, 3);
  assert.deepEqual(g.rows.map((r) => r.k), api.SKILLS, 'always the IB order, never ranked');
  assert.ok(g.rows.every((r) => !('score' in r) && !('rank' in r)));
});

test('each viewer: only from the moments they already receive', () => {
  const own = growthFor(fern);
  assert.equal(row(own, 'Reflective').n, 1);
  const adv = growthFor(brook);
  assert.equal(row(adv, 'Reflective').n, 0, 'private never reaches the advisor');
  assert.equal(row(adv, 'Inquirer').n, 1, 'advisor-level moments do');
  const tch = growthFor(carter);
  assert.equal(row(tch, 'Risk-taker').n, 1);
  const fam = growthFor(mum);
  assert.equal(row(fam, 'Risk-taker').n, 1, 'Year 12: the family sees what is shared with the school');
  assert.equal(row(fam, 'Inquirer').n, 0, 'not the advisor-level essay');
  assert.equal(row(fam, 'Reflective').n, 0);
  const none = scopedSnapshot(gray).store;
  assert.ok(!none.events.some((e) => e.studentId === 'S2001') && !Object.keys(none.tags || {}).some((id) => api.getEvent(id)?.studentId === 'S2001'), 'an unrelated advisor gets nothing');
  assert.equal(growthFor(gus).tagged, 0, 'another student gets nothing');
});

test('skillsReader: the advisor, a current class teacher and whole-school roles', () => {
  assert.ok(api.skillsReader(brook, 'S2001'));
  assert.ok(api.skillsReader(carter, 'S2001'));
  assert.ok(api.skillsReader(coord, 'S2001'));
  assert.ok(!api.skillsReader(gray, 'S2001'));
  assert.ok(!api.skillsReader(carter, 'S2002'), 'Carter does not teach Gus');
  assert.ok(!api.skillsReader(null, 'S2001'));
});

test('canAct: the student tags their own moments; families and unrelated staff cannot', () => {
  assert.ok(canAct(fern, 'setTags', [evNone.id, { lp: ['Balanced'], atl: [] }]));
  assert.ok(!canAct(gus, 'setTags', [evNone.id, { lp: ['Balanced'], atl: [] }]));
  assert.ok(!canAct(mum, 'setTags', [evNone.id, { lp: ['Balanced'], atl: [] }]));
  assert.ok(!canAct(gray, 'setTags', [evNone.id, { lp: ['Balanced'], atl: [] }]));
});
