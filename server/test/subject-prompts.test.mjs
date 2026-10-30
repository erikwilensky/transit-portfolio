// Subject prompts (api.setSubjectPrompts, clearSubjectPrompts, answerExampleAsk, getPromptsFor): which prompts a student
// sees, permissions, examples only with the student's yes, scope and replay. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-subject-prompts-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics (computing) and 12 CS
const brook = { kind: 'teacher', teacherId: 'T100' };  // teaches 12 Biology (science)
const fong = { kind: 'coordinator', teacherId: 'T104' };
const ellis = { kind: 'leadership', teacherId: 'T103' };
const gray = { kind: 'advisor', teacherId: 'T105' };
const s1 = { kind: 'student', studentId: 'S2001' }, s2 = { kind: 'student', studentId: 'S2002' }, s3 = { kind: 'student', studentId: 'S2003' };
const Q = ['What were you testing?', 'What did you measure?', 'What did the results show?'];
let bioP, lineP, ev2;

test('setup: class lists; Biology on Science, Computer Science on Computing', () => {
  api.importRoster(structuredClone(FX));
  for (const c of api.getClasses()) c.lineId = { 'C-BIO12': 'science', 'C-CS12': 'computing', 'C-ROB8': 'computing' }[c.id] || null;
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science', 'computing']; }
});

test('defaults: every school line has a note, 3–6 questions and starters, in British English', () => {
  for (const l of api.schoolLines()) {
    const d = api.DEFAULT_PROMPTS[l.id];
    assert.ok(d && d.note && d.questions.length >= 3 && d.questions.length <= 6 && d.starters.length, l.id);
    assert.ok(![d.note, ...d.questions, ...d.starters].join(' ').match(/\b(color|practice performing|organiz|behavior)\b/i), l.id);
  }
  const p = api.getPromptsFor('S2001', 'science');
  assert.deepEqual([p.id, p.source, p.questions], ['sp-default-science', 'default', api.DEFAULT_PROMPTS.science.questions]);
  assert.equal(api.getPromptsFor('S2001', 'no-such-line'), null);
});

test('canAct: class prompts by the class’s teachers; line prompts by coordinators and leadership; as themselves', () => {
  const cls = (cid, by) => [{ classId: cid }, { questions: Q }, by];
  const line = (lid, by) => [{ lineId: lid }, { questions: Q }, by];
  assert.ok(canAct(brook, 'setSubjectPrompts', cls('C-BIO12', 'T100')));
  assert.ok(!canAct(brook, 'setSubjectPrompts', cls('C-CS12', 'T100')), 'not her class');
  assert.ok(!canAct(brook, 'setSubjectPrompts', cls('C-BIO12', 'T101')), 'only as herself');
  assert.ok(!canAct(brook, 'setSubjectPrompts', line('science', 'T100')), 'a subject teacher does not write a whole line’s');
  assert.ok(!canAct(gray, 'setSubjectPrompts', cls('C-BIO12', 'T105')));
  assert.ok(canAct(fong, 'setSubjectPrompts', line('science', 'T104')) && canAct(ellis, 'setSubjectPrompts', line('art', 'T103')));
  assert.ok(!canAct(fong, 'setSubjectPrompts', cls('C-BIO12', 'T104')), 'a coordinator who does not teach the class');
  assert.ok(!canAct(fong, 'setSubjectPrompts', line('science', 'T100')));
  assert.ok(canAct({ kind: 'admin' }, 'setSubjectPrompts', line('science', null)) && !canAct({ kind: 'admin' }, 'setSubjectPrompts', line('science', 'T100')));
  assert.ok(!canAct(s1, 'setSubjectPrompts', cls('C-BIO12', 'T100')));
  assert.ok(!canAct({ kind: 'parent', children: ['S2001'] }, 'setSubjectPrompts', line('science', null)));
  assert.ok(!canAct({ kind: 'counsellor', teacherId: 'T102' }, 'setSubjectPrompts', line('science', 'T102')));
});

