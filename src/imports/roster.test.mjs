// node --test src/imports
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRoster, planRoster, lineForClass, kindOfRoles, academicStart } from './roster.js';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/roster/${f}`, import.meta.url), 'utf8');
const json = () => JSON.parse(fx('roster.json'));
const csvFiles = () => ['teachers.csv', 'students.csv', 'classes.csv', 'enrolments.csv'].map((name) => ({ name, text: fx(name) }));
const empty = { students: [], teachers: [], classes: [], enrolments: [] };

test('Roster: the JSON fixture reads cleanly', () => {
  const { roster, errors } = parseRoster(fx('roster.json'));
  assert.deepEqual(errors, []);
  assert.equal(roster.teachers.length, 6);
  assert.deepEqual(roster.teachers[0].roles, ['teacher', 'advisor']);
  assert.equal(roster.students[1].programme, 'IB Diploma', 'DP is read as IB Diploma');
  assert.equal(roster.students[2].programme, 'IB MYP');
  assert.equal(roster.students[2].email, null);
  assert.equal(roster.enrolments.length, 7);
});

test('Roster: the four CSVs give the same roster as the JSON', () => {
  const a = parseRoster(fx('roster.json')).roster, b = parseRoster(csvFiles());
  assert.deepEqual(b.errors, []);
  for (const k of ['teachers', 'students', 'classes', 'enrolments']) assert.deepEqual(b.roster[k], a[k], k);
});

test('Roster: CSVs by part name, and a missing part', () => {
  const parts = Object.fromEntries(csvFiles().map((f) => [f.name.replace('.csv', ''), f.text]));
  assert.deepEqual(parseRoster(parts).errors, []);
  delete parts.enrolments;
  assert.match(parseRoster(parts).errors[0], /enrolments\.csv/);
});

test('Roster: a wrong format or broken file stops at once', () => {
  assert.match(parseRoster('not json').errors[0], /not a JSON file/);
  assert.match(parseRoster(JSON.stringify({ format: 'other/2' })).errors[0], /format should be/);
});

test('Roster: every referenced id must exist, and the missing ones are listed', () => {
  const r = json();
  r.students[0].advisorId = 'T999';
  r.classes[0].teacherIds.push('T998');
  r.enrolments.push({ studentId: 'S9999', classId: 'C-NONE' });
  const out = parseRoster(r);
  assert.equal(out.roster, null);
  assert.deepEqual(out.missing, { teachers: ['T999', 'T998'], students: ['S9999'], classes: ['C-NONE'] });
  assert.ok(out.errors.some((e) => /advisor T999/.test(e)));
});

test('Roster: required fields, years, roles, lines, duplicate ids and emails', () => {
  const r = json();
  r.students[0].year = 14; delete r.students[1].homeroom;
  r.teachers[1].roles = ['teacher', 'janitor'];
  r.classes[0].line = 'maths';
  r.classes.push({ ...r.classes[1] });
  r.students[2].email = 'ada.brook@example.org';
  const { errors } = parseRoster(r);
  for (const re of [/year should be 7 to 13/, /missing homeroom/, /unknown role janitor/, /unknown line/, /C-CS12 appears twice/, /ada\.brook@example\.org is used by both/]) assert.ok(errors.some((e) => re.test(e)), String(re));
});

test('Roster: CSV errors name the file and row', () => {
  const files = csvFiles(); files[1].text = files[1].text.replace('S2002,Gus Hale,12', 'S2002,Gus Hale,15');
  assert.ok(parseRoster(files).errors.some((e) => e.startsWith('students.csv row 3 (S2002)')));
});

test('Lines: from the class, else guessed from the subject', () => {
  const g = (subject, name = '', line) => lineForClass({ subject, name, line });
  assert.equal(g('Biology'), 'science'); assert.equal(g('Chemistry'), 'science'); assert.equal(g('Physics'), 'science');
  assert.equal(g('Computer Science'), 'computing'); assert.equal(g('Environmental Systems and Societies'), 'environment'); assert.equal(g('ESS'), 'environment');
  assert.equal(g('Geography'), 'environment'); assert.equal(g('PE'), 'sport'); assert.equal(g('Physical and Health Education'), 'sport');
  assert.equal(g('Music'), 'music'); assert.equal(g('Design'), 'design'); assert.equal(g('Visual Arts'), 'art');
  for (const l of ['English A: Language and Literature', 'English B', 'French', 'Spanish ab initio', 'Thai', 'Chinese']) assert.equal(g(l), 'languages', l);
  assert.equal(g('Business Management'), null, 'ess inside a word is not ESS');
  assert.equal(g('Mathematics'), null);
  assert.equal(g('Robotics', '', 'computing'), 'computing');
  assert.equal(g('Biology', '', 'art'), 'art', 'the class line wins');
});

test('Plan: a first import adds everything and builds the records', () => {
  const { roster } = parseRoster(fx('roster.json'));
  const { writes, summary } = planRoster(roster, empty, { today: '2026-10-26' });
  assert.deepEqual(summary.added, { teachers: 6, students: 3, classes: 5, enrolments: 7 });
  assert.deepEqual(summary.updated, { teachers: 0, students: 0, classes: 0, enrolments: 0 });
  assert.deepEqual(summary.unmatchedClasses.map((c) => c.id), ['C-MAT12']);
  const fern = writes.students.find((w) => w.id === 'S2001').rec;
  assert.equal(fern.grade, 11); assert.equal(fern.g9StartYear, 2024); assert.equal(fern.startGrade, 6, 'joined in 2021 → map starts at Year 7');
  assert.equal(fern.advisorId, 'T100'); assert.equal(fern.homeroom, '12B'); assert.equal(fern.onboarding, true);
  const gus = writes.students.find((w) => w.id === 'S2002').rec;
  assert.equal(gus.startGrade, 11, 'no joinedYear → map starts this Year');
  const hana = writes.students.find((w) => w.id === 'S2003').rec;
  assert.equal(hana.startGrade, 6); assert.equal(hana.g9StartYear, 2028);
  const ada = writes.teachers.find((w) => w.id === 'T100').rec;
  assert.equal(ada.role, 'Biology · Advisor, 12B'); assert.deepEqual(ada.roles, ['teacher', 'advisor']); assert.equal(ada.department, 'Biology');
  assert.equal(writes.teachers.find((w) => w.id === 'T102').rec.role, 'University counsellor');
  assert.deepEqual(writes.classes.find((w) => w.id === 'C-BIO12').rec, { id: 'C-BIO12', name: '12 Biology HL', subject: 'Biology', year: 12, level: 'HL', teacherIds: ['T100'], lineId: 'science' });
});

// Applies a plan the way api.js importRoster does.
function apply(cur, writes) {
  const up = (list, w) => { const o = list.find((x) => x.id === w.id); if (o) Object.assign(o, w.rec); else list.push(structuredClone(w.rec)); };
  writes.teachers.forEach((w) => up(cur.teachers, w)); writes.students.forEach((w) => up(cur.students, w)); writes.classes.forEach((w) => up(cur.classes, w));
  const pair = (a, b) => a.studentId === b.studentId && a.classId === b.classId;
  writes.enrolments.forEach(({ rec }) => { const o = cur.enrolments.find((e) => pair(e, rec)); if (o) Object.assign(o, rec); else cur.enrolments.push({ ...rec }); });
  writes.endEnrolments.forEach((x) => { cur.enrolments.find((e) => pair(e, x)).to = x.to; });
}

test('Plan: re-importing updates, never duplicates, and lists who is missing', () => {
  const cur = structuredClone(empty);
  apply(cur, planRoster(parseRoster(fx('roster.json')).roster, cur).writes);
  cur.students[0].laneOrder = ['science']; // the student's own map choices
  const again = planRoster(parseRoster(fx('roster.json')).roster, cur);
  assert.deepEqual(again.summary.added, { teachers: 0, students: 0, classes: 0, enrolments: 0 });
  assert.deepEqual(again.summary.updated, { teachers: 0, students: 0, classes: 0, enrolments: 0 });

  const r = json();
  r.students = r.students.filter((s) => s.id !== 'S2002');
  r.enrolments = r.enrolments.filter((e) => e.studentId !== 'S2002' && !(e.studentId === 'S2001' && e.classId === 'C-CS12'));
  r.students[0].homeroom = '12C';
  const next = planRoster(parseRoster(r).roster, cur);
  assert.equal(next.summary.updated.students, 1);
  assert.deepEqual(next.summary.missingFromFile.students, [{ id: 'S2002', name: 'Gus Hale' }]);
  assert.equal(next.summary.ended.enrolments, 1, 'Fern left Computer Science');
  apply(cur, next.writes);
  assert.equal(cur.students.length, 3, 'nobody is removed');
  assert.deepEqual(cur.students[0].laneOrder, ['science'], 'the map stays');
  assert.equal(cur.students[0].homeroom, '12C');
  assert.equal(cur.enrolments.find((e) => e.studentId === 'S2001' && e.classId === 'C-CS12').to, '2026-10-20');
  assert.equal(cur.enrolments.filter((e) => e.studentId === 'S2002').every((e) => !e.to), true, 'missing people keep their enrolments');
  assert.equal(cur.teachers.find((t) => t.id === 'T100').role, 'Biology · Advisor, 12C');
});

test('Staff kind and school year', () => {
  assert.equal(kindOfRoles(['teacher', 'advisor']), 'advisor');
  assert.equal(kindOfRoles(['teacher', 'leadership', 'counsellor']), 'leadership');
  assert.equal(kindOfRoles(['coordinator', 'counsellor']), 'coordinator');
  assert.equal(kindOfRoles([]), 'teacher');
  assert.equal(academicStart('2026-27'), 2026);
  assert.equal(academicStart(null, '2027-03-01'), 2026);
  assert.equal(academicStart(null, '2026-10-26'), 2026);
});
