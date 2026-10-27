// Our own simple spreadsheet: one row per item. Anyone can fill it in, so it never counts as
// school-verified. A student's own file is student-added; a file a teacher or coordinator brings
// is teacher-endorsed by that member of staff, who is vouching for it.
import { parseCsv, toCsv } from './csv.js';
import { mapColumns, cellOf, parseDate, studentMatcher, makeCandidate, rowResult, slug, readType, safeUrl } from './common.js';

export const TEMPLATE_HEADERS = ['title', 'date', 'student email or id', 'type', 'summary', 'link'];
export const templateCsv = (example = {}) => toCsv([
  TEMPLATE_HEADERS,
  ['Inter-school swimming gala, 2nd in 100m freestyle', '2026-10-18', example.email || 'maya.chen@student.nist.ac.th', 'sport', 'Swam for NIST at the Bangkok schools gala.', ''],
  ['Volunteer reading at the Klong Toey library', '12/10/2026', example.id || 'st-01', 'service', 'Read with Year 3 pupils for an hour.', 'https://example.org/reading'],
]);

const COLS = {
  title: ['title', 'Title', 'Activity', 'What', 'Item', 'Name of activity', 'Event'],
  date: ['date', 'Date', 'When', 'Start Date', 'Date (YYYY-MM-DD)'],
  student: ['student email or id', 'Student', 'Student email', 'Email', 'Email Address', 'Student ID', 'Student Name'],
  type: ['type', 'Type', 'Kind', 'Category'],
  summary: ['summary', 'Summary', 'Description', 'Details', 'Notes'],
  link: ['link', 'Link', 'URL', 'Evidence', 'Evidence link'],
};

// ctx.selfId: a student importing their own file; rows for anyone else are refused.
// ctx.by: { teacherId, name } when staff import it (their endorsement travels with each item).
export function parseGeneric(text, { students, lines, today, selfId, by, file = 'items.csv' }) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], problems: ['The file has no rows under the headings.'] };
  const cols = mapColumns(rows[0], COLS);
  const problems = [];
  if (cols.title === undefined) problems.push('No “title” column. Download the template to see the headings.');
  if (cols.date === undefined) problems.push('No “date” column. Download the template to see the headings.');
  if (!selfId && cols.student === undefined) problems.push('No “student email or id” column, so the rows cannot be matched to students.');
  if (problems.length) return { items: [], problems };
  const match = studentMatcher(students);
  const self = selfId && students.find((s) => s.id === selfId);
  const items = [];
  rows.slice(1).forEach((r, i) => {
    const c = cellOf(r, cols); const rowNo = i + 2;
    const title = c('title'); const who = c('student');
    const m = who ? match(who.includes('@') ? { email: who } : /^st-\d+$/i.test(who) || /^\d+$/.test(who) ? { studentId: who } : { studentId: who, name: who }) : self ? { student: self, by: 'your file' } : { problem: 'No student on this row' };
    if (!title) return items.push(rowResult(rowNo, '(no title)', m, null, 'No title'));
    if (self && m.student && m.student.id !== self.id) return items.push(rowResult(rowNo, title, null, null, 'This row is for someone else'));
    if (self && !m.student) return items.push(rowResult(rowNo, title, null, null, `${m.problem}. Leave the student column blank in your own file.`));
    if (!m.student) return items.push(rowResult(rowNo, title, m, null, m.problem));
    const date = parseDate(c('date'));
    if (!date) return items.push(rowResult(rowNo, title, m, null, c('date') ? `Cannot read the date “${c('date')}”` : 'No date'));
    const summary = c('summary');
    const link = safeUrl(c('link'));
    const warnings = [...(c('link') && !link ? ['The link is not a web address, so it was left out'] : []), ...(date > today ? ['Dated after today'] : [])];
    const type = readType(c('type'), `${title} ${summary}`, 'project');
    const staff = !self && by?.teacherId;
    const cand = makeCandidate({ student: m.student, lines, title, date, type, summary, evidence: link ? [{ kind: 'link', url: link, caption: 'Link' }] : [],
      verification: staff ? 'teacher-endorsed' : 'student-added', system: self ? 'Your spreadsheet' : 'Spreadsheet import', ref: `csv:${slug(title)}:${date}`, sourceId: self ? 'mine' : 'csv',
      extra: staff ? { classEndorsement: { teacherId: by.teacherId, note: `Imported from ${file} by ${by.name}.`, date: today } } : {} });
    items.push(rowResult(rowNo, title, m, cand, null, warnings));
  });
  return { items, problems: [], file };
}