test('setSubjectPrompts: checks, replaces in place, deterministic on replay', () => {
  assert.throws(() => api.setSubjectPrompts({ classId: 'C-BIO12' }, { questions: Q.slice(0, 2) }, 'T100'), /3 to 6/);
  assert.throws(() => api.setSubjectPrompts({ classId: 'C-MAT12' }, { questions: Q }, 'T103'), /not on a line/);
  assert.throws(() => api.setSubjectPrompts({ lineId: 'nope' }, { questions: Q }, 'T104'), /school line/);
  assert.throws(() => api.setSubjectPrompts({ classId: 'nope' }, { questions: Q }, 'T100'), /No such class/);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  bioP = api.setSubjectPrompts({ classId: 'C-BIO12' }, { note: '  Say what you tested.  ', questions: [...Q, ' ', Q[0]], starters: ['I tested…', 'The results showed…'], examples: [{ title: 'Pond survey', text: 'We counted species in two ponds.' }] }, 'T100');
  api.setActionHook(null);
  assert.deepEqual([bioP.lineId, bioP.classId, bioP.note, bioP.questions, bioP.examples[0].status], ['science', 'C-BIO12', 'Say what you tested.', Q, 'teacher']);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  bioP = api.getSubjectPrompt(bioP.id);
  const again = api.setSubjectPrompts({ classId: 'C-BIO12' }, { questions: [...Q, 'What next?'] }, 'T100');
  assert.equal(again.id, bioP.id, 'one per class: rewriting keeps the id');
  assert.equal(api.getSubjectPrompts().filter((p) => p.classId === 'C-BIO12').length, 1);
  lineP = api.setSubjectPrompts({ lineId: 'science' }, { note: 'Science, the whole line.', questions: ['Line Q1?', 'Line Q2?', 'Line Q3?'] }, 'T104');
});

test('getPromptsFor: the class’s own, else the line’s, else built-in; a class task can name its class', () => {
  assert.deepEqual([api.getPromptsFor('S2001', 'science').id, api.getPromptsFor('S2001', 'science').source], [bioP.id, 'class']);
  assert.equal(api.getPromptsFor('S2001', 'science').teacher.id, 'T100');
  assert.equal(api.getPromptsFor('S2003', 'science').id, lineP.id, 'not in 12 Biology: the line’s');
  assert.equal(api.getPromptsFor('S2001', 'computing').source, 'default');
  // A sub-line counts for its school line.
  api.getStore().lines.push({ id: 'S2003-ecology', name: 'Ecology', parentLineId: 'science', studentId: 'S2003', status: 'active' });
  assert.equal(api.getPromptsFor('S2003', 'S2003-ecology').id, lineP.id);
  assert.equal(api.getPromptsFor('S2003', 'science', 'C-BIO12').id, bioP.id);
  // An ended class place no longer counts.
  const n = api.getEnrolments().find((x) => x.studentId === 'S2002' && x.classId === 'C-BIO12');
  n.to = '2026-01-01';
  assert.equal(api.getPromptsFor('S2002', 'science').id, lineP.id);
  delete n.to;
});

test('uses: a moment written with prompts carries promptId and counts', () => {
  const e = api.addStation('S2001', { title: 'Enzyme lab', lineIds: ['science'], reflection: 'What were you testing?\nHow heat changes enzymes.', promptId: bioP.id });
  assert.equal(e.promptId, bioP.id);
  api.addStation('S2002', { title: 'Plain moment', lineIds: ['science'] });
  assert.equal(api.promptUses(bioP.id), 1);
  assert.equal(api.promptsAdmin({ classId: 'C-BIO12' }).uses, 1);
  assert.ok(canAct(s1, 'addStation', ['S2001', { title: 'x', lineIds: ['science'], promptId: bioP.id }]));
});

test('examples from a student’s moment: only publishable, only reachable, shown only after a yes', () => {
  ev2 = api.addStation('S2002', { title: 'Osmosis in potatoes', lineIds: ['science'], visibility: 'publishable', reflection: 'Salt water made the chips shrink.' });
  api.getStore().reflections.find((r) => r.eventId === ev2.id).visibility = 'publishable';
  const priv = api.addStation('S2002', { title: 'Private one', lineIds: ['science'], visibility: 'advisor' });
  const spec = (eid) => ({ questions: Q, examples: [{ eventId: eid }] });
  assert.throws(() => api.setSubjectPrompts({ classId: 'C-BIO12' }, spec(priv.id), 'T100'), /publishable/);
  assert.ok(!canAct(carter, 'setSubjectPrompts', [{ classId: 'C-CS12' }, spec(ev2.id), 'T101']), 'S2002 is not in his reach');
  assert.ok(canAct(brook, 'setSubjectPrompts', [{ classId: 'C-BIO12' }, spec(ev2.id), 'T100']));
  const n0 = api.getStore().notifications.length;
  api.setSubjectPrompts({ classId: 'C-BIO12' }, spec(ev2.id), 'T100');
  const x = api.getSubjectPrompt(bioP.id).examples[0];
  assert.deepEqual([x.status, x.studentId], ['asked', 'S2002']);
  assert.equal(api.getStore().notifications.length - n0, 1);
  assert.equal(api.getStore().notifications[0].to, 'st:S2002');
  assert.deepEqual(api.getPromptsFor('S2001', 'science').examples, [], 'not shown before the student says yes');
  assert.deepEqual(api.exampleAsksFor('S2002').map((a) => a.exampleId), [x.id]);
  // Only S2002 answers, for themselves.
  assert.ok(canAct(s2, 'answerExampleAsk', [bioP.id, x.id, 'S2002', true]));
  assert.ok(!canAct(s1, 'answerExampleAsk', [bioP.id, x.id, 'S2001', true]) && !canAct(s1, 'answerExampleAsk', [bioP.id, x.id, 'S2002', true]));
  assert.ok(!canAct(brook, 'answerExampleAsk', [bioP.id, x.id, 'S2002', true]) && !canAct({ kind: 'admin' }, 'answerExampleAsk', [bioP.id, x.id, 'S2002', true]));
  api.answerExampleAsk(bioP.id, x.id, 'S2002', true);
  assert.deepEqual(api.getPromptsFor('S2001', 'science').examples.map((e) => [e.title, e.text, e.year]), [['Osmosis in potatoes', 'Salt water made the chips shrink.', 12]]);
  // Rewriting keeps the student's answer.
  api.setSubjectPrompts({ classId: 'C-BIO12' }, { questions: Q, examples: [{ keep: x.id }] }, 'T100');
  assert.equal(api.getSubjectPrompt(bioP.id).examples[0].status, 'yes');
});

