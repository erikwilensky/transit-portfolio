// node --test src/imports
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseImport, detectFormat, templateCsv, FORMATS } from './index.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (n) => ({ name: n.split('/').pop(), text: fs.readFileSync(here(`./fixtures/${n}`), 'utf8') });
const students = JSON.parse(fs.readFileSync(here('../../data/students.json'), 'utf8'));
const lines = JSON.parse(fs.readFileSync(here('../../data/lines.json'), 'utf8'));
const staff = { students, lines, today: '2026-10-26', by: { name: 'Ms Clara Brandt', teacherId: 't-08' } };
const SHAPE = ['id', 'studentId', 'title', 'date', 'lineIds', 'suggestedLineIds', 'type', 'summary', 'evidence', 'verification', 'source', 'sourceId'];
const byTitle = (r, t) => r.items.find((i) => i.label.includes(t));

function checkShape(c) {
  for (const k of SHAPE) assert.ok(k in c, `candidate has ${k}`);
  assert.deepEqual(c.lineIds, []);
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(c.source.system && c.source.ref);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(c)));
}

test('detects each fixture’s format', () => {
  assert.equal(detectFormat('x.csv', read('managebac-cas.csv').text), 'mb-cas');
  assert.equal(detectFormat('x.csv', read('managebac-tasks.csv').text), 'mb-tasks');
  assert.equal(detectFormat('x.csv', read('classroom-grades.csv').text), 'gc-grades');
  assert.equal(detectFormat('x.csv', read('generic.csv').text), 'generic');
  assert.equal(detectFormat('fixtures.ics', ''), 'ics');
  assert.equal(detectFormat('a.json', '{}'), 'gc-takeout');
  assert.equal(FORMATS.filter((f) => f.student).map((f) => f.id).join(), 'generic,ics');
});

test('ManageBac CAS: real export headings, messy cells, reflections merged, problems reported', () => {
  const r = parseImport('mb-cas', [read('managebac-cas.csv')], staff);
  assert.deepEqual(r.problems, []);
  r.candidates.forEach(checkShape);
  const beach = byTitle(r, 'Beach Guardians');
  assert.equal(beach.studentId, 'st-01');
  assert.equal(beach.candidate.title, 'CAS: Beach Guardians clean-up, Bang Saen');
  assert.equal(beach.candidate.date, '2026-09-14');
  assert.equal(beach.candidate.verification, 'school-verified');
  assert.equal(beach.candidate.sourceId, 'cas');
  assert.deepEqual(beach.candidate.cas, { strand: 'S', outcomes: [2, 6] });
  assert.deepEqual(beach.candidate.suggestedLineIds, ['service']);
  assert.match(beach.candidate.quickReflection, /40 bags[\s\S]*Second reflection/);
  assert.equal(r.items.filter((i) => i.label.includes('Beach')).length, 1, 'two rows for one experience become one item');
  const lena = byTitle(r, 'Ceramics');
  assert.equal(lena.candidate.title, 'CAS: Ceramics for the "Hands" charity sale');
  assert.equal(lena.candidate.date, '2026-10-02', 'Buddhist Era year read');
  assert.deepEqual(lena.candidate.suggestedLineIds, ['lena-ceramics']);
  assert.match(byTitle(r, 'Thai dance').problem, /No student found for ปิ่น ชัยพร/);
  assert.match(byTitle(r, 'squad').candidate.quickReflection, /squad\nafter/);
  assert.match(byTitle(r, 'Old project').problem, /Rejected/);
  assert.match(byTitle(r, 'Undated').problem, /Cannot read the date/);
  assert.deepEqual(r.counts, { rows: 7, ready: 4, problems: 3, students: 4 });
});

test('ManageBac CAS: a Thai name matches when the record has it', () => {
  const withThai = students.map((s) => (s.id === 'st-09' ? { ...s, nameTh: 'ปิ่น ชัยพร' } : s));
  const r = parseImport('mb-cas', [read('managebac-cas.csv')], { ...staff, students: withThai });
  assert.equal(byTitle(r, 'Thai dance').studentId, 'st-09');
});

test('ManageBac CAS: missing headings are explained, not guessed', () => {
  const r = parseImport('mb-cas', [{ name: 'x.csv', text: 'Foo,Bar\n1,2\n' }], staff);
  assert.equal(r.candidates.length, 0);
  assert.match(r.problems.join(' '), /No experience column/);
});

test('ManageBac tasks: one row per task, grades as evidence, Missing skipped', () => {
  const r = parseImport('mb-tasks', [read('managebac-tasks.csv')], staff);
  r.candidates.forEach(checkShape);
  const ia = byTitle(r, 'Internal assessment');
  assert.equal(ia.candidate.type, 'assessment');
  assert.deepEqual(ia.candidate.evidence[0], { kind: 'grade', url: null, caption: 'Internal assessment: draft: 6/8' });
  assert.equal(ia.candidate.sourceId, 'lms');
  assert.match(byTitle(r, 'Paper 1').problem, /Missing/);
  assert.equal(byTitle(r, 'Design cycle').candidate.date, '2026-10-09');
  assert.match(r.items.find((i) => i.problem?.includes('st-99')).problem, /No student found/);
});

test('ManageBac tasks: the gradebook grid layout works too', () => {
  const text = 'Student ID,Student Name,Unit 1 test (03/10/2026),Unit 2 test\nst-01,Maya Chen,7,\nst-02,Arun Mehta,5,6\n';
  const r = parseImport('mb-tasks', [{ name: 'grid.csv', text }], staff);
  assert.equal(r.candidates.length, 3);
  const u1 = r.items.find((i) => i.studentId === 'st-01');
  assert.equal(u1.candidate.title, 'Unit 1 test');
  assert.equal(u1.candidate.date, '2026-10-03');
  assert.deepEqual(r.items.find((i) => i.label === 'Unit 2 test').warnings, ['No date in the file: dated today']);
});

