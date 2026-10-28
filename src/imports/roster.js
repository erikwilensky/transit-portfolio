// The school's class lists: one "transit-roster/1" JSON file, or teachers/students/classes/enrolments CSVs
// (same column names, list cells split by ';'). See docs/roster-format.md.
// Pure: no DOM, no Node APIs, no store. parseRoster reads and checks a file; planRoster compares it with the
// record and builds the records api.js importRoster() writes.
import { parseCsv } from './csv.js';
import { parseDate } from './common.js';

export const ROSTER_FORMAT = 'transit-roster/1';
export const ROLES = ['teacher', 'advisor', 'counsellor', 'coordinator', 'leadership'];
export const LINES = ['science', 'computing', 'environment', 'sport', 'service', 'music', 'design', 'languages', 'art'];
export const PARTS = ['teachers', 'students', 'classes', 'enrolments'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Reading ──
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const list = (v) => (Array.isArray(v) ? v : str(v).split(';')).map(str).filter(Boolean);
const yearOf = (v) => { const m = str(v).match(/^(?:year|yr|y)?\s*(\d{1,2})$/i); return m ? Number(m[1]) : NaN; };
const PROG = [[/^(ib\s*)?(dp|diploma)/i, 'IB Diploma'], [/^(ib\s*)?myp|middle years/i, 'IB MYP'], [/^(ib\s*)?(cp|crp|career)/i, 'IB Career-related']];
const programmeOf = (v) => { const s = str(v); return PROG.find(([re]) => re.test(s))?.[1] || s; };

// CSV text → objects keyed by the header row (column names as in the JSON, any case).
function csvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const keys = rows[0].map((h) => h.replace(/\s+/g, ''));
  return rows.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}
// Column names are matched without case, so "StudentId" and "studentid" both work.
const pick = (o, k) => { if (k in o) return o[k]; const f = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()); return f ? o[f] : undefined; };
const partOf = (name) => { const n = str(name).toLowerCase(); return PARTS.find((p) => n.includes(p.slice(0, -1))) || (n.includes('enrollment') ? 'enrolments' : null); };

