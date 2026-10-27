// Google Classroom.
//
// Takeout: Google Takeout's Classroom export is a folder of JSON files per class. Google documents
// what it contains (classes, people, classwork, submissions with marks) but not the exact layout,
// and the field names follow the Classroom API (Course, CourseWork, StudentSubmission, UserProfile:
// title, workType, maxPoints, dueDate {year, month, day}, courseWorkId, userId, state, assignedGrade,
// late, alternateLink, profile.emailAddress, profile.name.fullName). So this reader walks every JSON
// file it is given and picks those objects out wherever they sit, rather than relying on one layout.
// Unzip the Takeout archive first and drop the JSON files (several at once is fine).
//
// Gradebook: Classroom's "Download these grades as CSV" is a grid (names and email, then a column
// per assignment, with rows for dates and points); see grid.js.
import { parseCsv } from './csv.js';
import { parseDate, studentMatcher, makeCandidate, rowResult, slug, safeUrl } from './common.js';
import { parseGrid } from './grid.js';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const ymd = (d) => (isObj(d) && d.year ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : null);
const isCourse = (o) => typeof o.name === 'string' && ('courseState' in o || 'enrollmentCode' in o || 'section' in o || 'ownerId' in o || 'courseGroupEmail' in o);
const isCourseWork = (o) => typeof o.title === 'string' && !('courseWorkId' in o) && ('workType' in o || 'maxPoints' in o || 'dueDate' in o || 'assigneeMode' in o || 'submissionModificationMode' in o);
const isSubmission = (o) => ('courseWorkId' in o && ('userId' in o || 'state' in o)) || 'assignedGrade' in o || ('state' in o && /TURNED_IN|RETURNED|RECLAIMED_BY_STUDENT|CREATED|NEW/.test(o.state) && ('late' in o || 'submissionHistory' in o || 'draftGrade' in o));
const profileOf = (o) => (isObj(o.profile) ? o.profile : isObj(o.userProfile) ? o.userProfile : isObj(o.student?.profile) ? o.student.profile : 'emailAddress' in o ? o : null);

// Collects courses, coursework, submissions and people from any JSON shape.
export function collectClassroom(docs) {
  const courses = new Map(); const work = new Map(); const subs = []; const people = new Map();
  const walk = (node, ctx) => {
    if (Array.isArray(node)) { node.forEach((n) => walk(n, ctx)); return; }
    if (!isObj(node)) return;
    let next = ctx;
    if (isCourse(node)) { const id = node.id || node.name; courses.set(id, { id, name: node.name, section: node.section }); next = { ...next, courseId: id }; }
    if (isCourseWork(node)) { const id = node.id || `${ctx.courseId || ''}:${node.title}`; work.set(id, { ...node, id, courseId: node.courseId || ctx.courseId }); next = { ...next, courseWorkId: id }; }
    else if (isSubmission(node)) subs.push({ ...node, courseId: node.courseId || ctx.courseId, courseWorkId: node.courseWorkId || ctx.courseWorkId, _profile: profileOf(node) });
    const p = profileOf(node);
    if (p?.emailAddress && (node.userId || p.id)) people.set(String(node.userId || p.id), { email: p.emailAddress, name: p.name?.fullName || [p.name?.givenName, p.name?.familyName].filter(Boolean).join(' ') });
    for (const [k, v] of Object.entries(node)) if (k !== 'profile' && (Array.isArray(v) || isObj(v))) walk(v, next);
  };
  for (const d of docs) walk(d.json, { file: d.name });
  return { courses, work, subs, people };
}

// files: [{ name, text }]. `selfId` set when a student imports their own Takeout (no user ids on it).
export function parseClassroomTakeout(files, { students, lines, today, selfId }) {
  const docs = []; const problems = [];
  for (const f of files) {
    try { docs.push({ name: f.name, json: JSON.parse(f.text.replace(/^﻿/, '')) }); } catch { problems.push(`${f.name} is not readable JSON, so it was left out.`); }
  }
  const { courses, work, subs, people } = collectClassroom(docs);
  if (!subs.length) return { items: [], problems: [...problems, work.size ? 'Found classwork but no submissions. Include the files with student submissions.' : 'No Classroom classwork or submissions found in these files.'] };
  const match = studentMatcher(students);
  const self = selfId && students.find((s) => s.id === selfId);
  const items = [];
  subs.forEach((s, n) => {
    const cw = work.get(s.courseWorkId) || {};
    const title = cw.title || s.courseWorkTitle || s.title || '(untitled classwork)';
    const person = people.get(String(s.userId)) || (s._profile?.emailAddress ? { email: s._profile.emailAddress, name: s._profile.name?.fullName } : null);
    const m = person ? match({ email: person.email, name: person.name }) : self ? { student: self, by: 'your own export' } : { problem: s.userId ? `No profile for Classroom user ${s.userId}` : 'No student on this submission' };
    if (self && m.student && m.student.id !== self.id) return items.push(rowResult(n + 1, title, null, null, 'This submission belongs to someone else'));
    if (!m.student) return items.push(rowResult(n + 1, title, m, null, m.problem));
    if (!/TURNED_IN|RETURNED/.test(s.state || 'RETURNED') && s.assignedGrade === undefined) return items.push(rowResult(n + 1, title, m, null, 'Not handed in yet'));
    const turnedIn = (s.submissionHistory || []).map((h) => h.stateHistory).filter((h) => h?.state === 'TURNED_IN').map((h) => h.stateTimestamp).pop();
    const date = ymd(cw.dueDate) || parseDate(turnedIn) || parseDate(s.updateTime) || parseDate(cw.creationTime) || null;
    if (!date) return items.push(rowResult(n + 1, title, m, null, 'No date on this submission'));
    const course = courses.get(s.courseId || cw.courseId);
    const grade = s.assignedGrade ?? null;
    const g = grade === null ? '' : cw.maxPoints ? `${grade}/${cw.maxPoints}` : String(grade);
    const link = safeUrl(s.alternateLink) || safeUrl(cw.alternateLink);
    const summary = [course?.name, cw.workType === 'SHORT_ANSWER_QUESTION' || cw.workType === 'MULTIPLE_CHOICE_QUESTION' ? 'Question' : 'Assignment', s.late ? 'handed in late' : 'handed in', g && `mark ${g}`].filter(Boolean).join(' · ');
    const evidence = [...(g ? [{ kind: 'grade', url: null, caption: `${title}: ${g}` }] : []), ...(link ? [{ kind: 'link', url: link, caption: 'Open in Google Classroom' }] : [])];
    const cand = makeCandidate({ student: m.student, lines, title, date, type: g ? 'assessment' : 'class', summary, evidence,
      verification: self ? 'student-added' : 'school-verified', system: 'Google Classroom', ref: `gc:${slug(course?.id || s.courseId || 'class')}:${slug(cw.id || title)}`, sourceId: self ? 'mine' : 'classroom' });
    items.push(rowResult(n + 1, title, m, cand, null, date > today ? ['Due after today'] : []));
  });
  return { items, problems };
}

export function parseClassroomGrades(text, { students, lines, today, file = 'grades.csv' }) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], problems: ['The file has no rows under the headings.'] };
  return parseGrid(rows, { students, lines, today, file, system: 'Google Classroom', sourceId: 'classroom', refPrefix: 'gc-grade' });
}