test('Google Classroom grades CSV: date and points rows, class average ignored', () => {
  const r = parseImport('gc-grades', [read('classroom-grades.csv')], staff);
  r.candidates.forEach(checkShape);
  assert.equal(r.candidates.length, 3);
  const lab = r.items.find((i) => i.label === 'Lab report: enzymes');
  assert.equal(lab.studentId, 'st-01');
  assert.equal(lab.matchedBy, 'email');
  assert.equal(lab.candidate.date, '2026-10-12');
  assert.equal(lab.candidate.evidence[0].caption, 'Lab report: enzymes: 18/20');
  assert.equal(r.items.filter((i) => i.problem).length, 1);
  assert.ok(!r.items.some((i) => /average/i.test(i.label)));
});

test('Google Classroom Takeout: coursework and submissions across files', () => {
  const r = parseImport('gc-takeout', [read('takeout/Grade 10 Biology.json'), read('takeout/submissions.json')], staff);
  r.candidates.forEach(checkShape);
  const draw = r.items.find((i) => i.label === 'Microscope drawing' && i.candidate);
  assert.equal(draw.studentId, 'st-03');
  assert.equal(draw.candidate.date, '2026-10-09');
  assert.equal(draw.candidate.sourceId, 'classroom');
  assert.match(draw.candidate.summary, /Grade 10 Biology.*mark 9\/10/);
  assert.equal(draw.candidate.evidence[1].url, 'https://classroom.google.com/c/x/a/cw1');
  assert.match(r.items.find((i) => i.label === 'Cell quiz' && i.candidate).candidate.summary, /late/);
  assert.match(r.items.find((i) => i.problem?.includes('somchai')).problem, /No student found/);
  assert.equal(parseImport('gc-takeout', [{ name: 'bad.json', text: '{nope' }], staff).problems.length, 2);
});

test('Generic CSV from staff: teacher-endorsed with the endorsement attached', () => {
  const r = parseImport('generic', [read('generic.csv')], staff);
  r.candidates.forEach(checkShape);
  const gala = byTitle(r, 'Swimming gala');
  assert.equal(gala.candidate.verification, 'teacher-endorsed');
  assert.equal(gala.candidate.classEndorsement.teacherId, 't-08');
  assert.deepEqual(gala.candidate.suggestedLineIds, ['maya-swim']);
  assert.equal(gala.candidate.evidence[0].url, 'https://example.org/gala');
  const reading = byTitle(r, 'Reading buddies');
  assert.equal(reading.candidate.evidence.length, 0);
  assert.match(reading.warnings[0], /not a web address/);
  assert.equal(byTitle(r, 'No date').problem, 'No date');
  assert.match(byTitle(r, 'Somebody').problem, /stranger@example.com/);
});

test('Generic CSV from a student: always student-added, other people’s rows refused', () => {
  const r = parseImport('generic', [read('generic.csv')], { students, lines, today: '2026-10-26', selfId: 'st-01' });
  assert.equal(r.sourceId, 'mine');
  for (const c of r.candidates) { assert.equal(c.verification, 'student-added'); assert.equal(c.studentId, 'st-01'); assert.ok(!c.classEndorsement); }
  assert.match(byTitle(r, 'Reading buddies').problem, /someone else/);
  const own = parseImport('generic', [{ name: 'mine.csv', text: 'title,date\nMy robot,2026-10-01\n' }], { students, lines, today: '2026-10-26', selfId: 'st-01' });
  assert.equal(own.candidates.length, 1);
  assert.deepEqual(own.candidates[0].suggestedLineIds, ['computing']);
});

test('Generic template parses back to its own example rows', () => {
  const r = parseImport('generic', [{ name: 'template.csv', text: templateCsv() }], staff);
  assert.equal(r.candidates.length, 2);
  assert.equal(r.candidates[1].date, '2026-10-12');
});

test('.ics: attendees, chosen students, folded lines, UTC to Bangkok, cancelled and alarms', () => {
  const none = parseImport('ics', [read('fixtures.ics')], staff);
  assert.match(byTitle(none, 'U14').problem, /choose students/);
  const r = parseImport('ics', [read('fixtures.ics')], { ...staff, forStudentIds: ['st-02', 'st-04'] });
  r.candidates.forEach(checkShape);
  const gala = r.items.find((i) => i.label.startsWith('Swimming') && i.candidate);
  assert.equal(gala.studentId, 'st-01');
  assert.equal(gala.candidate.date, '2026-10-20');
  assert.equal(gala.candidate.verification, 'school-verified');
  assert.deepEqual(gala.candidate.suggestedLineIds, ['maya-swim']);
  const football = r.items.filter((i) => i.label === 'U14 Football vs ISB' && i.candidate);
  assert.deepEqual(football.map((i) => i.studentId), ['st-02', 'st-04']);
  assert.equal(football[0].candidate.verification, 'teacher-endorsed');
  assert.match(football[0].candidate.summary, /NIST Field, Sukhumvit/);
  assert.deepEqual(football[1].candidate.suggestedLineIds, ['sport']);
  assert.ok(r.items.some((i) => i.label === 'Winter concert rehearsal with the school orchestra'));
  assert.equal(byTitle(r, 'Cancelled').problem, 'Cancelled in the calendar');
});

test('Same file twice gives the same ids, so a second import can be skipped', () => {
  const a = parseImport('mb-cas', [read('managebac-cas.csv')], staff).candidates.map((c) => c.id);
  const b = parseImport('mb-cas', [read('managebac-cas.csv')], staff).candidates.map((c) => c.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
});