// Accepts: JSON text; the parsed JSON object; { teachers, students, classes, enrolments } CSV texts;
// or files as [{ name, text }] (one .json, or the four CSVs, named after their part).
// Returns { roster, errors, warnings, missing }. roster is null when there are errors.
export function parseRoster(input) {
  const errors = [], warnings = [];
  let raw;
  if (Array.isArray(input)) {
    const json = input.find((f) => /\.json$/i.test(f.name) || /^\s*\{/.test(f.text || ''));
    if (json) return parseRoster(json.text);
    const parts = {};
    for (const f of input) { const p = partOf(f.name); if (p) parts[p] = f.text; else warnings.push(`${f.name}: not one of teachers.csv, students.csv, classes.csv, enrolments.csv; left out.`); }
    return withWarnings(parseRoster(parts), warnings);
  }
  if (typeof input === 'string') {
    try { raw = JSON.parse(input.replace(/^﻿/, '')); } catch { return fail('This is not a JSON file. Pick the roster .json, or the four CSV files.'); }
  } else if (input && typeof input === 'object' && PARTS.some((p) => typeof input[p] === 'string')) {
    const missingParts = PARTS.filter((p) => typeof input[p] !== 'string');
    if (missingParts.length) return fail(`Missing ${missingParts.map((p) => `${p}.csv`).join(', ')}. Pick all four CSV files together.`);
    raw = { format: ROSTER_FORMAT, school: { source: 'csv' }, ...Object.fromEntries(PARTS.map((p) => [p, csvObjects(input[p])])) };
  } else raw = input;
  if (!raw || typeof raw !== 'object') return fail('The file is empty.');
  if (raw.format !== ROSTER_FORMAT) return fail(`Not a roster file: format should be "${ROSTER_FORMAT}"${raw.format ? `, not "${raw.format}"` : ''}.`);
  for (const p of PARTS) if (!Array.isArray(raw[p])) errors.push(`The file has no ${p} list.`);
  if (errors.length) return { roster: null, errors, warnings, missing: {} };
  return validateRoster(raw, warnings);
}
const fail = (msg) => ({ roster: null, errors: [msg], warnings: [], missing: {} });
const withWarnings = (r, w) => ({ ...r, warnings: [...w, ...r.warnings] });

// Checks every row and every reference. Rows are numbered as in the file (CSV: header is row 1).
function validateRoster(raw, warnings = []) {
  const errors = [];
  const csv = raw.school?.source === 'csv';
  const where = (part, i, id) => `${csv ? `${part}.csv row ${i + 2}` : `${part}[${i}]`}${id ? ` (${id})` : ''}`;
  const need = (part, i, o, fields) => { const gone = fields.filter((f) => !str(pick(o, f))); if (gone.length) errors.push(`${where(part, i, str(pick(o, 'id')))}: missing ${gone.join(', ')}.`); return !gone.length; };
  const dupes = (part, items) => { const seen = new Set(); items.forEach((x, i) => { if (!x.id) return; if (seen.has(x.id)) errors.push(`${where(part, i, x.id)}: the id ${x.id} appears twice.`); seen.add(x.id); }); };
  const email = (part, i, id, v) => { const e = str(v).toLowerCase(); if (e && !EMAIL.test(e)) { warnings.push(`${where(part, i, id)}: “${v}” is not an email address; left out.`); return null; } return e || null; };

  const teachers = raw.teachers.map((o, i) => {
    need('teachers', i, o, ['id', 'name']);
    const id = str(pick(o, 'id'));
    let roles = list(pick(o, 'roles')).map((r) => r.toLowerCase());
    const bad = roles.filter((r) => !ROLES.includes(r));
    if (bad.length) errors.push(`${where('teachers', i, id)}: unknown role ${bad.join(', ')} (use ${ROLES.join(', ')}).`);
    if (!roles.length) { roles = ['teacher']; warnings.push(`${where('teachers', i, id)}: no roles; counted as a teacher.`); }
    return { id, name: str(pick(o, 'name')), email: email('teachers', i, id, pick(o, 'email')), roles: [...new Set(roles)], department: str(pick(o, 'department')) || null };
  });
  const students = raw.students.map((o, i) => {
    need('students', i, o, ['id', 'name', 'year', 'programme', 'homeroom', 'advisorId']);
    const id = str(pick(o, 'id'));
    const year = yearOf(pick(o, 'year'));
    if (str(pick(o, 'year')) && !(year >= 7 && year <= 13)) errors.push(`${where('students', i, id)}: year should be 7 to 13, not “${str(pick(o, 'year'))}”.`);
    const j = str(pick(o, 'joinedYear')); const joinedYear = j ? Number(j) : null;
    if (j && !(joinedYear >= 1990 && joinedYear <= 2100)) warnings.push(`${where('students', i, id)}: joinedYear “${j}” is not a year; left out.`);
    return { id, name: str(pick(o, 'name')), year, programme: programmeOf(pick(o, 'programme')), homeroom: str(pick(o, 'homeroom')), advisorId: str(pick(o, 'advisorId')),
      joinedYear: joinedYear >= 1990 && joinedYear <= 2100 ? joinedYear : null, email: email('students', i, id, pick(o, 'email')), house: str(pick(o, 'house')) || null };
  });
  const classes = raw.classes.map((o, i) => {
    need('classes', i, o, ['id', 'name', 'subject', 'year']);
    const id = str(pick(o, 'id'));
    const year = yearOf(pick(o, 'year'));
    if (str(pick(o, 'year')) && !(year >= 7 && year <= 13)) errors.push(`${where('classes', i, id)}: year should be 7 to 13, not “${str(pick(o, 'year'))}”.`);
    const line = str(pick(o, 'line')).toLowerCase() || null;
    if (line && !LINES.includes(line)) errors.push(`${where('classes', i, id)}: unknown line “${line}” (use ${LINES.join(', ')}).`);
    const teacherIds = list(pick(o, 'teacherIds'));
    if (!teacherIds.length) warnings.push(`${where('classes', i, id)}: no teachers.`);
    return { id, name: str(pick(o, 'name')), subject: str(pick(o, 'subject')), year, level: str(pick(o, 'level')) || null, teacherIds, line };
  });
  const seenPair = new Set();
  const enrolments = raw.enrolments.map((o, i) => {
    need('enrolments', i, o, ['studentId', 'classId']);
    const d = (k) => { const v = str(pick(o, k)); if (!v) return null; const p = parseDate(v); if (!p) errors.push(`${where('enrolments', i)}: ${k} “${v}” is not a date.`); return p; };
    return { studentId: str(pick(o, 'studentId')), classId: str(pick(o, 'classId')), from: d('from'), to: d('to') };
  }).filter((e) => { const k = `${e.studentId}|${e.classId}`; if (seenPair.has(k)) { warnings.push(`Enrolment of ${e.studentId} in ${e.classId} appears twice; kept once.`); return false; } seenPair.add(k); return true; });

  dupes('teachers', teachers); dupes('students', students); dupes('classes', classes);
  const emails = new Map();
  for (const p of [...teachers, ...students]) if (p.email) { if (emails.has(p.email)) errors.push(`${p.email} is used by both ${emails.get(p.email)} and ${p.id}.`); else emails.set(p.email, p.id); }

  // Every referenced id must exist. The import stops and lists the missing ones.
  const tIds = new Set(teachers.map((t) => t.id)), sIds = new Set(students.map((s) => s.id)), cIds = new Set(classes.map((c) => c.id));
  const missing = { teachers: new Set(), students: new Set(), classes: new Set() };
  const ref = (kind, ids, id, msg) => { if (id && !ids.has(id)) { missing[kind].add(id); errors.push(msg); } };
  students.forEach((s, i) => ref('teachers', tIds, s.advisorId, `${where('students', i, s.id)}: advisor ${s.advisorId} is not in teachers.`));
  classes.forEach((c, i) => c.teacherIds.forEach((t) => ref('teachers', tIds, t, `${where('classes', i, c.id)}: teacher ${t} is not in teachers.`)));
  enrolments.forEach((e, i) => { ref('students', sIds, e.studentId, `${where('enrolments', i)}: student ${e.studentId} is not in students.`); ref('classes', cIds, e.classId, `${where('enrolments', i)}: class ${e.classId} is not in classes.`); });

  const out = Object.fromEntries(Object.entries(missing).filter(([, v]) => v.size).map(([k, v]) => [k, [...v]]));
  if (!csv) for (const k of ['name', 'academicYear', 'exportedAt']) if (!str(raw.school?.[k])) warnings.push(`The school block has no ${k}.`);
  const school = { name: str(raw.school?.name), academicYear: str(raw.school?.academicYear) || null, exportedAt: str(raw.school?.exportedAt) || null, source: str(raw.school?.source) || null };
  if (errors.length) return { roster: null, errors, warnings, missing: out };
  return { roster: { format: ROSTER_FORMAT, school, teachers, students, classes, enrolments }, errors, warnings, missing: out };
}

// ── Classes → lines ──
// The class's own `line` wins; then the line a coordinator chose for its subject (subjectLines, null = leave
// it off the map; api.setSubjectLine); otherwise a guess from the subject, then the class name.
const GUESS = [
  ['computing', /\b(computer|computing|ict|digital|programming)\b/],
  ['science', /\b(biology|chemistry|physics|science|sciences|sehs)\b/],
  ['environment', /\b(ess|environment|environmental|geography)\b/],
  ['sport', /\b(pe|phe|physical|sport|sports|athletics|swimming)\b/],
  ['music', /\b(music)\b/],
  ['design', /\b(design|dt)\b/],
  ['languages', /\b(english|french|spanish|thai|chinese|mandarin|japanese|german|korean|language|languages|literature|lang)\b/],
  ['art', /\b(art|arts|theatre|drama|film|dance)\b/],
  ['service', /\b(service)\b/],
];
export function lineForClass(c, lineIds = LINES, subjectLines = {}) {
  if (c.line && lineIds.includes(c.line)) return c.line;
  if (Object.hasOwn(subjectLines, str(c.subject))) { const l = subjectLines[str(c.subject)]; return l && lineIds.includes(l) ? l : null; }
  for (const text of [c.subject, c.name]) {
    const t = str(text).toLowerCase();
    const hit = GUESS.find(([id, re]) => lineIds.includes(id) && re.test(t));
    if (hit) return hit[0];
  }
  return null;
}

// ── Comparing with the record ──
// "2026-27" or "2026/2027" → 2026. Without one, the school year that holds `today` (it starts in August).
export const academicStart = (ay, today) => { const m = str(ay).match(/(\d{4})/); if (m) return Number(m[1]); const [y, mo] = String(today).split('-').map(Number); return mo >= 8 ? y : y - 1; };
const COLOURS = ['#4F529B', '#008A60', '#E73C3E', '#FF8F1C', '#002855', '#FFB81C', '#78D5E1'];
export const initialsOf = (name) => name.replace(/^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const ROLE_WORD = { counsellor: 'University counsellor', coordinator: 'Coordinator', leadership: 'Leadership', teacher: 'Teacher' };
// The staff kind an account gets: the most senior role wins. The one place to change who gets which access
// (coordinator and leadership see the whole school).
export const kindOfRoles = (roles = []) => ['leadership', 'coordinator', 'counsellor', 'advisor', 'teacher'].find((r) => roles.includes(r)) || 'teacher';
// The display line under a teacher's name: "Biology · Advisor, 12B".
function roleText(t, advisees) {
  const parts = [];
  if (t.department) parts.push(t.department);
  if (t.roles.includes('advisor')) { const hrs = [...new Set(advisees.map((s) => s.homeroom).filter(Boolean))].sort(); parts.push(hrs.length ? `Advisor, ${hrs.join(', ')}` : 'Advisor'); }
  for (const r of ['counsellor', 'coordinator', 'leadership']) if (t.roles.includes(r)) parts.push(ROLE_WORD[r]);
  return parts.join(' · ') || 'Teacher';
}
const same = (a, b, keys) => keys.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
const T_KEYS = ['name', 'email', 'roles', 'department', 'role'];
const S_KEYS = ['name', 'grade', 'programme', 'homeroom', 'advisorId', 'email', 'house', 'joinedYear'];
const C_KEYS = ['name', 'subject', 'year', 'level', 'teacherIds', 'lineId'];

// What an import would do to the record, without changing it. current = { students, teachers, classes, enrolments }.
// Returns the writes (each { op: 'add' | 'update', id, rec } with only the fields the roster owns on an update)
// and the summary { added, updated, ended, unmatchedClasses, missingFromFile }.
export function planRoster(roster, current, { lineIds = LINES, today = '2026-10-26', subjectLines = {} } = {}) {
  const start = academicStart(roster.school?.academicYear, today);
  const endDate = parseDate(roster.school?.exportedAt) || today;
  const byId = (xs) => new Map((xs || []).map((x) => [x.id, x]));
  const curT = byId(current.teachers), curS = byId(current.students), curC = byId(current.classes);
  const count = () => ({ teachers: 0, students: 0, classes: 0, enrolments: 0 });
  const added = count(), updated = count();
  const writes = { teachers: [], students: [], classes: [], enrolments: [], endEnrolments: [] };
  const put = (kind, cur, id, rec, keys, fresh) => {
    const old = cur.get(id);
    if (!old) { added[kind]++; writes[kind].push({ op: 'add', id, rec: { ...fresh(), ...rec } }); }
    else if (!same(old, rec, keys)) { updated[kind]++; writes[kind].push({ op: 'update', id, rec }); }
  };
  for (const t of roster.teachers) {
    const rec = { name: t.name, email: t.email, roles: t.roles, department: t.department, role: roleText(t, roster.students.filter((s) => s.advisorId === t.id)) };
    put('teachers', curT, t.id, rec, T_KEYS, () => ({ id: t.id, pilot: true }));
  }
  let n = (current.students || []).length;
  for (const s of roster.students) {
    const grade = s.year - 1;
    const rec = { name: s.name, grade, programme: s.programme, homeroom: s.homeroom, advisorId: s.advisorId, email: s.email, house: s.house, joinedYear: s.joinedYear };
    put('students', curS, s.id, rec, S_KEYS, () => {
      // The map starts in the Year they joined (when known and later than Year 7), else this Year.
      const startGrade = s.joinedYear ? Math.min(grade, Math.max(6, grade - (start - s.joinedYear))) : grade;
      return { id: s.id, startGrade, g9StartYear: start - (grade - 9), avatar: { initials: initialsOf(s.name), colour: COLOURS[n++ % COLOURS.length] }, laneOrder: [], lineLabels: {}, onboarding: true, pilot: true };
    });
  }
  const unmatchedClasses = [];
  for (const c of roster.classes) {
    const lineId = lineForClass(c, lineIds, subjectLines);
    if (!lineId) unmatchedClasses.push({ id: c.id, name: c.name, subject: c.subject });
    put('classes', curC, c.id, { name: c.name, subject: c.subject, year: c.year, level: c.level, teacherIds: c.teacherIds, lineId }, C_KEYS, () => ({ id: c.id }));
  }
  const key = (e) => `${e.studentId}|${e.classId}`;
  const curE = new Map((current.enrolments || []).map((e) => [key(e), e]));
  for (const e of roster.enrolments) {
    const old = curE.get(key(e)); const rec = { studentId: e.studentId, classId: e.classId, from: e.from, to: e.to };
    if (!old) { added.enrolments++; writes.enrolments.push({ op: 'add', rec }); }
    else if (!same(old, rec, ['from', 'to'])) { updated.enrolments++; writes.enrolments.push({ op: 'update', rec }); }
  }
  // A class list a student has left: the enrolment ends on the export date (kept as history), only for
  // students in this file. Enrolments of people missing from the file are left as they are.
  const inFile = new Set(roster.students.map((s) => s.id)), pairs = new Set(roster.enrolments.map(key));
  for (const e of current.enrolments || []) if (inFile.has(e.studentId) && !pairs.has(key(e)) && !e.to) writes.endEnrolments.push({ studentId: e.studentId, classId: e.classId, to: endDate });
  const gone = (cur, ids) => [...cur.values()].filter((x) => !ids.has(x.id)).map((x) => ({ id: x.id, name: x.name }));
  const missingFromFile = { teachers: gone(curT, new Set(roster.teachers.map((t) => t.id))), students: gone(curS, inFile), classes: gone(curC, new Set(roster.classes.map((c) => c.id))) };
  return { writes, summary: { added, updated, ended: { enrolments: writes.endEnrolments.length }, unmatchedClasses, missingFromFile } };
}