test('scope: other students get the example without name or ids; families get none; staff in reach get it whole', () => {
  const mine = scopedSnapshot(s1).store.subjectPrompts.find((p) => p.id === bioP.id);
  assert.deepEqual(mine.examples, [{ id: mine.examples[0].id, status: 'yes', title: 'Osmosis in potatoes', text: 'Salt water made the chips shrink.', year: 12 }]);
  assert.ok(!JSON.stringify(mine).includes('S2002') && !JSON.stringify(mine).includes(ev2.id));
  assert.equal(scopedSnapshot(s2).store.subjectPrompts.find((p) => p.id === bioP.id).examples[0].studentId, 'S2002');
  assert.equal(scopedSnapshot(brook).store.subjectPrompts.find((p) => p.id === bioP.id).examples[0].eventId, ev2.id);
  assert.ok(!JSON.stringify(scopedSnapshot(carter).store.subjectPrompts).includes('S2002'));
  assert.deepEqual(scopedSnapshot({ kind: 'parent', children: ['S2001'] }).store.subjectPrompts, []);
  // Once it is no longer publishable it is not shown to others at all.
  api.getEvent(ev2.id).visibility = 'school';
  assert.deepEqual(scopedSnapshot(s1).store.subjectPrompts.find((p) => p.id === bioP.id).examples, []);
  assert.deepEqual(api.getPromptsFor('S2001', 'science').examples, []);
  api.getEvent(ev2.id).visibility = 'publishable';
  // A "no" hides it too.
  const x = api.getSubjectPrompt(bioP.id).examples[0];
  api.answerExampleAsk(bioP.id, x.id, 'S2002', false);
  assert.deepEqual(scopedSnapshot(s1).store.subjectPrompts.find((p) => p.id === bioP.id).examples, []);
});

test('a student’s own copy of the record works: prompts resolve there as on the server', () => {
  api.answerExampleAsk(bioP.id, api.getSubjectPrompt(bioP.id).examples[0].id, 'S2002', true);
  const before = api.snapshot();
  api.restore(JSON.stringify(scopedSnapshot(s1)));
  const p = api.getPromptsFor('S2001', 'science');
  assert.deepEqual([p.id, p.examples.map((e) => e.title)], [bioP.id, ['Osmosis in potatoes']]);
  api.restore(before);
});

test('clearSubjectPrompts: the class falls back to the line, the line to built-in; only who may write them', () => {
  assert.ok(!canAct(carter, 'clearSubjectPrompts', [bioP.id, 'T101']));
  assert.ok(canAct(brook, 'clearSubjectPrompts', [bioP.id, 'T100']));
  assert.ok(!canAct(brook, 'clearSubjectPrompts', [lineP.id, 'T100']) && canAct(fong, 'clearSubjectPrompts', [lineP.id, 'T104']));
  api.clearSubjectPrompts(bioP.id, 'T100');
  assert.equal(api.getPromptsFor('S2001', 'science').id, lineP.id);
  api.clearSubjectPrompts(lineP.id, 'T104');
  assert.equal(api.getPromptsFor('S2001', 'science').source, 'default');
  assert.equal(api.promptUses(bioP.id), 1, 'moments keep their promptId');
  assert.throws(() => api.clearSubjectPrompts('sp-nope'), /No such/);
});
